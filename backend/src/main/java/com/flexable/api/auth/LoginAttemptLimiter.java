package com.flexable.api.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.stereotype.Component;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

/**
 * 이메일별 로그인 실패 제한(10분 내 5회). 단일 서버 MVP용 메모리 구현.
 * 기록은 Map의 compute 안에서만 읽고 바꿔 정리와 추가가 겹치지 않게 하고, 비면 키를 지운다.
 * 다시 조회되지 않는 이메일도 남지 않도록 WINDOW마다 전체를 한 번 정리한다.
 */
@Component
public class LoginAttemptLimiter {

	static final int MAX_FAILURES = 5;
	static final Duration WINDOW = Duration.ofMinutes(10);

	private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
	private final AtomicReference<Instant> lastSweep;
	private final Clock clock;

	public LoginAttemptLimiter(Clock clock) {
		this.clock = clock;
		this.lastSweep = new AtomicReference<>(clock.instant());
	}

	public void check(String email) {
		Instant now = clock.instant();
		Instant[] blockedSince = new Instant[1];
		failures.computeIfPresent(email, (k, q) -> {
			prune(q, now);
			if (q.size() >= MAX_FAILURES) {
				blockedSince[0] = q.peekFirst();
			}
			return q.isEmpty() ? null : q;
		});
		if (blockedSince[0] != null) {
			long retryAfter = Math.max(1, Duration.between(now, blockedSince[0].plus(WINDOW)).toSeconds());
			throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
					Map.of("retryAfterSeconds", retryAfter));
		}
	}

	public void recordFailure(String email) {
		Instant now = clock.instant();
		failures.compute(email, (k, q) -> {
			Deque<Instant> d = q == null ? new ArrayDeque<>() : q;
			prune(d, now);
			d.addLast(now);
			return d;
		});
		sweepIfDue(now);
	}

	public void reset(String email) {
		failures.remove(email);
	}

	int size() {
		return failures.size();
	}

	private void sweepIfDue(Instant now) {
		Instant last = lastSweep.get();
		if (last.plus(WINDOW).isAfter(now) || !lastSweep.compareAndSet(last, now)) {
			return;
		}
		for (String email : failures.keySet()) {
			failures.computeIfPresent(email, (k, q) -> {
				prune(q, now);
				return q.isEmpty() ? null : q;
			});
		}
	}

	private static void prune(Deque<Instant> q, Instant now) {
		while (!q.isEmpty() && q.peekFirst().plus(WINDOW).isBefore(now)) {
			q.pollFirst();
		}
	}
}
