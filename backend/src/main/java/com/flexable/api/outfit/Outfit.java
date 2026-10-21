package com.flexable.api.outfit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 코스튬. 레벨 코스튬은 unlockLevel로 열리고 price가 없다. 상점 상품은 price가 있고 unlockLevel이 없다. 목록은 V8 이후 마이그레이션으로만 바꾼다. */
@Entity
@Table(name = "outfits")
public class Outfit {

	@Id
	@Column(length = 40)
	private String id;

	@Column(nullable = false, length = 40)
	private String name;

	private Integer price;

	@Column(name = "unlock_level")
	private Integer unlockLevel;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(nullable = false)
	private boolean active;

	protected Outfit() {
	}

	public String getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public Integer getPrice() {
		return price;
	}

	public Integer getUnlockLevel() {
		return unlockLevel;
	}

	public boolean isActive() {
		return active;
	}
}
