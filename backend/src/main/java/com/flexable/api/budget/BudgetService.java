package com.flexable.api.budget;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.BudgetDtos.FixedItem;
import com.flexable.api.budget.BudgetDtos.ProtectedEntry;
import com.flexable.api.budget.BudgetDtos.SettingsRequest;
import com.flexable.api.budget.BudgetDtos.SettingsResponse;
import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.Times;
import com.flexable.api.common.TxType;
import com.flexable.api.config.AppProperties;
import com.flexable.api.transaction.TransactionRepository;
import com.flexable.api.user.UserRepository;

@Service
public class BudgetService {

	private final SettingsRepository settings;
	private final FixedExpenseRepository fixed;
	private final ProtectedItemRepository protectedItems;
	private final TransactionRepository transactions;
	private final UserRepository users;
	private final FixedExpensePoster fixedPoster;
	private final DailyBudgetRepository dailyBudgets;
	private final SeedMoneyEntryRepository seedEntries;
	private final Clock clock;
	private final ZoneId zone;

	public BudgetService(SettingsRepository settings, FixedExpenseRepository fixed,
			ProtectedItemRepository protectedItems, TransactionRepository transactions, UserRepository users,
			FixedExpensePoster fixedPoster, DailyBudgetRepository dailyBudgets, SeedMoneyEntryRepository seedEntries,
			Clock clock, AppProperties props) {
		this.settings = settings;
		this.fixed = fixed;
		this.protectedItems = protectedItems;
		this.transactions = transactions;
		this.users = users;
		this.fixedPoster = fixedPoster;
		this.dailyBudgets = dailyBudgets;
		this.seedEntries = seedEntries;
		this.clock = clock;
		this.zone = props.zoneId();
	}

	@Transactional(readOnly = true)
	public SettingsResponse get(long userId) {
		return toResponse(require(userId), userId);
	}

	@Transactional
	public SettingsResponse put(long userId, SettingsRequest req) {
		Instant now = clock.instant();
		Instant balanceAt = req.balanceAt() == null ? now : req.balanceAt().toInstant();
		if (balanceAt.isAfter(now.plus(5, ChronoUnit.MINUTES))) {
			throw ApiException.invalid("balanceAt", "기준 시각은 지금보다 늦을 수 없어요");
		}
		// 기기 시계 오차로 조금 늦게 들어온 값은 지금으로 맞춘다(자정 직전이면 날짜가 넘어가므로).
		balanceAt = balanceAt.isAfter(now) ? now : balanceAt;
		// 고정지출 자동 기록(FixedExpensePoster)과 같은 순서로 설정 행을 먼저 잠근다.
		BudgetSettings s = settings.findForUpdate(userId).orElseGet(() -> new BudgetSettings(userId));
		s.apply(req.balance(), balanceAt, req.payday(), req.incomeAmount(),
				req.cardUnpaid() == null ? 0 : req.cardUnpaid(), now);
		// 1.3.0 이전 앱은 seedBase를 보내지 않는다. 그때는 저장된 값을 지키도록 null이면 바꾸지 않는다.
		if (req.seedBase() != null) {
			s.applySeedBase(req.seedBase());
		}
		settings.save(s);

		fixed.deleteByUserId(userId);
		protectedItems.deleteByUserId(userId);
		List<FixedExpense> newFixed = new ArrayList<>();
		List<FixedItem> fixedReq = req.fixedExpenses() == null ? List.of() : req.fixedExpenses();
		for (int i = 0; i < fixedReq.size(); i++) {
			FixedItem f = fixedReq.get(i);
			newFixed.add(new FixedExpense(userId, f.name().trim(), f.amount(), f.day(), i));
		}
		fixed.saveAll(newFixed);
		List<ProtectedItem> newProtected = new ArrayList<>();
		List<ProtectedEntry> protectedReq = req.protectedItems() == null ? List.of() : req.protectedItems();
		for (int i = 0; i < protectedReq.size(); i++) {
			ProtectedEntry p = protectedReq.get(i);
			newProtected.add(new ProtectedItem(userId, p.name().trim(), p.amount(), i));
		}
		protectedItems.saveAll(newProtected);

		users.findWithLockById(userId).ifPresent(u -> u.markOnboarded());
		return toResponse(s, userId);
	}

	/** 날짜가 된 고정지출을 같은 트랜잭션에서 먼저 기록하고 계산한다(실패하면 고정지출이 빠진 금액 대신 오류). */
	@Transactional
	public TodayResponse today(long userId) {
		LocalDate today = LocalDate.now(clock.withZone(zone));
		fixedPoster.postInTransaction(userId, today);
		BudgetSettings s = require(userId);
		List<FixedExpense> fixedList = fixed.findOrdered(userId);
		long protectedTotal = protectedItems.findOrdered(userId).stream().mapToLong(ProtectedItem::getAmount).sum();

		// 잔액 기준 시각 이후 거래 + 이번 주 거래가 필요하다.
		Instant weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1L).atStartOfDay(zone).toInstant();
		Instant since = s.getBalanceAt().isBefore(weekStart) ? s.getBalanceAt() : weekStart;
		List<BudgetCalculator.Tx> txs = transactions.findSince(userId, since)
			.stream()
			.map(t -> new BudgetCalculator.Tx(t.getType(), t.getAmount(), t.getOccurredAt(), t.isFromFixed()))
			.toList();

		BudgetCalculator.Input input = new BudgetCalculator.Input(s.getBalance(), s.getBalanceAt(), s.getPayday(),
				s.getCardUnpaid(), fixedList.stream().map(FixedExpense::getDay).toList(),
				fixedList.stream().map(FixedExpense::getAmount).toList(), protectedTotal, txs,
				!txs.isEmpty() || transactions.existsByUserId(userId),
				seedEntries.sumCreatedAfter(userId, s.getBalanceAt()));
		TodayResponse r = BudgetCalculator.compute(input, today, zone);
		dailyBudgets.upsert(userId, today, r.dailyBudget());
		return r.withCharacter(characterScore(userId, today));
	}

	/** 코인·코스튬이 쓰는 오늘 기준 캐릭터 점수(peak = 지금까지 최고 점수). 하루 예산 기록이 없으면 0점. */
	@Transactional(readOnly = true)
	public CharacterScore.Result characterScore(long userId) {
		return characterScore(userId, LocalDate.now(clock.withZone(zone)));
	}

	/** 그날 예산을 지켰는지(캐릭터 점수와 같은 판정). 그날까지 하루 예산 기록이 없으면 false. */
	@Transactional(readOnly = true)
	public boolean keptBudget(long userId, LocalDate day) {
		History h = history(userId);
		return CharacterScore.kept(h.budgets(), h.spent(), day);
	}

	/** 하루 예산을 처음 기록한 날부터 어제까지 그날 예산을 지켰는지로 캐릭터 점수를 낸다. */
	private CharacterScore.Result characterScore(long userId, LocalDate today) {
		History h = history(userId);
		return CharacterScore.compute(h.budgets(), h.spent(), today);
	}

	/** budgets: 날짜별 하루 예산, spent: 첫 기록일부터 날짜별 지출 합(고정지출 자동 기록 제외) */
	private record History(NavigableMap<LocalDate, Long> budgets, Map<LocalDate, Long> spent) {
	}

	private History history(long userId) {
		NavigableMap<LocalDate, Long> budgets = new TreeMap<>();
		dailyBudgets.findOrdered(userId).forEach(d -> budgets.put(d.getDate(), d.getDailyBudget()));
		Map<LocalDate, Long> spent = new HashMap<>();
		if (budgets.isEmpty()) {
			return new History(budgets, spent);
		}
		for (var t : transactions.findSince(userId, budgets.firstKey().atStartOfDay(zone).toInstant())) {
			if (t.getType() == TxType.EXPENSE && !t.isFromFixed()) {
				spent.merge(t.getOccurredAt().atZone(zone).toLocalDate(), t.getAmount(), Long::sum);
			}
		}
		return new History(budgets, spent);
	}

	private BudgetSettings require(long userId) {
		return settings.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
	}

	private SettingsResponse toResponse(BudgetSettings s, long userId) {
		List<FixedItem> fixedList = fixed.findOrdered(userId)
			.stream()
			.map(f -> new FixedItem(f.getId(), f.getName(), f.getAmount(), f.getDay()))
			.toList();
		List<ProtectedEntry> protectedList = protectedItems.findOrdered(userId)
			.stream()
			.map(p -> new ProtectedEntry(p.getId(), p.getName(), p.getAmount()))
			.toList();
		return new SettingsResponse(s.getBalance(), Times.at(s.getBalanceAt(), zone), s.getPayday(),
				s.getIncomeAmount(), s.getCardUnpaid(), fixedList, protectedList, s.getSeedBase(), Times.at(s.getUpdatedAt(), zone));
	}
}
