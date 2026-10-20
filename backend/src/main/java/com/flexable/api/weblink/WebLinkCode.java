package com.flexable.api.weblink;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 앱에서 발급한 웹 연동 코드. 원문은 사용자에게만 보여 주고 여기엔 해시만 둔다. */
@Entity
@Table(name = "web_link_codes")
public class WebLinkCode {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "code_hash", nullable = false, length = 64)
	private String codeHash;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected WebLinkCode() {
	}

	public WebLinkCode(long userId, String codeHash, Instant expiresAt, Instant now) {
		this.userId = userId;
		this.codeHash = codeHash;
		this.expiresAt = expiresAt;
		this.createdAt = now;
	}

	public Long getId() {
		return id;
	}

	public Long getUserId() {
		return userId;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
