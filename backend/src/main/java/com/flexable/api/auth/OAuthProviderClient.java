package com.flexable.api.auth;

public interface OAuthProviderClient {
	Profile fetch(String provider, String code);
	void unlinkKakao(String providerUserId);
	public record Profile(String providerUserId, String email, boolean emailVerified) {
	}
}
