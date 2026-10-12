package com.flexable.api.budget;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "fixed_expenses")
public class FixedExpense {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private long amount;

	/** 1~31, 31은 말일 */
	@Column(name = "day_of_month", nullable = false)
	private int day;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	protected FixedExpense() {
	}

	public FixedExpense(Long userId, String name, long amount, int day, int sortOrder) {
		this.userId = userId;
		this.name = name;
		this.amount = amount;
		this.day = day;
		this.sortOrder = sortOrder;
	}

	public Long getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public long getAmount() {
		return amount;
	}

	public int getDay() {
		return day;
	}
}
