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
 * 실패 추가를 직렬화해 이메일 수 상한을 지킨다. 상한에서는 기존 기록을 버리지 않고 새 키를 거절한다.
 */
@Component
public class LoginAttemptLimiter {

	static final int MAX_FAILURES = 5;
	static final int MAX_EMAILS = 10_000;
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

	public synchronized void recordFailure(String email) {
		Instant now = clock.instant();
		sweepIfDue(now);
		failures.compute(email, (k, q) -> {
			if (q == null && failures.size() >= MAX_EMAILS) {
				throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
						Map.of("retryAfterSeconds", WINDOW.toSeconds()));
			}
			Deque<Instant> d = q == null ? new ArrayDeque<>() : q;
			prune(d, now);
			// 이미 check를 통과한 동시 요청도 이메일당 기록 상한을 넘기지 않는다.
			if (d.size() < MAX_FAILURES) {
				d.addLast(now);
			}
			return d;
		});
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
		while (!q.isEmpty() && !q.peekFirst().plus(WINDOW).isAfter(now)) {
			q.pollFirst();
		}
	}
}
