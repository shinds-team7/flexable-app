package com.flexable.api.budget;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.BudgetDtos.SeedMoneyEntryItem;
import com.flexable.api.budget.BudgetDtos.SeedMoneyPending;
import com.flexable.api.budget.BudgetDtos.SeedMoneyRequest;
import com.flexable.api.budget.BudgetDtos.SeedMoneyResponse;
import com.flexable.api.budget.BudgetDtos.WebSeedMoney;
import com.flexable.api.budget.BudgetDtos.WebSeedMoneyEntry;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.Times;
import com.flexable.api.config.AppProperties;
import com.flexable.api.transaction.TransactionRepository;

/**
 * 시드머니 = 모아둔 돈(seed_base) + 주기마다 옮긴 돈의 합. 수입일 전날부터 그 주기를 반영할 수 있고,
 * 반영하지 않으면 다음 수입일 전날까지 기다린다(그때 지난 주기는 반영 없이 넘어간다).
 * 옮긴 돈은 통장 잔액에서 빠진 것으로 보고 오늘 쓸 수 있는 돈 계산(BudgetService)에서도 뺀다.
 */
@Service
public class SeedMoneyService {

	private static final int ENTRY_LIMIT = 12;

	private final SettingsRepository settings;
	private final FixedExpenseRepository fixed;
	private final ProtectedItemRepository protectedItems;
	private final TransactionRepository transactions;
	private final DailyBudgetRepository dailyBudgets;
	private final SeedMoneyEntryRepository entries;
	private final FixedExpensePoster fixedPoster;
	private final Clock clock;
	private final ZoneId zone;

	public SeedMoneyService(SettingsRepository settings, FixedExpenseRepository fixed,
			ProtectedItemRepository protectedItems, TransactionRepository transactions,
			DailyBudgetRepository dailyBudgets, SeedMoneyEntryRepository entries, FixedExpensePoster fixedPoster,
			Clock clock, AppProperties props) {
		this.settings = settings;
		this.fixed = fixed;
		this.protectedItems = protectedItems;
		this.transactions = transactions;
		this.dailyBudgets = dailyBudgets;
		this.entries = entries;
		this.fixedPoster = fixedPoster;
		this.clock = clock;
		this.zone = props.zoneId();
	}

	/** 주기 끝까지의 고정지출이 기록돼 있어야 '남은 돈 전부' 금액이 맞으므로 먼저 기록한다. */
	@Transactional
	public SeedMoneyResponse get(long userId) {
		LocalDate today = LocalDate.now(clock.withZone(zone));
		fixedPoster.postInTransaction(userId, today);
		return view(userId, require(userId), today);
	}

	@Transactional
	public SeedMoneyResponse confirm(long userId, SeedMoneyRequest req) {
		LocalDate today = LocalDate.now(clock.withZone(zone));
		fixedPoster.postInTransaction(userId, today);
		// 같은 주기를 동시에 두 번 반영하지 않도록 설정 행을 잠근 뒤 확인한다.
		BudgetSettings s = settings.findForUpdate(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
		SeedMoneyPending p = pending(userId, s, today);
		if (p == null || !p.cycleEnd().equals(req.cycleEnd())) {
			throw new ApiException(ErrorCode.SEED_NOT_PENDING);
		}
		long amount = switch (req.choice()) {
			case GOAL -> p.goalAmount();
			case ALL -> p.allAmount();
			case MANUAL -> {
				if (req.amount() == null) {
					throw ApiException.invalid("amount", "금액을 입력해 주세요");
				}
				yield req.amount();
			}
		};
		entries.save(new SeedMoneyEntry(userId, p.cycleEnd(), req.choice(), amount, clock.instant()));
		return view(userId, s, today);
	}

	/** 웹 연동용. 반영 대기 정보 없이 확정된 값만 준다. */
	@Transactional(readOnly = true)
	public WebSeedMoney forWeb(long userId) {
		BudgetSettings s = require(userId);
		List<SeedMoneyEntry> list = entries.findByUserIdOrderByCycleEndAsc(userId);
		long total = s.getSeedBase();
		List<WebSeedMoneyEntry> history = new ArrayList<>(list.size());
		for (SeedMoneyEntry e : list) {
			total += e.getAmount();
			history.add(new WebSeedMoneyEntry(e.getCycleEnd(), e.getChoice(), e.getAmount(), total,
					Times.at(e.getCreatedAt(), zone)));
		}
		SeedMoneyEntry last = list.isEmpty() ? null : list.getLast();
		Instant updatedAt = last == null || last.getCreatedAt().isBefore(s.getUpdatedAt()) ? s.getUpdatedAt()
				: last.getCreatedAt();
		return new WebSeedMoney(total, s.getSeedBase(), protectedTotal(userId), last == null ? null : item(last),
				Times.at(updatedAt, zone), dailyBudgets.findFirstDate(userId), history);
	}

	/**
	 * 웹 연동용. 웹에서 고친 총액이 되도록 모아둔 돈(seedBase)을 바꾼다(총액 − 반영한 돈 합). 반영 기록과 예산 계산은 그대로다.
	 * 반영한 돈 합보다 작은 총액은 모아둔 돈이 음수가 되므로 받지 않는다.
	 */
	@Transactional
	public WebSeedMoney setTotalFromWeb(long userId, long total) {
		BudgetSettings s = settings.findForUpdate(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
		long saved = entries.findByUserIdOrderByCycleEndAsc(userId).stream().mapToLong(SeedMoneyEntry::getAmount).sum();
		if (total < saved) {
			throw ApiException.invalid("total", "앱에서 반영한 돈(" + String.format("%,d", saved) + "원)보다 작게 고칠 수 없어요");
		}
		s.changeSeedBase(total - saved, clock.instant());
		return forWeb(userId);
	}

	private SeedMoneyResponse view(long userId, BudgetSettings s, LocalDate today) {
		List<SeedMoneyEntry> list = entries.findByUserIdOrderByCycleEndDesc(userId);
		long saved = list.stream().mapToLong(SeedMoneyEntry::getAmount).sum();
		return new SeedMoneyResponse(s.getSeedBase(), saved, s.getSeedBase() + saved, protectedTotal(userId),
				pending(userId, s, today), list.stream().limit(ENTRY_LIMIT).map(this::item).toList());
	}

	/**
	 * 반영할 주기: 오늘이 수입일 전날이면 오늘 끝나는 주기, 아니면 직전 수입일 전날에 끝난 주기.
	 * 그 주기가 끝나기 전부터 앱을 썼고(하루 예산 기록이 그 전날 이전에 있음) 아직 반영하지 않았을 때만 있다.
	 */
	private SeedMoneyPending pending(long userId, BudgetSettings s, LocalDate today) {
		LocalDate next = BudgetCalculator.nextPayday(today, s.getPayday());
		LocalDate end = today.equals(next.minusDays(1)) ? today
				: BudgetCalculator.previousPayday(today, s.getPayday()).minusDays(1);
		List<DailyBudget> used = dailyBudgets.findOrdered(userId);
		if (used.isEmpty() || !used.get(0).getDate().isBefore(end) || entries.existsByUserIdAndCycleEnd(userId, end)) {
			return null;
		}
		long goal = protectedTotal(userId);
		return new SeedMoneyPending(end, end.plusDays(1), goal, allAmount(userId, s, end, goal));
	}

	/**
	 * 주기 마지막 날 기준 '매달 저축할 돈 + 남은 돈 전부' = 그날까지의 추정 잔액 − 카드 미결제액(0 미만이면 0).
	 * 수입일 전날에는 남은 고정지출 예정액이 없으므로 BudgetCalculator의 remaining + 매달 저축할 돈과 같다.
	 */
	private long allAmount(long userId, BudgetSettings s, LocalDate end, long goal) {
		Instant endExclusive = end.plusDays(1).atStartOfDay(zone).toInstant();
		List<BudgetCalculator.Tx> txs = transactions.findSince(userId, s.getBalanceAt())
			.stream()
			.filter(t -> t.getOccurredAt().isBefore(endExclusive))
			.map(t -> new BudgetCalculator.Tx(t.getType(), t.getAmount(), t.getOccurredAt(), t.isFromFixed()))
			.toList();
		List<FixedExpense> fixedList = fixed.findOrdered(userId);
		BudgetCalculator.Input input = new BudgetCalculator.Input(s.getBalance(), s.getBalanceAt(), s.getPayday(),
				s.getCardUnpaid(), fixedList.stream().map(FixedExpense::getDay).toList(),
				fixedList.stream().map(FixedExpense::getAmount).toList(), goal, txs, !txs.isEmpty(),
				entries.sumCreatedAfter(userId, s.getBalanceAt()));
		return Math.max(0, BudgetCalculator.compute(input, end, zone).remaining() + goal);
	}

	private long protectedTotal(long userId) {
		return protectedItems.findOrdered(userId).stream().mapToLong(ProtectedItem::getAmount).sum();
	}

	private SeedMoneyEntryItem item(SeedMoneyEntry e) {
		return new SeedMoneyEntryItem(e.getCycleEnd(), e.getChoice(), e.getAmount(), Times.at(e.getCreatedAt(), zone));
	}

	private BudgetSettings require(long userId) {
		return settings.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
	}
}
