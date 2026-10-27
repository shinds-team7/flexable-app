package com.flexable.api.budget;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 요일별 비중(월~일 7개 정수). 하루 예산은 남은 생활비를 오늘~수입일 전날의 요일 비중대로 나눈다.
 * 규칙과 예시는 docs/policies.md §5(tests/policy/day-weights.json).
 */
public final class DayWeights {

	/** EVEN 기본 배분, RECORD 내 기록 기준, WEEKEND 주말 넉넉히, WEEKDAY 평일 넉넉히, CUSTOM 직접 조정 */
	public enum Preset {
		EVEN, RECORD, WEEKEND, WEEKDAY, CUSTOM
	}

	/** 저장된 비중. 설정하지 않았으면 기본 배분. */
	public record Setting(Preset preset, List<Integer> weights) {

		public static final Setting DEFAULT = new Setting(Preset.EVEN, DayWeights.EVEN);
	}

	/**
	 * 내 기록 기준 비중을 낸 기간과 결과. from은 기간 안 첫 기록일(기록이 없으면 null), to는 어제.
	 * days는 지출을 기록한 날 수, weekdays는 기록이 있는 요일 수. 기준에 못 미치면 weights는 null.
	 */
	public record Record(LocalDate from, LocalDate to, int days, int weekdays, List<Integer> weights) {
	}

	static final int MIN = 5;
	static final int MAX = 30;
	static final int MIN_DAYS = 7;
	static final int MIN_WEEKDAYS = 3;
	static final int MONTHS = 3;
	static final List<Integer> EVEN = List.of(14, 14, 14, 14, 14, 14, 14);
	static final List<Integer> WEEKEND = List.of(12, 12, 12, 12, 14, 19, 19);
	static final List<Integer> WEEKDAY = List.of(16, 16, 16, 16, 16, 10, 10);

	private static final MathContext MC = MathContext.DECIMAL128;

	private DayWeights() {
	}

	/** 정해진 비율 프리셋. RECORD·CUSTOM은 사용자마다 달라 null. */
	public static List<Integer> fixed(Preset p) {
		return switch (p) {
			case EVEN -> EVEN;
			case WEEKEND -> WEEKEND;
			case WEEKDAY -> WEEKDAY;
			case RECORD, CUSTOM -> null;
		};
	}

	/** 0=월 … 6=일 */
	static int index(LocalDate d) {
		return d.getDayOfWeek().getValue() - 1;
	}

	/**
	 * spent: 날짜별 직접 기록한 지출 합(고정지출 자동 기록 제외). 오늘 전 최대 3개월, 기간 안 첫 기록일부터 어제까지 본다.
	 * 요일마다 하루 평균 지출(그 요일 지출 합 ÷ 기간 안 그 요일 수)을 비율로 바꾼다.
	 */
	public static Record fromRecords(Map<LocalDate, Long> spent, LocalDate today) {
		LocalDate to = today.minusDays(1);
		LocalDate limit = today.minusMonths(MONTHS);
		LocalDate from = null;
		long[] sums = new long[7];
		int days = 0;
		for (Map.Entry<LocalDate, Long> e : spent.entrySet()) {
			LocalDate d = e.getKey();
			if (d.isBefore(limit) || d.isAfter(to) || e.getValue() <= 0) {
				continue;
			}
			days++;
			sums[index(d)] += e.getValue();
			from = from == null || d.isBefore(from) ? d : from;
		}
		int weekdays = (int) Arrays.stream(sums).filter(s -> s > 0).count();
		if (days < MIN_DAYS || weekdays < MIN_WEEKDAYS) {
			return new Record(from, to, days, weekdays, null);
		}
		int[] counts = new int[7];
		for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
			counts[index(d)]++;
		}
		return new Record(from, to, days, weekdays, share(sums, counts));
	}

	/**
	 * 요일별 하루 평균에 같은 배수를 곱하고 5~30으로 자른 값의 합이 100이 되게 한 뒤 정수로 맞춘다.
	 * 정수는 내림하고 모자란 만큼 소수점이 큰 요일부터(같으면 월요일부터) 1씩 더한다.
	 * 기록이 있는 요일이 3개 이상이면 합 100을 만들 수 있다(30×3 + 5×4 ≥ 100).
	 */
	static List<Integer> share(long[] sums, int[] counts) {
		BigDecimal[] avg = new BigDecimal[7];
		for (int k = 0; k < 7; k++) {
			avg[k] = new BigDecimal(sums[k]).divide(new BigDecimal(counts[k]), MC);
		}
		Integer[] order = { 0, 1, 2, 3, 4, 5, 6 };
		Arrays.sort(order, Comparator.comparing(k -> avg[k]));
		BigDecimal min = BigDecimal.valueOf(MIN);
		BigDecimal max = BigDecimal.valueOf(MAX);
		// 작은 쪽 i개는 5, 큰 쪽 j개는 30에 붙고 나머지는 같은 배수 λ로 비례한다. 맞는 조합을 찾는다.
		for (int i = 0; i < 7; i++) {
			for (int j = 0; i + j < 7; j++) {
				BigDecimal rest = BigDecimal.valueOf(100L - MIN * i - MAX * j);
				BigDecimal freeSum = BigDecimal.ZERO;
				for (int n = i; n < 7 - j; n++) {
					freeSum = freeSum.add(avg[order[n]]);
				}
				if (rest.signum() <= 0 || freeSum.signum() == 0) {
					continue;
				}
				BigDecimal lambda = rest.divide(freeSum, MC);
				BigDecimal[] s = new BigDecimal[7];
				boolean ok = true;
				for (int n = 0; n < 7 && ok; n++) {
					int k = order[n];
					BigDecimal v = avg[k].multiply(lambda, MC);
					if (n < i) {
						ok = v.compareTo(min) <= 0;
						s[k] = min;
					} else if (n >= 7 - j) {
						ok = v.compareTo(max) >= 0;
						s[k] = max;
					} else {
						ok = v.compareTo(min) >= 0 && v.compareTo(max) <= 0;
						s[k] = v;
					}
				}
				if (ok) {
					return round(s);
				}
			}
		}
		throw new IllegalStateException("요일 비중을 맞출 수 없음");
	}

	private static List<Integer> round(BigDecimal[] s) {
		int[] w = new int[7];
		BigDecimal[] frac = new BigDecimal[7];
		int total = 0;
		for (int k = 0; k < 7; k++) {
			BigDecimal floor = s[k].setScale(0, RoundingMode.FLOOR);
			w[k] = floor.intValueExact();
			frac[k] = s[k].subtract(floor);
			total += w[k];
		}
		Integer[] order = { 0, 1, 2, 3, 4, 5, 6 };
		// 정렬은 안정적이라 소수점이 같으면 월요일이 앞선다.
		Arrays.sort(order, Comparator.comparing((Integer k) -> frac[k]).reversed());
		for (int n = 0; total < 100; n++, total++) {
			w[order[n]]++;
		}
		List<Integer> out = new ArrayList<>();
		for (int v : w) {
			out.add(v);
		}
		return List.copyOf(out);
	}

	/** 남은 날(오늘~수입일 전날)의 요일 비중 합에서 요일마다 하루 예산(월~일, 내림). */
	static long[] split(long base, List<Integer> weights, LocalDate today, LocalDate nextPayday) {
		long total = 0;
		for (LocalDate d = today; d.isBefore(nextPayday); d = d.plusDays(1)) {
			total += weights.get(index(d));
		}
		long[] out = new long[7];
		for (int k = 0; k < 7; k++) {
			out[k] = base * weights.get(k) / total;
		}
		return out;
	}

	static String encode(List<Integer> weights) {
		return String.join(",", weights.stream().map(String::valueOf).toList());
	}

	static List<Integer> decode(String s) {
		return Arrays.stream(s.split(",")).map(String::trim).map(Integer::valueOf).toList();
	}
}
