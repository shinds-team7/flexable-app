package com.flexable.api.errorlog;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 오류 기록의 입구. 기록이 실패해도 원래 요청·응답에는 영향을 주지 않는다(예외를 삼키고 로그만 남긴다).
 * 앱 보고는 보낸 사람(회원 또는 비로그인 묶음)마다 10분에 30건까지만 받는다(단일 서버용 메모리 구현).
 */
@Component
public class ErrorRecorder {

	static final int MAX_REPORTS = 30;
	static final Duration WINDOW = Duration.ofMinutes(10);

	private static final Logger log = LoggerFactory.getLogger(ErrorRecorder.class);

	private final ErrorEventService service;
	private final Clock clock;
	private final Map<String, Deque<Instant>> recent = new HashMap<>();
	private Instant lastSweep;

	public ErrorRecorder(ErrorEventService service, Clock clock) {
		this.service = service;
		this.clock = clock;
		this.lastSweep = clock.instant();
	}

	/** 앱이 보낸 오류. 한도를 넘으면 저장하지 않고 true를 돌려주지 않는다. */
	public boolean fromApp(ErrorReport report) {
		if (!allow(report.userId() == null ? "anonymous" : "user:" + report.userId())) {
			return false;
		}
		save(report);
		return true;
	}

	/** 서버에서 난 500. 한도 없이 저장한다(같은 오류는 하루 한 줄로 묶인다). */
	public void fromServer(ErrorReport report) {
		save(report);
	}

	private void save(ErrorReport report) {
		try {
			service.record(report);
		}
		catch (RuntimeException e) {
			log.warn("오류 기록 저장 실패: {}", e.toString());
		}
	}

	private synchronized boolean allow(String key) {
		Instant now = clock.instant();
		if (!lastSweep.plus(WINDOW).isAfter(now)) {
			recent.values().forEach(q -> prune(q, now));
			recent.values().removeIf(Deque::isEmpty);
			lastSweep = now;
		}
		Deque<Instant> q = recent.computeIfAbsent(key, k -> new ArrayDeque<>());
		prune(q, now);
		if (q.size() >= MAX_REPORTS) {
			return false;
		}
		q.addLast(now);
		return true;
	}

	private static void prune(Deque<Instant> q, Instant now) {
		while (!q.isEmpty() && !q.peekFirst().plus(WINDOW).isAfter(now)) {
			q.pollFirst();
		}
	}
}
