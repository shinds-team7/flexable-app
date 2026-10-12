package com.flexable.api.budget;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "protected_items")
public class ProtectedItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private long amount;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	protected ProtectedItem() {
	}

	public ProtectedItem(Long userId, String name, long amount, int sortOrder) {
		this.userId = userId;
		this.name = name;
		this.amount = amount;
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
}
