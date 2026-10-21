package com.flexable.api.coin;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 코인 내역 한 줄. (user_id, reason, ref_key) 유니크. notifiedAt이 비어 있으면 아직 모달로 보여 주지 않은 보상이다. */
@Entity
@Table(name = "coin_ledger")
public class CoinLedger {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(nullable = false)
	private int amount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private CoinReason reason;

	@Column(name = "ref_key", nullable = false, length = 40)
	private String refKey;

	@Column(name = "notified_at")
	private Instant notifiedAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected CoinLedger() {
	}

	CoinLedger(long userId, CoinReason reason, String refKey, int amount, Instant notifiedAt, Instant now) {
		this.userId = userId;
		this.reason = reason;
		this.refKey = refKey;
		this.amount = amount;
		this.notifiedAt = notifiedAt;
		this.createdAt = now;
	}

	public Long getId() {
		return id;
	}

	public int getAmount() {
		return amount;
	}

	public CoinReason getReason() {
		return reason;
	}

	public String getRefKey() {
		return refKey;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
