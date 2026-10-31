package com.flexable.api.outfit;

import java.io.Serializable;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/** 산 상점 상품. 레벨 코스튬은 최고 레벨로 판단하므로 넣지 않는다. */
@Entity
@Table(name = "user_outfits")
@IdClass(UserOutfit.Key.class)
public class UserOutfit {

	public record Key(Long userId, String outfitId) implements Serializable {
	}

	@Id
	@Column(name = "user_id")
	private Long userId;

	@Id
	@Column(name = "outfit_id", length = 40)
	private String outfitId;

	@Column(name = "acquired_at", nullable = false)
	private Instant acquiredAt;

	protected UserOutfit() {
	}

	public UserOutfit(long userId, String outfitId, Instant now) {
		this.userId = userId;
		this.outfitId = outfitId;
		this.acquiredAt = now;
	}

	public String getOutfitId() {
		return outfitId;
	}
}
