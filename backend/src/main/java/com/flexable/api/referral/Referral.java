package com.flexable.api.referral;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 추천 코드 등록. 한 사람은 한 번만 등록한다. 초대한 사람이 탈퇴하면 inviterId만 비우고 기록은 남긴다. */
@Entity
@Table(name = "referrals")
public class Referral {

	@Id
	@Column(name = "invitee_id")
	private Long inviteeId;

	@Column(name = "inviter_id")
	private Long inviterId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected Referral() {
	}

	Referral(long inviteeId, long inviterId, Instant now) {
		this.inviteeId = inviteeId;
		this.inviterId = inviterId;
		this.createdAt = now;
	}
}
