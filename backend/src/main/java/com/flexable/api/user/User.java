package com.flexable.api.user;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(unique = true, length = 254)
	private String email;

	@Column(name = "password_hash", length = 100)
	private String passwordHash;

	@Column(name = "token_version", nullable = false)
	private int tokenVersion;

	@Column(nullable = false)
	private boolean onboarded;

	@Column(name = "agreed_at", nullable = false)
	private Instant agreedAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected User() {
	}

	public User(String email, String passwordHash, Instant now) {
		this.email = email;
		this.passwordHash = passwordHash;
		this.agreedAt = now;
		this.createdAt = now;
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public int getTokenVersion() {
		return tokenVersion;
	}

	public boolean isOnboarded() {
		return onboarded;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void markOnboarded() {
		this.onboarded = true;
	}

	public void clearPassword() {
		this.passwordHash = null;
	}

	public void revokeTokens() {
		this.tokenVersion++;
	}
}
