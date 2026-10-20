package com.flexable.api.weblink;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 앱 계정과 웹사이트 계정의 연동. 웹은 linkId 원문만 알고, 여기엔 해시만 둔다. */
@Entity
@Table(name = "web_links")
public class WebLink {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "link_hash", nullable = false, length = 64)
	private String linkHash;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected WebLink() {
	}

	public WebLink(long userId, String linkHash, Instant now) {
		this.userId = userId;
		this.linkHash = linkHash;
		this.createdAt = now;
	}

	public Long getId() {
		return id;
	}

	public Long getUserId() {
		return userId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
