package com.flexable.api.budget;

import java.time.LocalDate;
import java.util.Set;

/**
 * 수입일을 미루는 관공서 공휴일(대체공휴일 포함). 출처는 우주항공청 월력요항.
 * 2026-11-01 이전 공휴일은 일부러 넣지 않는다: 이미 지난 수입일이 바뀌면 진행 중인 주기와
 * 반영이 끝난 시드머니 주기(seed_money_entries.cycle_end)가 어긋난다.
 * 다음 해 월력요항이 나오면(매년 6월쯤) 그해 공휴일을 더한다. 목록이 끝난 뒤에는 토·일만 미룬다.
 */
final class PublicHolidays {

	private PublicHolidays() {
	}

	private static final Set<LocalDate> DATES = Set.of(
			LocalDate.of(2026, 12, 25),
			// 2027 월력요항: 노동절·제헌절 포함(2026년부터 공휴일), 대체공휴일 7일
			LocalDate.of(2027, 1, 1),
			LocalDate.of(2027, 2, 6), LocalDate.of(2027, 2, 7), LocalDate.of(2027, 2, 8), LocalDate.of(2027, 2, 9),
			LocalDate.of(2027, 3, 1),
			LocalDate.of(2027, 5, 1), LocalDate.of(2027, 5, 3),
			LocalDate.of(2027, 5, 5),
			LocalDate.of(2027, 5, 13),
			LocalDate.of(2027, 6, 6),
			LocalDate.of(2027, 7, 17), LocalDate.of(2027, 7, 19),
			LocalDate.of(2027, 8, 15), LocalDate.of(2027, 8, 16),
			LocalDate.of(2027, 9, 14), LocalDate.of(2027, 9, 15), LocalDate.of(2027, 9, 16),
			LocalDate.of(2027, 10, 3), LocalDate.of(2027, 10, 4),
			LocalDate.of(2027, 10, 9), LocalDate.of(2027, 10, 11),
			LocalDate.of(2027, 12, 25), LocalDate.of(2027, 12, 27),
			// 2028: 월력요항 발표 전, 한국천문연구원 역서 자료(2028)로 넣었다. 국회의원선거일 포함, 대체공휴일 1일(추석·개천절 겹침).
			// 월력요항이 나오면(2027년 6월쯤) 대조하고 임시공휴일을 더한다.
			LocalDate.of(2028, 1, 1),
			LocalDate.of(2028, 1, 26), LocalDate.of(2028, 1, 27), LocalDate.of(2028, 1, 28),
			LocalDate.of(2028, 3, 1),
			LocalDate.of(2028, 4, 12),
			LocalDate.of(2028, 5, 1), LocalDate.of(2028, 5, 2),
			LocalDate.of(2028, 5, 5),
			LocalDate.of(2028, 6, 6),
			LocalDate.of(2028, 7, 17),
			LocalDate.of(2028, 8, 15),
			LocalDate.of(2028, 10, 2), LocalDate.of(2028, 10, 3), LocalDate.of(2028, 10, 4), LocalDate.of(2028, 10, 5),
			LocalDate.of(2028, 10, 9),
			LocalDate.of(2028, 12, 25));

	static boolean contains(LocalDate d) {
		return DATES.contains(d);
	}
}
