package com.flexable.api.auth;

import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentUser {

	private CurrentUser() {
	}

	public static long id(Jwt jwt) {
		return Long.parseLong(jwt.getSubject());
	}
}
