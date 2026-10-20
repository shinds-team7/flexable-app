package com.flexable.api.budget;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.common.TxType;

/**
 * 오늘 쓸 수 있는 돈 계산(서버 최종값). 원 단위 정수, 나눗셈은 내림. 규칙은 docs/API.md "GET /budget/today".
 */
public final class BudgetCalculator {

	private BudgetCalculator() {
	}

	/** fixed: 고정지출 자동 기록. 잔액에서는 빠지지만 오늘·이번 주 지출 합에는 넣지 않는다. */
	public record Tx(TxType type, long amount, Instant occurredAt, boolean fixed) {

		public Tx(TxType type, long amount, Instant occurredAt) {
			this(type, amount, occurredAt, false);
		}
	}

	/** savedSinceBalance: 잔액 기준 시각 뒤에 시드머니로 옮긴 돈(통장에서 빠진 돈). */
	public record Input(long balance, Instant balanceAt, int payday, long cardUnpaid, List<Integer> fixedDays,
			List<Long> fixedAmounts, long protectedTotal, List<Tx> transactions, boolean hasTransactions,
			long savedSinceBalance) {

		public Input(long balance, Instant balanceAt, int payday, long cardUnpaid, List<Integer> fixedDays,
				List<Long> fixedAmounts, long protectedTotal, List<Tx> transactions, boolean hasTransactions) {
			this(balance, balanceAt, payday, cardUnpaid, fixedDays, fixedAmounts, protectedTotal, transactions,
					hasTransactions, 0);
		}
	}

	public static TodayResponse compute(Input in, LocalDate today, ZoneId zone) {
		LocalDate nextPayday = nextPayday(today, in.payday());
		LocalDate cycleStart = previousPayday(today, in.payday());
		int daysLeft = (int) Math.max(1, ChronoUnit.DAYS.between(today, nextPayday));
		LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
		LocalDate weekEnd = weekStart.plusDays(6);

		long estimated = in.balance() - in.savedSinceBalance();
		long todaySpent = 0;
		long weekSpent = 0;
		for (Tx t : in.transactions()) {
			if (t.occurredAt().isAfter(in.balanceAt())) {
				estimated += t.type() == TxType.INCOME ? t.amount() : -t.amount();
			}
			if (t.type() == TxType.EXPENSE && !t.fixed()) {
				LocalDate d = t.occurredAt().atZone(zone).toLocalDate();
				if (d.equals(today)) {
					todaySpent += t.amount();
				}
				if (!d.isBefore(weekStart) && !d.isAfter(weekEnd)) {
					weekSpent += t.amount();
				}
			}
		}

		// 오늘까지 날짜가 된 고정지출은 거래로 기록되므로(FixedExpensePoster) 내일부터만 남겨 둔다.
		long reservedFixed = 0;
		for (int i = 0; i < in.fixedDays().size(); i++) {
			reservedFixed += in.fixedAmounts().get(i)
					* occurrences(in.fixedDays().get(i), today.plusDays(1), nextPayday);
		}

		long remaining = estimated - reservedFixed - in.cardUnpaid() - in.protectedTotal();
		long dailyBudget = Math.max(0, remaining + todaySpent) / daysLeft;
		long todayAvailable = Math.max(0, dailyBudget - todaySpent);
		long shortage = remaining < 0 ? -remaining : Math.max(0, todaySpent - dailyBudget);
		LocalDate weekLast = weekEnd.isBefore(nextPayday) ? weekEnd : nextPayday.minusDays(1);
		int weekDaysLeft = (int) Math.max(1, ChronoUnit.DAYS.between(today, weekLast) + 1);
		long weekAvailable = Math.max(0, dailyBudget * weekDaysLeft - todaySpent);

		return new TodayResponse(today, nextPayday, daysLeft, estimated, reservedFixed, in.cardUnpaid(),
				in.protectedTotal(), remaining, todaySpent, dailyBudget, todayAvailable, shortage, weekSpent,
				weekDaysLeft, weekAvailable, cycleStart, in.hasTransactions(), 0, 0);
	}

	/** 그 달의 수입일(31 등 없는 날은 말일로). */
	static LocalDate paydayIn(YearMonth ym, int payday) {
		return ym.atDay(Math.min(payday, ym.lengthOfMonth()));
	}

	/** 그 달의 실제 수입일. 토·일이면 다음 월요일로 미룬다(공휴일은 반영하지 않음). 다음 달로 넘어갈 수 있다. */
	static LocalDate incomeDayIn(YearMonth ym, int payday) {
		LocalDate d = paydayIn(ym, payday);
		return switch (d.getDayOfWeek()) {
			case SATURDAY -> d.plusDays(2);
			case SUNDAY -> d.plusDays(1);
			default -> d;
		};
	}

	/** 오늘 이후(오늘 제외) 가장 가까운 수입일 */
	static LocalDate nextPayday(LocalDate today, int payday) {
		// 지난달 수입일이 주말이라 이번 달로 밀렸을 수 있어서 앞뒤 달을 함께 본다
		YearMonth ym = YearMonth.from(today);
		for (int i = -1; i <= 1; i++) {
			LocalDate d = incomeDayIn(ym.plusMonths(i), payday);
			if (d.isAfter(today)) {
				return d;
			}
		}
		return incomeDayIn(ym.plusMonths(2), payday);
	}

	/** 오늘 또는 그 이전의 가장 가까운 수입일(이번 정산 주기 시작) */
	static LocalDate previousPayday(LocalDate today, int payday) {
		YearMonth ym = YearMonth.from(today);
		for (int i = 0; i >= -2; i--) {
			LocalDate d = incomeDayIn(ym.plusMonths(i), payday);
			if (!d.isAfter(today)) {
				return d;
			}
		}
		return incomeDayIn(ym.minusMonths(3), payday);
	}

	/** [from, toExclusive) 사이에 고정지출 날짜가 몇 번 오는지 */
	static int occurrences(int day, LocalDate from, LocalDate toExclusive) {
		Set<YearMonth> months = new LinkedHashSet<>();
		for (YearMonth ym = YearMonth.from(from); !ym.isAfter(YearMonth.from(toExclusive)); ym = ym.plusMonths(1)) {
			months.add(ym);
		}
		int count = 0;
		for (YearMonth ym : months) {
			LocalDate d = paydayIn(ym, day);
			if (!d.isBefore(from) && d.isBefore(toExclusive)) {
				count++;
			}
		}
		return count;
	}
}
