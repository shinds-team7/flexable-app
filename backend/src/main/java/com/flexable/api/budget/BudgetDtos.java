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
			@NotBlank(message = "저축 항목 이름을 입력해 주세요") @Size(max = 40, message = "이름은 40자 이하로 입력해 주세요") String name,
			@NotNull(message = "금액을 입력해 주세요") @Min(value = 1, message = "금액은 1원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long amount) {
	}

	public record SettingsRequest(
			@NotNull(message = "현재 잔액을 입력해 주세요") @Min(value = 0, message = "잔액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long balance,
			OffsetDateTime balanceAt,
			@NotNull(message = "수입일을 골라 주세요") @Min(value = 1, message = "수입일은 1~31일 중에 골라 주세요") @Max(value = 31, message = "수입일은 1~31일 중에 골라 주세요") Integer payday,
			@NotNull(message = "예정 수입액을 입력해 주세요") @Min(value = 0, message = "수입액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long incomeAmount,
			@Min(value = 0, message = "카드 미결제액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long cardUnpaid,
			@Size(max = 30, message = "고정지출은 30개까지 등록할 수 있어요") List<@Valid FixedItem> fixedExpenses,
			@Size(max = 30, message = "매달 저축할 돈은 30개까지 등록할 수 있어요") List<@Valid ProtectedEntry> protectedItems,
			@Min(value = 0, message = "모아둔 돈은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long seedBase) {
	}

	public record SettingsResponse(long balance, OffsetDateTime balanceAt, int payday, long incomeAmount,
			long cardUnpaid, List<FixedItem> fixedExpenses, List<ProtectedEntry> protectedItems, long seedBase,
			OffsetDateTime updatedAt) {
	}

	/** 반영할 주기. payday는 주기가 끝난 다음 날(수입일). goalAmount=매달 저축할 돈, allAmount=그 주기 끝 기준 남은 돈 전부 */
	public record SeedMoneyPending(LocalDate cycleEnd, LocalDate payday, long goalAmount, long allAmount) {
	}

	public record SeedMoneyEntryItem(LocalDate cycleEnd, SeedMoneyEntry.Choice choice, long amount,
			OffsetDateTime createdAt) {
	}

	public record SeedMoneyResponse(long base, long saved, long total, long monthlyGoal, SeedMoneyPending pending,
			List<SeedMoneyEntryItem> entries) {
	}

	public record SeedMoneyRequest(
			@NotNull(message = "반영할 주기를 확인해 주세요") LocalDate cycleEnd,
			@NotNull(message = "반영 방법을 골라 주세요") SeedMoneyEntry.Choice choice,
			@Min(value = 0, message = "금액은 0원 이상이어야 해요") @Max(value = MAX_AMOUNT, message = "금액이 너무 커요") Long amount) {
	}

	/** 웹 연동으로 넘기는 시드머니. 반영 대기 정보는 넣지 않는다. */
	public record WebSeedMoney(long total, long base, long monthlyGoal, SeedMoneyEntryItem lastEntry,
			OffsetDateTime updatedAt, LocalDate startedOn, List<WebSeedMoneyEntry> entries) {
	}

	/** 조회 시점의 base를 기준으로 주기순 누적한 확정 기록. */
	public record WebSeedMoneyEntry(LocalDate cycleEnd, SeedMoneyEntry.Choice choice, long amount,
			long totalAfter, OffsetDateTime createdAt) {
	}

	public record TodayResponse(LocalDate date, LocalDate nextPayday, int daysLeft, long estimatedBalance,
			long reservedFixed, long cardUnpaid, long protectedTotal, long remaining, long todaySpent,
			long dailyBudget, long todayAvailable, long shortage, long weekSpent, int weekDaysLeft, long weekAvailable,
			LocalDate cycleStart, boolean hasTransactions, int characterPoints, int characterDelta) {

		TodayResponse withCharacter(CharacterScore.Result c) {
			return new TodayResponse(date, nextPayday, daysLeft, estimatedBalance, reservedFixed, cardUnpaid,
					protectedTotal, remaining, todaySpent, dailyBudget, todayAvailable, shortage, weekSpent, weekDaysLeft,
					weekAvailable, cycleStart, hasTransactions, c.points(), c.delta());
		}
	}
}
