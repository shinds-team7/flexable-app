package com.flexable.api.weblink;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

/**
 * 웹 서버가 보내는 연동 코드 실패를 서비스 전체로 센다(10분 내 30회). 웹 사용자별 제한은 웹 서버가 한다.
 * 코드 추측을 막는 마지막 장치라 사용자 구분 없이 한 줄로 센다. 단일 서버 MVP용 메모리 구현.
 */
@Component
public class WebLinkAttemptLimiter {

	static final int MAX_FAILURES = 30;
	static final Duration WINDOW = Duration.ofMinutes(10);

	private final Deque<Instant> failures = new ArrayDeque<>();
	private final Clock clock;

	public WebLinkAttemptLimiter(Clock clock) {
		this.clock = clock;
	}

	public synchronized void check() {
		Instant now = clock.instant();
		prune(now);
		if (failures.size() >= MAX_FAILURES) {
			long retryAfter = Math.max(1, Duration.between(now, failures.peekFirst().plus(WINDOW)).toSeconds());
			throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, ErrorCode.TOO_MANY_ATTEMPTS.message(),
					Map.of("retryAfterSeconds", retryAfter));
		}
	}

	public synchronized void recordFailure() {
		Instant now = clock.instant();
		prune(now);
		failures.addLast(now);
	}

	private void prune(Instant now) {
		while (!failures.isEmpty() && failures.peekFirst().plus(WINDOW).isBefore(now)) {
			failures.pollFirst();
		}
	}
}
