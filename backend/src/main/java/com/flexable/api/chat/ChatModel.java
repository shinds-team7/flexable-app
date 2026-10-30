package com.flexable.api.chat;

import java.util.List;

import com.flexable.api.chat.ChatDtos.Message;

/** 대화형 모델 호출. 운영은 Gemini(GeminiChatModel), 테스트는 가짜로 바꾼다. */
public interface ChatModel {

	/**
	 * @param system 시스템 지시(말투·규칙·사용자 예산 요약)
	 * @param messages 오래된 것부터, 마지막은 사용자 메시지
	 * @param presets 제안해도 되는 요일별 배분 프리셋 이름. 비어 있으면 변경 제안 도구를 주지 않는다
	 */
	Reply generate(String system, List<Message> messages, List<String> presets);

	/** text는 비어 있을 수 있다. proposedPreset은 모델이 변경 제안 도구를 불렀을 때만 있다. */
	record Reply(String text, String proposedPreset) {
	}

	/** 모델 응답을 받지 못했거나 형식이 맞지 않을 때 */
	class Failure extends RuntimeException {

		public Failure(String message) {
			super(message);
		}

		public Failure(String message, Throwable cause) {
			super(message, cause);
		}
	}
}
