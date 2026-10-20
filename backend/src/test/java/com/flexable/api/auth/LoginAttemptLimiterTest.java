package com.flexable.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

class LoginAttemptLimiterTest {

	static class MutableClock extends Clock {
		Instant now = Instant.parse("2026-10-16T00:00:00Z");

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

		void advance(java.time.Duration d) {
			now = now.plus(d);
		}
	}

	private final MutableClock clock = new MutableClock();
	private final LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock);

	@Test
	void blocksAfterMaxFailuresAndReleasesAfterWindow() {
		for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
			limiter.check("a@example.com");
			limiter.recordFailure("a@example.com");
		}
		assertThatThrownBy(() -> limiter.check("a@example.com")).isInstanceOf(ApiException.class);
		clock.advance(LoginAttemptLimiter.WINDOW.plusSeconds(1));
		limiter.check("a@example.com");
		assertThat(limiter.size()).isZero();
	}

	@Test
	void expiredKeysAreSweptEvenIfNeverQueriedAgain() {
		for (int i = 0; i < 10_000; i++) {
			limiter.recordFailure("missing-" + i + "@example.invalid");
		}
		assertThat(limiter.size()).isEqualTo(10_000);
		clock.advance(LoginAttemptLimiter.WINDOW.plusSeconds(1));
		// 다른 이메일의 실패 한 번이 주기 정리를 일으킨다. 예전 키는 다시 조회하지 않는다.
		limiter.recordFailure("fresh@example.com");
		assertThat(limiter.size()).isEqualTo(1);
	}

	@Test
	void sweepKeepsKeysStillInsideTheWindow() {
		for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
			limiter.recordFailure("old@example.com");
		}
		clock.advance(LoginAttemptLimiter.WINDOW.minusMinutes(1));
		for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
			limiter.recordFailure("recent@example.com");
		}
		clock.advance(java.time.Duration.ofMinutes(2));
		limiter.recordFailure("trigger@example.com");
		assertThat(limiter.size()).isEqualTo(2);
		assertThatThrownBy(() -> limiter.check("recent@example.com")).isInstanceOf(ApiException.class);
		limiter.check("old@example.com");
	}

	@Test
	void concurrentFailuresAreAllCounted() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(8);
		CountDownLatch start = new CountDownLatch(1);
		try {
			for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
				pool.submit(() -> {
					start.await();
					limiter.recordFailure("race@example.com");
					return null;
				});
			}
			start.countDown();
		}
		finally {
			pool.shutdown();
			assertThat(pool.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
		}
		assertThatThrownBy(() -> limiter.check("race@example.com")).isInstanceOf(ApiException.class);
	}

	@Test
	void capacityRejectsNewKeysWithoutEvictingBlockedEmails() {
		for (int i = 0; i < 10_000; i++) {
			limiter.recordFailure("full-" + i + "@example.invalid");
		}
		for (int i = 1; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
			limiter.recordFailure("full-0@example.invalid");
		}
		assertThatThrownBy(() -> limiter.recordFailure("overflow@example.invalid"))
			.isInstanceOfSatisfying(ApiException.class, ex -> {
				assertThat(ex.code()).isEqualTo(ErrorCode.TOO_MANY_ATTEMPTS);
				assertThat(((Number) ex.extra().get("retryAfterSeconds")).longValue()).isPositive();
			});
		assertThat(limiter.size()).isEqualTo(10_000);
		assertThatThrownBy(() -> limiter.check("full-0@example.invalid")).isInstanceOf(ApiException.class);
		// A full store must still allow credential checks and successful-login resets.
		limiter.check("valid@example.invalid");
		limiter.reset("full-1@example.invalid");
		limiter.recordFailure("new@example.invalid");
		assertThat(limiter.size()).isEqualTo(10_000);
	}

	@Test
	void capacityIsReleasedAtWindowBoundary() {
		for (int i = 0; i < 10_000; i++) {
			limiter.recordFailure("expired-" + i + "@example.invalid");
		}
		clock.advance(LoginAttemptLimiter.WINDOW);
		limiter.recordFailure("fresh@example.invalid");
		assertThat(limiter.size()).isEqualTo(1);
	}

	@Test
	void inFlightFailuresCannotExtendAnAlreadyFullQueue() {
		for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
			limiter.recordFailure("in-flight@example.invalid");
		}
		clock.advance(java.time.Duration.ofMinutes(1));
		// Requests that passed check before the fifth failure can finish later.
		for (int i = 0; i < 100; i++) {
			limiter.recordFailure("in-flight@example.invalid");
		}
		clock.advance(LoginAttemptLimiter.WINDOW.minusMinutes(1));
		limiter.check("in-flight@example.invalid");
		assertThat(limiter.size()).isZero();
	}

	@Test
	void concurrentNewEmailsCannotExceedCapacity() throws Exception {
		for (int i = 0; i < 9_999; i++) {
			limiter.recordFailure("existing-" + i + "@example.invalid");
		}
		ExecutorService pool = Executors.newFixedThreadPool(8);
		CountDownLatch start = new CountDownLatch(1);
		List<Future<Boolean>> results = new ArrayList<>();
		try {
			for (int i = 0; i < 32; i++) {
				String email = "race-" + i + "@example.invalid";
				results.add(pool.submit(() -> {
					start.await();
					try {
						limiter.recordFailure(email);
						return true;
					}
					catch (ApiException ex) {
						assertThat(ex.code()).isEqualTo(ErrorCode.TOO_MANY_ATTEMPTS);
						return false;
					}
				}));
			}
			start.countDown();
			int accepted = 0;
			for (Future<Boolean> result : results) {
				if (result.get(5, TimeUnit.SECONDS)) accepted++;
			}
			assertThat(accepted).isEqualTo(1);
			assertThat(limiter.size()).isEqualTo(10_000);
		}
		finally {
			start.countDown();
			pool.shutdownNow();
			assertThat(pool.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
		}
	}

	@Test
	void resetRemovesTheKey() {
		limiter.recordFailure("ok@example.com");
		limiter.reset("ok@example.com");
		assertThat(limiter.size()).isZero();
	}
}
