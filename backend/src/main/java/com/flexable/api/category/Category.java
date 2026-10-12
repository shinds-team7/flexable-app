package com.flexable.api.category;

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
@Table(name = "categories")
public class Category {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private TxType type;

	@Column(nullable = false)
	private String color;

	@Column(nullable = false)
	private String icon;

	@Column(name = "is_default", nullable = false)
	private boolean isDefault;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected Category() {
	}

	public Category(Long userId, String name, TxType type, String color, String icon, boolean isDefault,
			Instant createdAt) {
		this.userId = userId;
		this.name = name;
		this.type = type;
		this.color = color;
		this.icon = icon;
		this.isDefault = isDefault;
		this.createdAt = createdAt;
	}

	public Long getId() {
		return id;
	}

	public Long getUserId() {
		return userId;
	}

	public String getName() {
		return name;
	}

	public TxType getType() {
		return type;
	}

	public String getColor() {
		return color;
	}

	public String getIcon() {
		return icon;
	}

	public boolean isDefault() {
		return isDefault;
	}

	public void rename(String name) {
		this.name = name;
	}

	public void restyle(String color, String icon) {
		if (color != null) {
			this.color = color;
		}
		if (icon != null) {
			this.icon = icon;
		}
	}
}
