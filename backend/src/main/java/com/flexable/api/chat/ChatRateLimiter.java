package com.flexable.api.chat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

/**
 * 사용자별 AI 메이트 호출 제한(1시간 30번). 모델 호출 비용을 막는 단일 서버용 메모리 구현.
 * 사용자가 많아지면 WINDOW마다 지난 기록을 한 번에 지운다.
 */
@Component
public class ChatRateLimiter {

	static final int MAX_CALLS = 30;
	static final Duration WINDOW = Duration.ofHours(1);

	private final Map<Long, Deque<Instant>> calls = new HashMap<>();
	private final Clock clock;
	private Instant lastSweep;

	public ChatRateLimiter(Clock clock) {
		this.clock = clock;
		this.lastSweep = clock.instant();
	}

	public synchronized void acquire(long userId) {
		Instant now = clock.instant();
		if (!lastSweep.plus(WINDOW).isAfter(now)) {
			calls.values().forEach(q -> prune(q, now));
			calls.values().removeIf(Deque::isEmpty);
			lastSweep = now;
		}
		Deque<Instant> q = calls.computeIfAbsent(userId, k -> new ArrayDeque<>());
		prune(q, now);
		if (q.size() >= MAX_CALLS) {
			long retryAfter = Math.max(1, Duration.between(now, q.peekFirst().plus(WINDOW)).toSeconds());
			throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
					Map.of("retryAfterSeconds", retryAfter));
		}
		q.addLast(now);
	}

	private static void prune(Deque<Instant> q, Instant now) {
		while (!q.isEmpty() && !q.peekFirst().plus(WINDOW).isAfter(now)) {
			q.pollFirst();
		}
	}
}
