package com.flexable.api.chat;

import java.time.LocalDate;
import java.util.List;

import com.flexable.api.budget.DayWeights;

import jakarta.validation.Valid;
import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

	/** 앱이 처리할 수 있는 제안 종류. 모르는 종류의 제안을 받은 옛 앱이 깨지지 않게 앱이 알린 것만 제안한다. */
	public enum Accept {
		SCHEDULE, INCOME
	}

	/** 직전에 제안한 일정. 수정 의견을 줄 때 앱이 함께 보낸다. */
	public record PendingSchedule(
			@NotBlank(message = "일정 제목을 확인해 주세요") @Size(max = 40, message = "일정 제목은 40자 이하여야 해요") String title,
			@NotNull(message = "일정 날짜를 확인해 주세요") LocalDate date,
			@NotNull(message = "카테고리를 확인해 주세요") Long categoryId,
			@Min(value = 1, message = "금액을 확인해 주세요") @Max(value = 999_999_999_999L, message = "금액을 확인해 주세요") Long amount) {
	}

	/** messages는 오래된 것부터, 마지막은 사용자 메시지. 대화는 서버에 저장하지 않는다. */
	public record ChatRequest(
			@NotEmpty(message = "메시지를 입력해 주세요") @Size(max = MAX_MESSAGES, message = "대화가 너무 길어요. 새 대화를 시작해 주세요") List<@NotNull(message = "메시지를 입력해 주세요") @Valid Message> messages,
			Mate mate, @Size(max = 4) List<Accept> accepts, @Valid PendingSchedule pending) {

		public ChatRequest(List<Message> messages, Mate mate) {
			this(messages, mate, null, null);
		}

		boolean accepts(Accept a) {
			return accepts != null && accepts.contains(a);
		}
	}

	public enum ActionType {
		DAY_PRESET, SCHEDULE, INCOME_TRANSACTION, INCOME_SETTINGS
	}

	/** SLOT은 11-06까지 쓰던 시간대 기준으로 지금은 내보내지 않는다(옛 앱 호환으로 값만 남김). */
	public enum Scope {
		SLOT, CATEGORY
	}

	/** 금액 예측 근거: 표본(해당 카테고리 지출이 있던 날) 수, 범위, 기간(일). */
	public record Basis(int samples, Scope scope, int days) {
	}

	/** 이 금액으로 등록했을 때 서버가 가정 계산한 예산. */
	public record Preview(long dayBudget, long dailyBudgetBefore, long dailyBudgetAfter) {
	}

	/** amount·basis·preview가 null이면 기록이 적어 예측하지 못한 것이다(메이트가 금액을 되묻는다). */
	public record ScheduleProposal(String title, LocalDate date, long categoryId, String category, Long amount,
			Basis basis, Preview preview) {
	}

	/**
	 * 확인을 받아야 하는 변경 제안. 서버는 저장하지 않는다. DAY_PRESET은 앱이 확인 후 PUT /budget/day-weights,
	 * SCHEDULE은 POST /scheduled-expenses를 부른다.
	 */
    public enum IncomeOperation { CREATE, UPDATE }
    public enum IncomeField { AMOUNT, DATE, TITLE, CATEGORY }
    public record IncomeTransactionProposal(IncomeOperation operation, Long transactionId, String title,
            LocalDate date, long categoryId, String category, long amount, List<IncomeField> changes) { }
    public record IncomeSettingsProposal(long incomeAmount, int payday, long expectedIncomeAmount,
            int expectedPayday) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
	public record ChatAction(ActionType type, DayWeights.Preset preset, String label, ScheduleProposal schedule,
            IncomeTransactionProposal incomeTransaction, IncomeSettingsProposal incomeSettings) {
        public ChatAction(ActionType type, DayWeights.Preset preset, String label, ScheduleProposal schedule) {
            this(type, preset, label, schedule, null, null);
        }

		public ChatAction(ActionType type, DayWeights.Preset preset, String label) {
			this(type, preset, label, null);
		}
	}

	public record ChatResponse(String reply, ChatAction action) {
	}
}
