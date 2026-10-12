package com.flexable.api.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/** 양 끝을 포함하는 날짜 구간(최대 366일). */
public record DateRange(LocalDate from, LocalDate to) {

	public static final int MAX_DAYS = 366;

	public static DateRange of(LocalDate from, LocalDate to) {
		if (to.isBefore(from)) {
			throw ApiException.invalid("to", "끝 날짜가 시작 날짜보다 빨라요");
		}
		if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
			throw ApiException.invalid("to", "기간은 최대 366일까지 조회할 수 있어요");
		}
		return new DateRange(from, to);
	}

	public Instant startInstant(ZoneId zone) {
		return from.atStartOfDay(zone).toInstant();
	}

	/** 끝 날짜 다음 날 0시(배타) */
	public Instant endInstantExclusive(ZoneId zone) {
		return to.plusDays(1).atStartOfDay(zone).toInstant();
	}
}
