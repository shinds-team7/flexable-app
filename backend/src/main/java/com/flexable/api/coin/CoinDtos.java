package com.flexable.api.coin;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class CoinDtos {

	private CoinDtos() {
	}

	/** collectable: 지금 모을 수 있는 개수, nextAt: 다음 1개가 쌓이는 시각(오늘 다 쌓였거나 check-in 전이면 null) */
	public record Passive(int collectable, int collectedToday, int dailyLimit, OffsetDateTime nextAt) {
	}

	/** equippedOutfitId가 null이면 기본 캐릭터(costume-lv1) */
	public record Wallet(long balance, Passive passive, String equippedOutfitId) {
	}

	/** refDate: BUDGET_BONUS일 때 지킨 날짜, 그 밖에는 null */
	public record Reward(long id, CoinReason reason, int amount, LocalDate refDate, OffsetDateTime createdAt) {
	}

	/** 내역 한 줄. amount: 사용(PURCHASE)은 음수. refDate는 BUDGET_BONUS, outfitId는 PURCHASE일 때만 */
	public record LedgerEntry(long id, CoinReason reason, int amount, LocalDate refDate, String outfitId,
			OffsetDateTime createdAt) {
	}

	/** nextBefore: 다음 쪽을 부를 before 값, 더 없으면 null */
	public record LedgerPage(List<LedgerEntry> items, Long nextBefore) {
	}

	public record CheckInResponse(Wallet wallet, List<Reward> rewards) {
	}

	public record AckRequest(List<Long> ids) {
	}

	public record CollectResponse(int collected, Wallet wallet) {
	}

	/**
	 * days: 이번 달 출석한 날, 오래된 순. streak: 오늘까지(오늘 안 했으면 어제까지) 연속 출석 일수.
	 * todayReward: 오늘 출석하면(했으면) 받는 코인
	 */
	public record Attendance(LocalDate today, List<LocalDate> days, int streak, boolean checkedToday,
			int todayReward) {
	}

	/** rewarded: 이번 요청으로 받은 코인, 이미 출석했으면 0 */
	public record AttendResponse(int rewarded, Attendance attendance, Wallet wallet) {
	}
}
