package com.flexable.api.chat;

import java.time.Duration;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * 모델 호출 전용 스레드. 시간 초과로 버린 호출도 HTTP 읽기 제한까지 스레드를 쥐고 있으므로 수를 제한한다.
 * 다 차면 RejectedExecutionException을 던진다(첫 호출은 CHAT_FAILED, 안내 문장은 서버 기본 문장).
 */
final class ChatModelCalls {

	static final int THREADS = 8;
	static final int QUEUE = 8;

	private final ThreadPoolExecutor pool = new ThreadPoolExecutor(THREADS, THREADS, 30, TimeUnit.SECONDS,
			new ArrayBlockingQueue<>(QUEUE), r -> {
				Thread t = new Thread(r, "chat-model");
				t.setDaemon(true);
				return t;
			});

	/** 기한 안에 모델 답을 받는다. 기한을 넘기면 TimeoutException, 대기열이 차면 RejectedExecutionException. */
	ChatModel.Reply within(Callable<ChatModel.Reply> call, Duration limit) throws TimeoutException {
		Future<ChatModel.Reply> job = pool.submit(call);
		try {
			return job.get(Math.max(1, limit.toMillis()), TimeUnit.MILLISECONDS);
		}
		catch (TimeoutException e) {
			job.cancel(true);
			throw e;
		}
		catch (InterruptedException e) {
			job.cancel(true);
			Thread.currentThread().interrupt();
			throw new ChatModel.Failure("중단됨");
		}
		catch (ExecutionException e) {
			if (e.getCause() instanceof ChatModel.Failure f) {
				throw f;
			}
			if (e.getCause() instanceof RuntimeException re) {
				throw re;
			}
			throw new ChatModel.Failure("모델 호출 오류: " + e.getCause());
		}
	}

	void shutdown() {
		pool.shutdownNow();
	}
}
