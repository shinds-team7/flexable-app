package com.flexable.api.budget;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 지금 예산에서 시드머니로 바로 옮긴 돈. 수입일 전날 반영(SeedMoneyEntry)과 달리 아무 때나 여러 번 있다. */
@Entity
@Table(name = "seed_money_additions")
public class SeedMoneyAddition {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(nullable = false)
	private long amount;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected SeedMoneyAddition() {
	}

	public SeedMoneyAddition(long userId, long amount, Instant now) {
		this.userId = userId;
		this.amount = amount;
		this.createdAt = now;
	}

	public long getAmount() {
		return amount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
