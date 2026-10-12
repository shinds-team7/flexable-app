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
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 10, 13), 25)).isEqualTo(LocalDate.of(2026, 10, 25));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 10, 25), 25)).isEqualTo(LocalDate.of(2026, 11, 25));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 10, 25), 25)).isEqualTo(LocalDate.of(2026, 10, 25));
		assertThat(BudgetCalculator.previousPayday(LocalDate.of(2026, 10, 13), 25)).isEqualTo(LocalDate.of(2026, 9, 25));
	}

	@Test
	void day31MeansMonthEnd() {
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2027, 2, 10), 31)).isEqualTo(LocalDate.of(2027, 2, 28));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2028, 2, 28), 31)).isEqualTo(LocalDate.of(2028, 2, 29));
		assertThat(BudgetCalculator.nextPayday(LocalDate.of(2026, 1, 31), 31)).isEqualTo(LocalDate.of(2026, 2, 28));
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

		assertThat(r.daysLeft()).isEqualTo(12);
		assertThat(r.estimatedBalance()).isEqualTo(1_250_000 - 12_000 + 30_000); // 09:00 지출은 잔액에 이미 반영
		assertThat(r.reservedFixed()).isEqualTo(450_000);
		assertThat(r.remaining()).isEqualTo(1_268_000 - 450_000 - 300_000);
		assertThat(r.todaySpent()).isEqualTo(70_000);
		assertThat(r.dailyBudget()).isEqualTo((518_000 + 70_000) / 12);
		assertThat(r.todayAvailable()).isEqualTo(49_000 - 70_000 < 0 ? 0 : 49_000 - 70_000);
		assertThat(r.shortage()).isEqualTo(70_000 - 49_000);
		assertThat(r.cycleStart()).isEqualTo(LocalDate.of(2026, 9, 25));
		// 10/13(화) ~ 10/18(일) 6일
		assertThat(r.weekDaysLeft()).isEqualTo(6);
		assertThat(r.weekAvailable()).isEqualTo(Math.max(0, r.dailyBudget() * 6 - 70_000));
		assertThat(r.hasTransactions()).isTrue();
	}

	@Test
	void weekStopsBeforePayday() {
		// 10/22(목), 수입일 25일 → 이번 주는 10/24(토)까지 3일
		var in = new BudgetCalculator.Input(300_000, at("2026-10-22T09:00:00"), 25, 0, List.of(), List.of(), 0,
				List.of(), false);
		TodayResponse r = BudgetCalculator.compute(in, LocalDate.of(2026, 10, 22), SEOUL);
		assertThat(r.daysLeft()).isEqualTo(3);
		assertThat(r.weekDaysLeft()).isEqualTo(3);
		assertThat(r.dailyBudget()).isEqualTo(100_000);
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
