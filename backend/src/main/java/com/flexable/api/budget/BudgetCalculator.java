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

	public record Tx(TxType type, long amount, Instant occurredAt) {
	}

	public record Input(long balance, Instant balanceAt, int payday, long cardUnpaid, List<Integer> fixedDays,
			List<Long> fixedAmounts, long protectedTotal, List<Tx> transactions) {
	}

	public static TodayResponse compute(Input in, LocalDate today, ZoneId zone) {
		LocalDate nextPayday = nextPayday(today, in.payday());
		LocalDate cycleStart = previousPayday(today, in.payday());
		int daysLeft = (int) Math.max(1, ChronoUnit.DAYS.between(today, nextPayday));
		LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
		LocalDate weekEnd = weekStart.plusDays(6);

		long estimated = in.balance();
		long todaySpent = 0;
		long weekSpent = 0;
		for (Tx t : in.transactions()) {
			if (t.occurredAt().isAfter(in.balanceAt())) {
				estimated += t.type() == TxType.INCOME ? t.amount() : -t.amount();
			}
			if (t.type() == TxType.EXPENSE) {
				LocalDate d = t.occurredAt().atZone(zone).toLocalDate();
				if (d.equals(today)) {
					todaySpent += t.amount();
				}
				if (!d.isBefore(weekStart) && !d.isAfter(weekEnd)) {
					weekSpent += t.amount();
				}
			}
		}

		long reservedFixed = 0;
		for (int i = 0; i < in.fixedDays().size(); i++) {
			reservedFixed += in.fixedAmounts().get(i) * occurrences(in.fixedDays().get(i), today, nextPayday);
		}

		long remaining = estimated - reservedFixed - in.cardUnpaid() - in.protectedTotal();
		long dailyBudget = Math.max(0, remaining + todaySpent) / daysLeft;
		long todayAvailable = Math.max(0, dailyBudget - todaySpent);
		long shortage = remaining < 0 ? -remaining : Math.max(0, todaySpent - dailyBudget);

		return new TodayResponse(today, nextPayday, daysLeft, estimated, reservedFixed, in.cardUnpaid(),
				in.protectedTotal(), remaining, todaySpent, dailyBudget, todayAvailable, shortage, weekSpent,
				cycleStart);
	}

	/** 그 달의 수입일(31 등 없는 날은 말일로). */
	static LocalDate paydayIn(YearMonth ym, int payday) {
		return ym.atDay(Math.min(payday, ym.lengthOfMonth()));
	}

	/** 오늘 이후(오늘 제외) 가장 가까운 수입일 */
	static LocalDate nextPayday(LocalDate today, int payday) {
		YearMonth ym = YearMonth.from(today);
		LocalDate thisMonth = paydayIn(ym, payday);
		return thisMonth.isAfter(today) ? thisMonth : paydayIn(ym.plusMonths(1), payday);
	}

	/** 오늘 또는 그 이전의 가장 가까운 수입일(이번 정산 주기 시작) */
	static LocalDate previousPayday(LocalDate today, int payday) {
		YearMonth ym = YearMonth.from(today);
		LocalDate thisMonth = paydayIn(ym, payday);
		return thisMonth.isAfter(today) ? paydayIn(ym.minusMonths(1), payday) : thisMonth;
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
