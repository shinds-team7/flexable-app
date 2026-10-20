package com.flexable.api.budget;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 한 정산 주기 끝(수입일 전날)에 시드머니로 옮긴 금액. 주기마다 한 번만 있다. */
@Entity
@Table(name = "seed_money_entries")
public class SeedMoneyEntry {

	/** GOAL: 매달 저축할 돈만, ALL: 매달 저축할 돈 + 남은 돈 전부, MANUAL: 직접 입력 */
	public enum Choice {
		GOAL, ALL, MANUAL
	}

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "cycle_end", nullable = false)
	private LocalDate cycleEnd;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private Choice choice;

	@Column(nullable = false)
	private long amount;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected SeedMoneyEntry() {
	}

	public SeedMoneyEntry(long userId, LocalDate cycleEnd, Choice choice, long amount, Instant now) {
		this.userId = userId;
		this.cycleEnd = cycleEnd;
		this.choice = choice;
		this.amount = amount;
		this.createdAt = now;
	}

	public LocalDate getCycleEnd() {
		return cycleEnd;
	}

	public Choice getChoice() {
		return choice;
	}

	public long getAmount() {
		return amount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
