package com.flexable.api.user;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_identities")
public class UserIdentity {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	@Column(name = "user_id", nullable = false)
	private Long userId;
	@Column(nullable = false, length = 20)
	private String provider;
	@Column(name = "provider_user_id", nullable = false, length = 100)
	private String providerUserId;
	@Column(length = 254)
	private String email;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected UserIdentity() {
	}
	public UserIdentity(long userId, String provider, String providerUserId, String email, Instant now) {
		this.userId = userId;
		this.provider = provider;
		this.providerUserId = providerUserId;
		this.email = email;
		this.createdAt = now;
	}
	public Long getUserId() {
		return userId;
	}
	public String getProvider() {
		return provider;
	}
	public String getProviderUserId() {
		return providerUserId;
	}
}
