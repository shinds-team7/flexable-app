package com.flexable.api.budget;

import java.time.LocalDate;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;

/**
 * 캐릭터 단계 점수. 100점이 한 단계, 6단계: 0~99 Lv.1(광부), 100~199 Lv.2(농부), 200~299 Lv.3(상인), 300~399 Lv.4(기사), 400~499 Lv.5(귀족), 500 Lv.6(왕족, 최대). 규칙과 예시는 docs/policies.md §4(tests/policy/character.json).
 * 점수는 저장하지 않고 기록에서 매번 다시 계산하므로, 단계를 늘릴 때 MAX만 올리면 그동안의 기록대로 점수가 돌아온다.
 * 하루 예산을 처음 기록한 날 0점(Lv.1 0%)에서 시작해 어제까지 하루씩 반영한다. 오늘은 내일 반영한다.
 */
public final class CharacterScore {

	/** 예산을 지킨 날 오르는 점수 */
	public static final int UP = 20;

	/** 그날 출석만 해도 오르는 점수(예산을 지켰는지와 따로 더한다) */
	public static final int ATTEND = 10;

	/** 예산을 넘긴 날 내려가는 점수. 출석한 날이면 출석 점수를 더한 뒤라 순변화는 -40 */
	public static final int DOWN = 50;

	/** 6단계까지(11-05). 3단계(200)로 줄였던 것(10-22)을 다시 늘렸다 */
	public static final int MAX = 500;

	/** 한 단계에 필요한 점수 */
	public static final int PER_LEVEL = 100;

	private CharacterScore() {
	}

	/** points: 어제까지 반영한 점수, delta: 어제 하루의 변화(반영한 날이 없으면 0), peak: 지금까지 가장 높았던 점수 */
	public record Result(int points, int delta, int peak) {
	}

	/** 점수의 캐릭터 단계(1~6) */
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
	 * attended: 출석한 날짜. 출석한 날은 예산 결과와 상관없이 ATTEND를 더하고, 지키면 UP을 더하고 넘기면 DOWN을 뺀다(0~MAX로 자름).
	 */
	public static Result compute(NavigableMap<LocalDate, Long> budgets, Map<LocalDate, Long> spent, Set<LocalDate> attended,
			LocalDate today) {
		if (budgets.isEmpty()) {
			return new Result(0, 0, 0);
		}
		int points = 0;
		int delta = 0;
		int peak = 0;
		for (LocalDate d = budgets.firstKey(); d.isBefore(today); d = d.plusDays(1)) {
			int before = points;
			int change = (attended.contains(d) ? ATTEND : 0) + (kept(budgets, spent, d) ? UP : -DOWN);
			points = Math.max(0, Math.min(MAX, points + change));
			delta = points - before;
			peak = Math.max(peak, points);
		}
		return new Result(points, delta, peak);
	}
}
