package com.flexable.api.chat;

import java.util.List;

import com.flexable.api.budget.DayWeights;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class ChatDtos {

	static final int MAX_MESSAGES = 20;
	static final int MAX_TEXT = 1000;

	private ChatDtos() {
	}

	public enum Role {
		USER, MODEL
	}

	/** 말투. 앱의 메이트 선택(똑똑한 분석가·다정한 친구·따끔한 조언가) */
	public enum Mate {
		ANALYST, FRIEND, COACH
	}

	public record Message(
			@NotNull(message = "보낸 사람을 확인해 주세요") Role role,
			@NotBlank(message = "메시지를 입력해 주세요") @Size(max = MAX_TEXT, message = "메시지는 1000자 이하로 입력해 주세요") String text) {
	}

	/** messages는 오래된 것부터, 마지막은 사용자 메시지. 대화는 서버에 저장하지 않는다. */
	public record ChatRequest(
			@NotEmpty(message = "메시지를 입력해 주세요") @Size(max = MAX_MESSAGES, message = "대화가 너무 길어요. 새 대화를 시작해 주세요") List<@NotNull(message = "메시지를 입력해 주세요") @Valid Message> messages,
			Mate mate) {
	}

	public enum ActionType {
		DAY_PRESET
	}

	/** 확인을 받아야 하는 변경 제안. 서버는 저장하지 않고, 앱이 확인 후 PUT /budget/day-weights를 부른다. */
	public record ChatAction(ActionType type, DayWeights.Preset preset, String label) {
	}

	public record ChatResponse(String reply, ChatAction action) {
	}
}
