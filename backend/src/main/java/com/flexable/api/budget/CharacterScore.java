package com.flexable.api.budget;

import java.time.LocalDate;
import java.util.Map;
import java.util.NavigableMap;

/**
 * 캐릭터 단계 점수. 100점이 한 단계: 0~99 Lv.1, 100~199 Lv.2 … 400 Lv.5(최대). 규칙은 docs/API.md "GET /budget/today".
 * 하루 예산을 처음 기록한 날 0점(Lv.1 0%)에서 시작해 어제까지 하루씩 반영한다. 오늘은 내일 반영한다.
 */
public final class CharacterScore {

	/** 예산을 지킨 날 오르는 점수. 승급은 느리게(한 단계에 7일) */
	public static final int UP = 15;

	/** 예산을 넘긴 날 내려가는 점수. 강등은 빠르게(이틀이면 한 단계) */
	public static final int DOWN = 50;

	public static final int MAX = 400;

	/** 한 단계에 필요한 점수 */
	public static final int PER_LEVEL = 100;

	private CharacterScore() {
	}

	/** points: 어제까지 반영한 점수, delta: 어제 하루의 변화(반영한 날이 없으면 0), peak: 지금까지 가장 높았던 점수 */
	public record Result(int points, int delta, int peak) {
	}

	/** 점수의 캐릭터 단계(1~5) */
	public static int level(int points) {
		return Math.min(points, MAX) / PER_LEVEL + 1;
	}

	/** 그날 예산을 지켰는지. 그날까지 하루 예산 기록이 하나도 없으면 false. */
	public static boolean kept(NavigableMap<LocalDate, Long> budgets, Map<LocalDate, Long> spent, LocalDate day) {
		Map.Entry<LocalDate, Long> budget = budgets.floorEntry(day);
		return budget != null && spent.getOrDefault(day, 0L) <= budget.getValue();
	}

	/**
	 * budgets: 날짜별 하루 예산(기록이 없는 날은 그 전 마지막 값). spent: 날짜별 지출 합(고정지출 자동 기록 제외).
	 */
	public static Result compute(NavigableMap<LocalDate, Long> budgets, Map<LocalDate, Long> spent, LocalDate today) {
		if (budgets.isEmpty()) {
			return new Result(0, 0, 0);
		}
		int points = 0;
		int delta = 0;
		int peak = 0;
		for (LocalDate d = budgets.firstKey(); d.isBefore(today); d = d.plusDays(1)) {
			int before = points;
			points = kept(budgets, spent, d) ? Math.min(MAX, points + UP) : Math.max(0, points - DOWN);
			delta = points - before;
			peak = Math.max(peak, points);
		}
		return new Result(points, delta, peak);
	}
}
