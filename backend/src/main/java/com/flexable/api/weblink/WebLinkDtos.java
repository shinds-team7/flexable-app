package com.flexable.api.weblink;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.NotBlank;

public final class WebLinkDtos {

	private WebLinkDtos() {
	}

	public record LinkCodeResponse(String code, OffsetDateTime expiresAt) {
	}

	public record LinkItem(long id, OffsetDateTime createdAt) {
	}

	public record LinkRequest(@NotBlank(message = "연동 코드를 입력해 주세요") String code) {
	}

	/** 웹에 넘기는 앱 회원 정보. email은 소셜 계정이면 null일 수 있다. provider는 email·kakao·google. */
	public record AppProfile(String email, String provider) {
	}

	public record LinkCreated(String linkId, AppProfile profile) {
	}
}
