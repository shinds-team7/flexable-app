package com.flexable.api.coin;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** 사용자별 코인 지갑. 시간 적립 상태·적용 중인 코스튬·내 추천 코드도 여기에 둔다. 행은 CoinWalletRepository.ensure로 만든다. */
@Entity
@Table(name = "coin_wallets")
public class CoinWallet {

	@Id
	@Column(name = "user_id")
	private Long userId;

	@Column(nullable = false)
	private long balance;

	/** 시간 적립을 시작한 날(KST). 오늘이 아니면 오늘은 아직 check-in 전이다. */
	@Column(name = "passive_date")
	private LocalDate passiveDate;

	@Column(name = "passive_started_at")
	private Instant passiveStartedAt;

	/** passiveDate에 모으기로 받은 개수 */
	@Column(name = "passive_collected", nullable = false)
	private int passiveCollected;

	@Column(name = "equipped_outfit_id", length = 40)
	private String equippedOutfitId;

	@Column(name = "referral_code", length = 12)
	private String referralCode;

	@Version
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected CoinWallet() {
	}

	void add(int amount) {
		balance += amount;
	}

	void startPassive(LocalDate date, Instant now) {
		passiveDate = date;
		passiveStartedAt = now;
		passiveCollected = 0;
	}

	void collectPassive(int total) {
		passiveCollected = total;
	}

	public void equip(String outfitId) {
		equippedOutfitId = outfitId;
	}

	public void assignReferralCode(String code) {
		referralCode = code;
	}

	public Long getUserId() {
		return userId;
	}

	public long getBalance() {
		return balance;
	}

	public LocalDate getPassiveDate() {
		return passiveDate;
	}

	public Instant getPassiveStartedAt() {
		return passiveStartedAt;
	}

	public int getPassiveCollected() {
		return passiveCollected;
	}

	public String getEquippedOutfitId() {
		return equippedOutfitId;
	}

	public String getReferralCode() {
		return referralCode;
	}
}
