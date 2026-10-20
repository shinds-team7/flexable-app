package com.flexable.api.user;

import java.time.OffsetDateTime;
import java.time.ZoneId;

import com.flexable.api.common.Times;

public record UserResponse(Long id, String email, boolean onboarded, OffsetDateTime createdAt, String provider, boolean hasPassword) {

	public static UserResponse of(User user, ZoneId zone) {
		return of(user, zone, "email");
	}
	public static UserResponse of(User user, ZoneId zone, String provider) {
		return new UserResponse(user.getId(), user.getEmail(), user.isOnboarded(), Times.at(user.getCreatedAt(), zone),
				provider, "email".equals(provider) && user.getPasswordHash() != null);
	}
}
