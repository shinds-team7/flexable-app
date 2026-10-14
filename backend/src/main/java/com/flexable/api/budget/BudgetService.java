package com.flexable.api.budget;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

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
	private final Clock clock;
	private final ZoneId zone;

	public BudgetService(SettingsRepository settings, FixedExpenseRepository fixed,
			ProtectedItemRepository protectedItems, TransactionRepository transactions, UserRepository users,
			FixedExpensePoster fixedPoster, Clock clock, AppProperties props) {
		this.settings = settings;
		this.fixed = fixed;
		this.protectedItems = protectedItems;
		this.transactions = transactions;
		this.users = users;
		this.fixedPoster = fixedPoster;
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

		users.findById(userId).ifPresent(u -> u.markOnboarded());
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

		// 잔액 기준 시각 이후 거래 + 이번 주 거래 + 소비 속도 구간(paceFrom~오늘) 거래가 필요하다.
		Instant weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1L).atStartOfDay(zone).toInstant();
		Instant paceStart = BudgetCalculator
			.paceFrom(BudgetCalculator.previousPayday(today, s.getPayday()), s.getBalanceAt(), zone)
			.atStartOfDay(zone)
			.toInstant();
		Instant since = s.getBalanceAt().isBefore(weekStart) ? s.getBalanceAt() : weekStart;
		since = paceStart.isBefore(since) ? paceStart : since;
		List<BudgetCalculator.Tx> txs = transactions.findSince(userId, since)
			.stream()
			.map(t -> new BudgetCalculator.Tx(t.getType(), t.getAmount(), t.getOccurredAt(), t.isFromFixed()))
			.toList();

		BudgetCalculator.Input input = new BudgetCalculator.Input(s.getBalance(), s.getBalanceAt(), s.getPayday(),
				s.getCardUnpaid(), fixedList.stream().map(FixedExpense::getDay).toList(),
				fixedList.stream().map(FixedExpense::getAmount).toList(), protectedTotal, txs,
				!txs.isEmpty() || transactions.existsByUserId(userId));
		return BudgetCalculator.compute(input, today, zone);
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
				s.getIncomeAmount(), s.getCardUnpaid(), fixedList, protectedList, Times.at(s.getUpdatedAt(), zone));
	}
}
