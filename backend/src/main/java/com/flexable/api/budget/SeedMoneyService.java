package com.flexable.api.budget;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
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
	private final SeedMoneyAdditionRepository additions;
	private final FixedExpensePoster fixedPoster;
	private final Clock clock;
	private final ZoneId zone;

	public SeedMoneyService(SettingsRepository settings, FixedExpenseRepository fixed,
			ProtectedItemRepository protectedItems, TransactionRepository transactions,
			DailyBudgetRepository dailyBudgets, SeedMoneyEntryRepository entries,
			SeedMoneyAdditionRepository additions, FixedExpensePoster fixedPoster, Clock clock, AppProperties props) {
		this.settings = settings;
		this.fixed = fixed;
		this.protectedItems = protectedItems;
		this.transactions = transactions;
		this.dailyBudgets = dailyBudgets;
		this.entries = entries;
		this.additions = additions;
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
			case EXTRA -> throw ApiException.invalid("choice", "바로 옮기기는 지금 보내기로 해 주세요");
		};
		entries.save(new SeedMoneyEntry(userId, p.cycleEnd(), req.choice(), amount, clock.instant()));
		return view(userId, s, today);
	}

	/** 웹 연동용. 반영 대기 정보 없이 확정된 값만 준다. */
	@Transactional(readOnly = true)
	public WebSeedMoney forWeb(long userId) {
		BudgetSettings s = require(userId);
		List<Row> list = rowsAscending(userId);
		long total = s.getSeedBase();
		List<WebSeedMoneyEntry> history = new ArrayList<>(list.size());
		for (Row e : list) {
			total += e.amount();
			history.add(new WebSeedMoneyEntry(e.date(), e.choice(), e.amount(), total, Times.at(e.createdAt(), zone)));
		}
		Row last = list.isEmpty() ? null : list.getLast();
		Instant updatedAt = last == null || last.createdAt().isBefore(s.getUpdatedAt()) ? s.getUpdatedAt()
				: last.createdAt();
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
		long saved = rowsAscending(userId).stream().mapToLong(Row::amount).sum();
		if (total < saved) {
			throw ApiException.invalid("total", "앱에서 반영한 돈(" + String.format("%,d", saved) + "원)보다 작게 고칠 수 없어요");
		}
		s.changeSeedBase(total - saved, clock.instant());
		return forWeb(userId);
	}

	/**
	 * 지금 예산에서 시드머니로 바로 옮긴다. 횟수 제한은 없고, 지금 보낼 수 있는 돈(남은 생활비)까지만 된다.
	 * 옮긴 돈은 추정 잔액에서 빠지고 시드머니 합계에 더해진다.
	 */
	@Transactional
	public SeedMoneyResponse transfer(long userId, long amount) {
		LocalDate today = LocalDate.now(clock.withZone(zone));
		fixedPoster.postInTransaction(userId, today);
		// 반영과 같은 설정 행 잠금으로 동시에 두 번 눌러도 한도를 넘기지 않는다.
		BudgetSettings s = settings.findForUpdate(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
		long movable = movable(userId, s, today);
		if (amount > movable) {
			throw ApiException.invalid("amount", "지금 보낼 수 있는 돈(" + String.format("%,d", movable) + "원)보다 많이 보낼 수 없어요");
		}
		additions.save(new SeedMoneyAddition(userId, amount, clock.instant()));
		return view(userId, s, today);
	}

	/** 모아둔 돈(seedBase)만 고친다. 반영한 돈 기록과 예산 계산(잔액)은 그대로다. */
	@Transactional
	public SeedMoneyResponse setBase(long userId, long base) {
		LocalDate today = LocalDate.now(clock.withZone(zone));
		fixedPoster.postInTransaction(userId, today);
		BudgetSettings s = settings.findForUpdate(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
		s.changeSeedBase(base, clock.instant());
		return view(userId, s, today);
	}

	private SeedMoneyResponse view(long userId, BudgetSettings s, LocalDate today) {
		List<Row> list = rowsAscending(userId).reversed();
		long saved = list.stream().mapToLong(Row::amount).sum();
		return new SeedMoneyResponse(s.getSeedBase(), saved, s.getSeedBase() + saved, protectedTotal(userId),
				movable(userId, s, today), pending(userId, s, today),
				list.stream().limit(ENTRY_LIMIT).map(this::item).toList());
	}

	/** 반영한 돈(주기별)과 바로 옮긴 돈을 시간순으로 합친 목록. 같은 시각이면 날짜순. */
	private List<Row> rowsAscending(long userId) {
		List<Row> rows = new ArrayList<>();
		for (SeedMoneyEntry e : entries.findByUserIdOrderByCycleEndAsc(userId)) {
			rows.add(new Row(e.getCycleEnd(), e.getChoice(), e.getAmount(), e.getCreatedAt()));
		}
		for (SeedMoneyAddition a : additions.findByUserIdOrderByCreatedAtAscIdAsc(userId)) {
			rows.add(new Row(LocalDate.ofInstant(a.getCreatedAt(), zone), SeedMoneyEntry.Choice.EXTRA, a.getAmount(),
					a.getCreatedAt()));
		}
		rows.sort(Comparator.comparing(Row::createdAt).thenComparing(Row::date));
		return rows;
	}

	private record Row(LocalDate date, SeedMoneyEntry.Choice choice, long amount, Instant createdAt) {
	}

	/** 잔액 기준 시각 뒤에 옮긴 돈(반영 + 바로 옮김). 통장 잔액에서 빠진 돈이다. */
	private long movedAfter(long userId, Instant since) {
		return entries.sumCreatedAfter(userId, since) + additions.sumCreatedAfter(userId, since);
	}

	/** 지금 시드머니로 보낼 수 있는 돈 = 오늘까지 기록 기준 남은 생활비(0 미만이면 0). 매달 저축할 돈은 따로 두고 계산한다. */
	private long movable(long userId, BudgetSettings s, LocalDate today) {
		return Math.max(0, remaining(userId, s, today, protectedTotal(userId)));
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
		return Math.max(0, remaining(userId, s, end, goal) + goal);
	}

	/** end 날짜 끝까지의 기록으로 BudgetCalculator가 계산한 남은 생활비. */
	private long remaining(long userId, BudgetSettings s, LocalDate end, long goal) {
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
				movedAfter(userId, s.getBalanceAt()));
		return BudgetCalculator.compute(input, end, zone).remaining();
	}

	private long protectedTotal(long userId) {
		return protectedItems.findOrdered(userId).stream().mapToLong(ProtectedItem::getAmount).sum();
	}

	private SeedMoneyEntryItem item(Row e) {
		return new SeedMoneyEntryItem(e.date(), e.choice(), e.amount(), Times.at(e.createdAt(), zone));
	}

	private BudgetSettings require(long userId) {
		return settings.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.BUDGET_NOT_SET));
	}
}
