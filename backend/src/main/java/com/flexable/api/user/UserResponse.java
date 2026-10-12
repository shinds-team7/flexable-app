package com.flexable.api.user;

import java.time.OffsetDateTime;
import java.time.ZoneId;

import com.flexable.api.common.Times;

public record UserResponse(Long id, String email, boolean onboarded, OffsetDateTime createdAt) {

	public static UserResponse of(User user, ZoneId zone) {
		return new UserResponse(user.getId(), user.getEmail(), user.isOnboarded(), Times.at(user.getCreatedAt(), zone));
	}
}
