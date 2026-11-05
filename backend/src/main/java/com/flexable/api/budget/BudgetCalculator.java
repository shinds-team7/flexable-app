package com.flexable.api.budget;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;

import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.common.TxType;

/**
 * 오늘 쓸 수 있는 돈 계산(서버 최종값). 원 단위 정수, 나눗셈은 내림. 규칙과 예시는 docs/policies.md §1·§2·§5(tests/policy/budget.json).
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

	/** 예정 지출(§6) 한 건. 날짜가 같은 것은 계산에서 합친다. */
	public record Plan(LocalDate date, long amount) {
	}

	/**
	 * savedSinceBalance: 잔액 기준 시각 뒤에 시드머니로 옮긴 돈(통장에서 빠진 돈). days: 요일별 비중(§5). plans: 예정
	 * 지출(§2 "예정 지출 반영", 오늘 이상·수입일 전날 이하만 쓴다).
	 */
	public record Input(long balance, Instant balanceAt, int payday, long cardUnpaid, List<Integer> fixedDays,
			List<Long> fixedAmounts, long protectedTotal, List<Tx> transactions, boolean hasTransactions,
			long savedSinceBalance, DayWeights.Setting days, List<Plan> plans) {

		public Input(long balance, Instant balanceAt, int payday, long cardUnpaid, List<Integer> fixedDays,
				List<Long> fixedAmounts, long protectedTotal, List<Tx> transactions, boolean hasTransactions,
				long savedSinceBalance, DayWeights.Setting days) {
			this(balance, balanceAt, payday, cardUnpaid, fixedDays, fixedAmounts, protectedTotal, transactions,
					hasTransactions, savedSinceBalance, days, List.of());
		}

		public Input(long balance, Instant balanceAt, int payday, long cardUnpaid, List<Integer> fixedDays,
				List<Long> fixedAmounts, long protectedTotal, List<Tx> transactions, boolean hasTransactions,
				long savedSinceBalance) {
			this(balance, balanceAt, payday, cardUnpaid, fixedDays, fixedAmounts, protectedTotal, transactions,
					hasTransactions, savedSinceBalance, DayWeights.Setting.DEFAULT);
		}

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

		// 예정 지출: 오늘 ~ 수입일 전날 날짜만. 내일부터는 남은 생활비에서 먼저 빼고, 오늘 것은 오늘 몫으로 따로 뗀다.
		TreeMap<LocalDate, Long> planned = new TreeMap<>();
		for (Plan p : in.plans()) {
			if (!p.date().isBefore(today) && p.date().isBefore(nextPayday)) {
				planned.merge(p.date(), p.amount(), Long::sum);
			}
		}
		long todayPlanned = planned.getOrDefault(today, 0L);
		long reservedPlanned = planned.tailMap(today, false).values().stream().mapToLong(Long::longValue).sum();

		long remaining = estimated - reservedFixed - reservedPlanned - in.cardUnpaid() - in.protectedTotal();
		// 남은 생활비(오늘 쓴 돈 포함)를 남은 날의 요일 비중대로 나눈다. 비중이 모두 같으면 ÷ 남은 날과 같다.
		long[] dayBudgets = DayWeights.split(Math.max(0, remaining + todaySpent - todayPlanned), in.days().weights(),
				today, nextPayday);
		long dailyBudget = dayBudgets[DayWeights.index(today)] + todayPlanned;
		// 오늘 예산을 넘으면 넘은 만큼 음수로 둔다(홈에서 마이너스로 보여 준다).
		long todayAvailable = dailyBudget - todaySpent;
		long shortage = remaining < 0 ? -remaining : Math.max(0, todaySpent - dailyBudget);
		LocalDate weekLast = weekEnd.isBefore(nextPayday) ? weekEnd : nextPayday.minusDays(1);
		int weekDaysLeft = (int) Math.max(1, ChronoUnit.DAYS.between(today, weekLast) + 1);
		long weekBudget = 0;
		for (LocalDate d = today; !d.isAfter(weekLast); d = d.plusDays(1)) {
			weekBudget += dayBudgets[DayWeights.index(d)] + planned.getOrDefault(d, 0L);
		}
		long weekAvailable = Math.max(0, weekBudget - todaySpent);

		return new TodayResponse(today, nextPayday, daysLeft, estimated, reservedFixed, in.cardUnpaid(),
				in.protectedTotal(), remaining, todaySpent, dailyBudget, todayAvailable, shortage, weekSpent,
				weekDaysLeft, weekAvailable, cycleStart, in.hasTransactions(), in.days().preset(),
				Arrays.stream(dayBudgets).boxed().toList(), reservedPlanned,
				planned.entrySet()
					.stream()
					.map(e -> new BudgetDtos.DayPlan(e.getKey(), e.getValue(),
							dayBudgets[DayWeights.index(e.getKey())] + e.getValue()))
					.toList(),
				0, 0);
	}

	/** 그 달의 수입일(31 등 없는 날은 말일로). */
	static LocalDate paydayIn(YearMonth ym, int payday) {
		return ym.atDay(Math.min(payday, ym.lengthOfMonth()));
	}

	/** 그 달의 실제 수입일. 토·일·공휴일(PublicHolidays)이면 다음 평일로 미룬다. 다음 달로 넘어갈 수 있다. */
	static LocalDate incomeDayIn(YearMonth ym, int payday) {
		LocalDate d = paydayIn(ym, payday);
		while (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY
				|| PublicHolidays.contains(d)) {
			d = d.plusDays(1);
		}
		return d;
	}

	/** 오늘 이후(오늘 제외) 가장 가까운 수입일 */
	static LocalDate nextPayday(LocalDate today, int payday) {
		// 지난달 수입일이 주말·공휴일이라 이번 달로 밀렸을 수 있어서 앞뒤 달을 함께 본다
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
