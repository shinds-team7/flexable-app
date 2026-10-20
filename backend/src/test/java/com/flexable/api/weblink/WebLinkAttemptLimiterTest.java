package com.flexable.api.weblink;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.flexable.api.common.ApiException;

class WebLinkAttemptLimiterTest {

	static class MutableClock extends Clock {
		Instant now = Instant.parse("2026-10-20T00:00:00Z");

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}
	}

	@Test
	void blocksAfterMaxFailuresUntilWindowPasses() {
		MutableClock clock = new MutableClock();
		WebLinkAttemptLimiter limiter = new WebLinkAttemptLimiter(clock);
		for (int i = 0; i < WebLinkAttemptLimiter.MAX_FAILURES; i++) {
			limiter.check();
			limiter.recordFailure();
		}
		assertThatThrownBy(limiter::check).isInstanceOf(ApiException.class);
		clock.now = clock.now.plus(WebLinkAttemptLimiter.WINDOW).plus(Duration.ofSeconds(1));
		assertThatCode(limiter::check).doesNotThrowAnyException();
	}
}
