package com.flexable.api.budget;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 고정지출을 거래로 기록했다는 표시. 키는 "날짜:" + 항목(일자·이름·순번) 해시. */
@Entity
@Table(name = "fixed_expense_postings")
public class FixedExpensePosting {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "posting_key", nullable = false)
	private String postingKey;

	/** 이 날짜·항목을 맡은 거래 id(자동으로 만든 거래 또는 직접 기록해 둔 같은 지출). 지워져도 남는다. */
	@Column(name = "transaction_id", nullable = false)
	private Long transactionId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected FixedExpensePosting() {
	}

	public FixedExpensePosting(Long userId, String postingKey, Long transactionId, Instant now) {
		this.userId = userId;
		this.postingKey = postingKey;
		this.transactionId = transactionId;
		this.createdAt = now;
	}

	public String getPostingKey() {
		return postingKey;
	}

	public Long getTransactionId() {
		return transactionId;
	}
}
