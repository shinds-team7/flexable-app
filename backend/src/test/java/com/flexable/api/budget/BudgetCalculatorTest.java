package com.flexable.api.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.common.TxType;

class BudgetCalculatorTest {

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static Instant at(String local) {
		return java.time.LocalDateTime.parse(local).atZone(SEOUL).toInstant();
	}

	@Test
	void nextPaydayIsStrictlyAfterToday() {
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 10, 13), 23)).isEqualTo(LocalDate.of(2026, 10, 23));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 10, 23), 23)).isEqualTo(LocalDate.of(2026, 11, 23));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 10, 23), 23)).isEqualTo(LocalDate.of(2026, 10, 23));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 10, 13), 23)).isEqualTo(LocalDate.of(2026, 9, 23));
	}

	@Test
	void day31MeansMonthEnd() {
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 3, 10), 31)).isEqualTo(LocalDate.of(2026, 3, 31));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 4, 10), 31)).isEqualTo(LocalDate.of(2026, 4, 30));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2028, 2, 28), 31)).isEqualTo(LocalDate.of(2028, 2, 29));
	}

	@Test
	void weekendPaydayMovesToMonday() {
		// 2026-10-25 is a Sunday
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 10, 13), 25)).isEqualTo(LocalDate.of(2026, 10, 26));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 10, 25), 25)).isEqualTo(LocalDate.of(2026, 10, 26));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 10, 25), 25)).isEqualTo(LocalDate.of(2026, 9, 25));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 10, 26), 25)).isEqualTo(LocalDate.of(2026, 10, 26));
		// 2026-02-28 is a Saturday, so month-end pay moves into March
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 2, 10), 31)).isEqualTo(LocalDate.of(2026, 3, 2));
		// 2026-10-31 is a Saturday: on Nov 1 the October pay is still ahead
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 11, 1), 31)).isEqualTo(LocalDate.of(2026, 11, 2));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 11, 1), 31)).isEqualTo(LocalDate.of(2026, 9, 30));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 11, 3), 31)).isEqualTo(LocalDate.of(2026, 11, 2));
	}

	@Test
	void fixedExpenseCountedOnlyInsideWindow() {
		LocalDate today = LocalDate.of(2026, 10, 13);
		LocalDate next = LocalDate.of(2026, 10, 25);
		assertThat(BudgetCalculator.occurrences(1, today, next)).isZero();
		assertThat(BudgetCalculator.occurrences(13, today, next)).isEqualTo(1);
		assertThat(BudgetCalculator.occurrences(25, today, next)).isZero();
		// 10/26 ~ 11/25 구간의 1일
		assertThat(BudgetCalculator.occurrences(1, LocalDate.of(2026, 10, 26), LocalDate.of(2026, 11, 25))).isEqualTo(1);
	}

	@Test
	void computesDocumentedExample() {
		// 10/13 10:00 잔액 1,250,000, 수입일 25일, 15일 월세 450,000, 보호 300,000
		var in = new BudgetCalculator.Input(1_250_000, at("2026-10-13T10:00:00"), 25, 0, List.of(15),
				List.of(450_000L), 300_000,
				List.of(new BudgetCalculator.Tx(TxType.EXPENSE, 12_000, at("2026-10-13T12:30:00")),
						new BudgetCalculator.Tx(TxType.EXPENSE, 58_000, at("2026-10-13T09:00:00")),
						new BudgetCalculator.Tx(TxType.INCOME, 30_000, at("2026-10-13T13:00:00"))),
				true);
		TodayResponse r = BudgetCalculator.compute(in, LocalDate.of(2026, 10, 13), SEOUL);

		assertThat(r.daysLeft()).isEqualTo(13); // 10-25 is a Sunday, so pay comes on Monday 10-26
		assertThat(r.estimatedBalance()).isEqualTo(1_250_000 - 12_000 + 30_000); // 09:00 지출은 잔액에 이미 반영
		assertThat(r.reservedFixed()).isEqualTo(450_000);
		assertThat(r.remaining()).isEqualTo(1_268_000 - 450_000 - 300_000);
		assertThat(r.todaySpent()).isEqualTo(70_000);
		assertThat(r.dailyBudget()).isEqualTo((518_000 + 70_000) / 13);
		assertThat(r.todayAvailable()).isEqualTo(588_000 / 13 - 70_000); // 넘은 만큼 음수
		assertThat(r.shortage()).isEqualTo(70_000 - 588_000 / 13);
		assertThat(r.cycleStart()).isEqualTo(LocalDate.of(2026, 9, 25));
		// 10/13(화) ~ 10/18(일) 6일
		assertThat(r.weekDaysLeft()).isEqualTo(6);
		assertThat(r.weekAvailable()).isEqualTo(Math.max(0, r.dailyBudget() * 6 - 70_000));
		assertThat(r.hasTransactions()).isTrue();
	}

	@Test
	void postedFixedExpenseLeavesBalanceButNotDailySpending() {
		// 10/15 월세 450,000이 오늘 0시에 자동 기록됨 → 잔액에서 빠지고, 남겨둘 고정지출·오늘 쓴 돈에는 없다
		var in = new BudgetCalculator.Input(1_250_000, at("2026-10-13T10:00:00"), 25, 0, List.of(15),
				List.of(450_000L), 0,
				List.of(new BudgetCalculator.Tx(TxType.EXPENSE, 450_000, at("2026-10-15T00:00:00"), true),
						new BudgetCalculator.Tx(TxType.EXPENSE, 10_000, at("2026-10-15T12:00:00"))),
				true);
		TodayResponse r = BudgetCalculator.compute(in, LocalDate.of(2026, 10, 15), SEOUL);
		assertThat(r.estimatedBalance()).isEqualTo(1_250_000 - 450_000 - 10_000);
		assertThat(r.reservedFixed()).isZero();
		assertThat(r.remaining()).isEqualTo(790_000);
		assertThat(r.todaySpent()).isEqualTo(10_000);
		assertThat(r.weekSpent()).isEqualTo(10_000);
		assertThat(r.dailyBudget()).isEqualTo(800_000 / 11);
	}

	@Test
	void fixedExpenseNoLongerComesBackAfterItsDay() {
		// 고친 버그: 10/15이 지나면 남겨둘 고정지출에서 빠지면서 잔액에는 그대로 남아 쓸 수 있는 돈이 늘었다
		var before = new BudgetCalculator.Input(1_000_000, at("2026-10-13T10:00:00"), 25, 0, List.of(15),
				List.of(450_000L), 0, List.of(), false);
		var after = new BudgetCalculator.Input(1_000_000, at("2026-10-13T10:00:00"), 25, 0, List.of(15),
				List.of(450_000L), 0,
				List.of(new BudgetCalculator.Tx(TxType.EXPENSE, 450_000, at("2026-10-15T00:00:00"), true)), true);
		assertThat(BudgetCalculator.compute(before, LocalDate.of(2026, 10, 14), SEOUL).remaining()).isEqualTo(550_000);
		assertThat(BudgetCalculator.compute(after, LocalDate.of(2026, 10, 16), SEOUL).remaining()).isEqualTo(550_000);
	}

	@Test
	void weekStopsBeforePayday() {
		// 10/21(수), 수입일 23일(금) → 이번 주는 10/22(목)까지 2일
		var in = new BudgetCalculator.Input(300_000, at("2026-10-21T09:00:00"), 23, 0, List.of(), List.of(), 0,
				List.of(), false);
		TodayResponse r = BudgetCalculator.compute(in, LocalDate.of(2026, 10, 21), SEOUL);
		assertThat(r.daysLeft()).isEqualTo(2);
		assertThat(r.weekDaysLeft()).isEqualTo(2);
		assertThat(r.dailyBudget()).isEqualTo(150_000);
		assertThat(r.weekAvailable()).isEqualTo(300_000);
		assertThat(r.hasTransactions()).isFalse();
	}

	@Test
	void negativeRemainingReportsShortage() {
		var in = new BudgetCalculator.Input(100_000, at("2026-10-13T10:00:00"), 25, 50_000, List.of(20),
				List.of(200_000L), 0, List.of(), false);
		TodayResponse r = BudgetCalculator.compute(in, LocalDate.of(2026, 10, 13), SEOUL);
		assertThat(r.remaining()).isEqualTo(-150_000);
		assertThat(r.dailyBudget()).isZero();
		assertThat(r.todayAvailable()).isZero();
		assertThat(r.shortage()).isEqualTo(150_000);
	}
}
