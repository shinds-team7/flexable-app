package com.flexable.api.budget;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "budget_settings")
public class BudgetSettings {

	@Id
	@Column(name = "user_id")
	private Long userId;

	@Column(nullable = false)
	private long balance;

	@Column(name = "balance_at", nullable = false)
	private Instant balanceAt;

	@Column(nullable = false)
	private int payday;

	@Column(name = "income_amount", nullable = false)
	private long incomeAmount;

	@Column(name = "card_unpaid", nullable = false)
	private long cardUnpaid;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/** 고정지출 자동 기록 도입 전에 설정한 사용자만 값이 있다. 이 시각 이전 날짜는 자동 기록하지 않는다. */
	@Column(name = "fixed_posting_since")
	private Instant fixedPostingSince;

	protected BudgetSettings() {
	}

	public BudgetSettings(Long userId) {
		this.userId = userId;
	}

	public void apply(long balance, Instant balanceAt, int payday, long incomeAmount, long cardUnpaid, Instant now) {
		this.balance = balance;
		this.balanceAt = balanceAt;
		this.payday = payday;
		this.incomeAmount = incomeAmount;
		this.cardUnpaid = cardUnpaid;
		this.updatedAt = now;
	}

	public Long getUserId() {
		return userId;
	}

	public long getBalance() {
		return balance;
	}

	public Instant getBalanceAt() {
		return balanceAt;
	}

	public int getPayday() {
		return payday;
	}

	public long getIncomeAmount() {
		return incomeAmount;
	}

	public long getCardUnpaid() {
		return cardUnpaid;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public Instant getFixedPostingSince() {
		return fixedPostingSince;
	}
}
