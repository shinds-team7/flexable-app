package com.flexable.api.common;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public final class Times {

	private Times() {
	}

	public static OffsetDateTime at(Instant instant, ZoneId zone) {
		return instant == null ? null : instant.atZone(zone).toOffsetDateTime();
	}
}
