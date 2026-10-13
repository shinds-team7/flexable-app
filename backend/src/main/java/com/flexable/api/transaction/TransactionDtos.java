package com.flexable.api.transaction;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.flexable.api.category.CategoryDtos.CategoryRef;
import com.flexable.api.common.Times;
import com.flexable.api.common.TxType;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class TransactionDtos {

	static final long MAX_AMOUNT = 999_999_999_999L;

	private TransactionDtos() {
	}

	public record CreateRequest(
			@NotNull(message = "지출·수입 중 하나를 골라 주세요") TxType type,
			@NotNull(message = "금액을 입력해 주세요") @Min(value = 1, message = "금액은 1원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long amount,
			@NotNull(message = "카테고리를 골라 주세요") Long categoryId,
			@NotNull(message = "내용을 입력해 주세요") @Size(min = 1, max = 40, message = "내용은 40자 이하로 입력해 주세요") String title,
			@Size(max = 200, message = "메모는 200자 이하로 입력해 주세요") String memo,
			OffsetDateTime occurredAt) {
	}

	/** PATCH: 보낸 필드만 바꾼다. memo는 null을 보내면 지운다. */
	public static final class UpdateRequest {

		public TxType type;

		@Min(value = 1, message = "금액은 1원 이상이어야 해요")
		@Max(value = MAX_AMOUNT, message = "금액이 너무 커요")
		public Long amount;

		public Long categoryId;

		@Size(min = 1, max = 40, message = "내용은 40자 이하로 입력해 주세요")
		public String title;

		@Size(max = 200, message = "메모는 200자 이하로 입력해 주세요")
		public String memo;

		public OffsetDateTime occurredAt;

		boolean memoSet;

		@JsonSetter("memo")
		public void setMemo(String memo) {
			this.memo = memo;
			this.memoSet = true;
		}
	}

	public record TransactionResponse(Long id, TxType type, long amount, Long categoryId, CategoryRef category,
			String title, String memo, OffsetDateTime occurredAt, OffsetDateTime createdAt, boolean fromFixed) {

		static TransactionResponse of(Transaction t, CategoryRef category, ZoneId zone) {
			return new TransactionResponse(t.getId(), t.getType(), t.getAmount(), t.getCategoryId(), category,
					t.getTitle(), t.getMemo(), Times.at(t.getOccurredAt(), zone), Times.at(t.getCreatedAt(), zone),
					t.isFromFixed());
		}
	}

	public record ListResponse(List<TransactionResponse> items) {
	}
}
