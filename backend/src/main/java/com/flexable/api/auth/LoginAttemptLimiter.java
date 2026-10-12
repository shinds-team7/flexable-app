package com.flexable.api.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

/** 이메일별 로그인 실패 제한(10분 내 5회). 단일 서버 MVP용 메모리 구현. */
@Component
public class LoginAttemptLimiter {

	static final int MAX_FAILURES = 5;
	static final Duration WINDOW = Duration.ofMinutes(10);

	private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
	private final Clock clock;

	public LoginAttemptLimiter(Clock clock) {
		this.clock = clock;
	}

	public void check(String email) {
		Deque<Instant> q = failures.get(email);
		if (q == null) {
			return;
		}
		synchronized (q) {
			Instant now = clock.instant();
			prune(q, now);
			if (q.size() >= MAX_FAILURES) {
				long retryAfter = Math.max(1, Duration.between(now, q.peekFirst().plus(WINDOW)).toSeconds());
				throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
						Map.of("retryAfterSeconds", retryAfter));
			}
		}
	}

	public void recordFailure(String email) {
		Deque<Instant> q = failures.computeIfAbsent(email, k -> new ArrayDeque<>());
		synchronized (q) {
			Instant now = clock.instant();
			prune(q, now);
			q.addLast(now);
		}
	}

	public void reset(String email) {
		failures.remove(email);
	}

	private void prune(Deque<Instant> q, Instant now) {
		while (!q.isEmpty() && q.peekFirst().plus(WINDOW).isBefore(now)) {
			q.pollFirst();
		}
	}
}
