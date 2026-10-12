package com.flexable.api.transaction;

import java.time.Instant;

import com.flexable.api.common.TxType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "transactions")
public class Transaction {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "category_id", nullable = false)
	private Long categoryId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private TxType type;

	@Column(nullable = false)
	private long amount;

	@Column(nullable = false)
	private String title;

	private String memo;

	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;

	@Column(name = "idempotency_key")
	private String idempotencyKey;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Transaction() {
	}

	public Transaction(Long userId, Long categoryId, TxType type, long amount, String title, String memo,
			Instant occurredAt, String idempotencyKey, Instant now) {
		this.userId = userId;
		this.categoryId = categoryId;
		this.type = type;
		this.amount = amount;
		this.title = title;
		this.memo = memo;
		this.occurredAt = occurredAt;
		this.idempotencyKey = idempotencyKey;
		this.createdAt = now;
		this.updatedAt = now;
	}

	public Long getId() {
		return id;
	}

	public Long getUserId() {
		return userId;
	}

	public Long getCategoryId() {
		return categoryId;
	}

	public TxType getType() {
		return type;
	}

	public long getAmount() {
		return amount;
	}

	public String getTitle() {
		return title;
	}

	public String getMemo() {
		return memo;
	}

	public Instant getOccurredAt() {
		return occurredAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void update(TxType type, Long categoryId, Long amount, String title, String memo, boolean memoSet,
			Instant occurredAt, Instant now) {
		if (type != null) {
			this.type = type;
		}
		if (categoryId != null) {
			this.categoryId = categoryId;
		}
		if (amount != null) {
			this.amount = amount;
		}
		if (title != null) {
			this.title = title;
		}
		if (memoSet) {
			this.memo = memo;
		}
		if (occurredAt != null) {
			this.occurredAt = occurredAt;
		}
		this.updatedAt = now;
	}
}
