package com.flexable.api.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;

import org.junit.jupiter.api.Test;

class CharacterScoreTest {

	private static final LocalDate D1 = LocalDate.of(2026, 10, 1);

	@Test
	void startsAtZeroOnFirstDay() {
		var budgets = new TreeMap<>(Map.of(D1, 30_000L));
		assertThat(CharacterScore.compute(budgets, Map.of(), D1)).isEqualTo(new CharacterScore.Result(0, 0));
		assertThat(CharacterScore.compute(new TreeMap<>(), Map.of(), D1)).isEqualTo(new CharacterScore.Result(0, 0));
	}

	@Test
	void keptDaysRaiseSlowlyAndOverspentDaysDropFast() {
		var budgets = new TreeMap<>(Map.of(D1, 30_000L));
		Map<LocalDate, Long> spent = new HashMap<>();
		spent.put(D1, 30_000L); // 딱 맞게 쓴 날도 지킨 날
		spent.put(D1.plusDays(1), 10_000L);
		spent.put(D1.plusDays(2), 30_001L);
		assertThat(CharacterScore.compute(budgets, spent, D1.plusDays(2))).isEqualTo(new CharacterScore.Result(30, 15));
		assertThat(CharacterScore.compute(budgets, spent, D1.plusDays(3))).isEqualTo(new CharacterScore.Result(0, -30));
	}

	@Test
	void missingDaysUseLastKnownBudget() {
		// 10/1 예산 30,000만 기록, 10/3은 앱을 안 열었지만 40,000을 써서 넘긴 날. 10/4부터 예산 50,000
		var budgets = new TreeMap<>(Map.of(D1, 30_000L, D1.plusDays(3), 50_000L));
		Map<LocalDate, Long> spent = Map.of(D1.plusDays(2), 40_000L, D1.plusDays(3), 40_000L);
		assertThat(CharacterScore.compute(budgets, spent, D1.plusDays(2)).points()).isEqualTo(30);
		assertThat(CharacterScore.compute(budgets, spent, D1.plusDays(3)).points()).isZero();
		assertThat(CharacterScore.compute(budgets, spent, D1.plusDays(4))).isEqualTo(new CharacterScore.Result(15, 15));
	}

	@Test
	void capsAtMaxLevel() {
		var budgets = new TreeMap<>(Map.of(D1, 30_000L));
		var r = CharacterScore.compute(budgets, Map.of(), D1.plusDays(40));
		assertThat(r.points()).isEqualTo(CharacterScore.MAX);
		assertThat(r.delta()).isZero();
	}
}
