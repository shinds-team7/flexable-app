package com.flexable.api.budget;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class BudgetDtos {

	static final long MAX_AMOUNT = 999_999_999_999L;

	private BudgetDtos() {
	}

	public record FixedItem(
			Long id,
			@NotBlank(message = "고정지출 이름을 입력해 주세요") @Size(max = 40, message = "이름은 40자 이하로 입력해 주세요") String name,
			@NotNull(message = "금액을 입력해 주세요") @Min(value = 1, message = "금액은 1원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long amount,
			@NotNull(message = "날짜를 골라 주세요") @Min(value = 1, message = "날짜는 1~31일 중에 골라 주세요") @Max(value = 31, message = "날짜는 1~31일 중에 골라 주세요") Integer day) {
	}

	public record ProtectedEntry(
			Long id,
			@NotBlank(message = "보호 금액 이름을 입력해 주세요") @Size(max = 40, message = "이름은 40자 이하로 입력해 주세요") String name,
			@NotNull(message = "금액을 입력해 주세요") @Min(value = 1, message = "금액은 1원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long amount) {
	}

	public record SettingsRequest(
			@NotNull(message = "현재 잔액을 입력해 주세요") @Min(value = 0, message = "잔액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long balance,
			OffsetDateTime balanceAt,
			@NotNull(message = "수입일을 골라 주세요") @Min(value = 1, message = "수입일은 1~31일 중에 골라 주세요") @Max(value = 31, message = "수입일은 1~31일 중에 골라 주세요") Integer payday,
			@NotNull(message = "예정 수입액을 입력해 주세요") @Min(value = 0, message = "수입액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long incomeAmount,
			@Min(value = 0, message = "카드 미결제액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long cardUnpaid,
			@Size(max = 30, message = "고정지출은 30개까지 등록할 수 있어요") List<@Valid FixedItem> fixedExpenses,
			@Size(max = 30, message = "보호 금액은 30개까지 등록할 수 있어요") List<@Valid ProtectedEntry> protectedItems) {
	}

	public record SettingsResponse(long balance, OffsetDateTime balanceAt, int payday, long incomeAmount,
			long cardUnpaid, List<FixedItem> fixedExpenses, List<ProtectedEntry> protectedItems,
			OffsetDateTime updatedAt) {
	}

	public record TodayResponse(LocalDate date, LocalDate nextPayday, int daysLeft, long estimatedBalance,
			long reservedFixed, long cardUnpaid, long protectedTotal, long remaining, long todaySpent,
			long dailyBudget, long todayAvailable, long shortage, long weekSpent, int weekDaysLeft, long weekAvailable,
			LocalDate cycleStart, boolean hasTransactions) {
	}
}
