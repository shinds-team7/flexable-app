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
 * 실패 기록 확인·추가·정리는 같은 잠금 안에서 처리한다. 비밀번호 확인 전 기록 공간을 예약한다.
 * 다시 조회되지 않는 이메일도 남지 않도록 WINDOW마다 전체를 한 번 정리한다.
 * 실패 추가를 직렬화해 이메일 수 상한을 지킨다. 상한에서는 기존 기록을 버리지 않고 새 키를 거절한다.
 */
@Component
public class LoginAttemptLimiter {

	static final int MAX_FAILURES = 5;
	static final int MAX_EMAILS = 10_000;
	static final Duration WINDOW = Duration.ofMinutes(10);

	private static final class History {
		final Deque<Instant> failures = new ArrayDeque<>();
		Instant reservedAt;

		History(Instant reservedAt) {
			this.reservedAt = reservedAt;
		}

		Instant nextExpiry() {
			return (failures.isEmpty() ? reservedAt : failures.peekFirst()).plus(WINDOW);
		}
	}

	private final Map<String, History> failures = new ConcurrentHashMap<>();
	private final AtomicReference<Instant> lastSweep;
	private Instant capacityRetryAt;
	private final Clock clock;

	public LoginAttemptLimiter(Clock clock) {
		this.clock = clock;
		this.lastSweep = new AtomicReference<>(clock.instant());
	}

	public synchronized void check(String email) {
		Instant now = clock.instant();
		sweepIfDue(now);
		Instant[] blockedSince = new Instant[1];
		failures.computeIfPresent(email, (k, history) -> {
			prune(history.failures, now);
			if (history.failures.size() >= MAX_FAILURES) {
				blockedSince[0] = history.failures.peekFirst();
			}
			return expired(history, now) ? null : history;
		});
		ensureCapacity(email, now);
		if (blockedSince[0] != null) {
			long retryAfter = Math.max(1, Duration.between(now, blockedSince[0].plus(WINDOW)).toSeconds());
			throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
					Map.of("retryAfterSeconds", retryAfter));
		}
		// 비밀번호 확인 전에 자리를 예약해, 다른 이메일이 들어와도 실패 기록 공간을 보장한다.
		failures.computeIfAbsent(email, k -> new History(now)).reservedAt = now;
	}

	public synchronized void recordFailure(String email) {
		Instant now = clock.instant();
		sweepIfDue(now);
		ensureCapacity(email, now);
		failures.compute(email, (k, history) -> {
			History h = history == null ? new History(now) : history;
			prune(h.failures, now);
			// 이미 check를 통과한 동시 요청도 이메일당 기록 상한을 넘기지 않는다.
			if (h.failures.size() < MAX_FAILURES) {
				h.failures.addLast(now);
			}
			return h;
		});
	}

	public void reset(String email) {
		failures.remove(email);
	}

	int size() {
		return failures.size();
	}

	// check와 recordFailure의 잠금 안에서만 호출한다. 새 이메일은 비밀번호 확인 전에도 차단한다.
	private void ensureCapacity(String email, Instant now) {
		if (failures.containsKey(email) || failures.size() < MAX_EMAILS) {
			return;
		}
		// 상한에서는 정리 주기와 무관하게 만료 기록을 회수한다. 다음 만료 전 반복 전체 순회는 피한다.
		if (capacityRetryAt == null || !capacityRetryAt.isAfter(now)) {
			sweep(now);
		}
		if (failures.size() >= MAX_EMAILS) {
			long retryAfter = Math.max(1, Duration.between(now, capacityRetryAt).toSeconds());
			throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
					Map.of("retryAfterSeconds", retryAfter));
		}
	}

	private void sweepIfDue(Instant now) {
		Instant last = lastSweep.get();
		if (last.plus(WINDOW).isAfter(now) || !lastSweep.compareAndSet(last, now)) {
			return;
		}
		sweep(now);
	}

	private void sweep(Instant now) {
		for (String email : failures.keySet()) {
			failures.computeIfPresent(email, (k, history) -> {
				prune(history.failures, now);
				return expired(history, now) ? null : history;
			});
		}
		capacityRetryAt = failures.values().stream().map(History::nextExpiry)
			.min(Instant::compareTo).orElse(null);
	}

	private static boolean expired(History history, Instant now) {
		return history.failures.isEmpty() && !history.nextExpiry().isAfter(now);
	}

	private static void prune(Deque<Instant> q, Instant now) {
		while (!q.isEmpty() && !q.peekFirst().plus(WINDOW).isAfter(now)) {
			q.pollFirst();
		}
	}
}
