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

	/**
	 * 일정 제안 도구까지 주는 호출. 기본 구현은 도구 없이 위 메서드를 부른다(일정을 모르는 모델/테스트용).
	 *
	 * @param categories 일정에 쓸 수 있는 지출 카테고리 이름
	 */
	default Reply generate(String system, List<Message> messages, List<String> presets, List<String> categories) {
		return generate(system, messages, presets);
	}

	/**
	 * 일정 제안 도구 호출. 금액은 포함하지 않는다(서버가 예측). amount는 사용자가 직접 말했을 때만 있다.
	 *
	 * @param date yyyy-MM-dd(모델이 쓴 그대로, 서버가 검증)
	 */
	record ScheduleCall(String title, String date, String category, Long amount) {
	}

	/** text는 비어 있을 수 있다. proposedPreset·schedule은 모델이 해당 제안 도구를 불렀을 때만 있다. */
    default Reply generate(String system, List<Message> messages, List<String> presets,
            List<String> categories, boolean income) {
        return generate(system, messages, presets, categories);
    }

    record IncomeCall(String target, String operation, String title, String date, String category,
            Long amount, Long payday, String matchDate, Long matchAmount, String matchTitle) { }

    default Reply generate(String system, List<Message> messages, List<String> presets,
            List<String> categories, boolean income, List<String> expenseCategories) {
        return generate(system, messages, presets, categories, income);
    }

    /** 지출 거래 기록(추가·수정) 제안 도구 호출. 값은 서버가 검증한다. */
    record ExpenseCall(String operation, String title, String date, String category, Long amount,
            String matchDate, Long matchAmount, String matchTitle) { }

	record Reply(String text, String proposedPreset, ScheduleCall schedule, IncomeCall income, ExpenseCall expense) {
        public Reply(String text, String proposedPreset, ScheduleCall schedule, IncomeCall income) {
            this(text, proposedPreset, schedule, income, null);
        }

        public Reply(String text, String proposedPreset, ScheduleCall schedule) {
            this(text, proposedPreset, schedule, null);
        }

		public Reply(String text, String proposedPreset) {
			this(text, proposedPreset, null);
		}
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
