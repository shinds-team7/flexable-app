package com.flexable.api.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
	VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "입력한 내용을 확인해 주세요"),
	UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요"),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 맞지 않아요"),
	OAUTH_CODE_INVALID(HttpStatus.UNAUTHORIZED, "로그인 시간이 지났어요. 다시 시도해 주세요"),
	NOT_FOUND(HttpStatus.NOT_FOUND, "찾을 수 없어요"),
	BUDGET_NOT_SET(HttpStatus.NOT_FOUND, "초기 예산을 먼저 설정해 주세요"),
	EMAIL_UNAVAILABLE(HttpStatus.CONFLICT, "이 이메일로 가입할 수 없어요. 로그인하거나 비밀번호를 찾아보세요"),
	CATEGORY_DUPLICATE(HttpStatus.CONFLICT, "같은 이름의 카테고리가 이미 있어요"),
	CATEGORY_DEFAULT(HttpStatus.CONFLICT, "기본 카테고리는 삭제할 수 없어요"),
	TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 시도해 주세요"),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요");

	private final HttpStatus status;
	private final String message;

	ErrorCode(HttpStatus status, String message) {
		this.status = status;
		this.message = message;
	}

	public HttpStatus status() {
		return status;
	}

	public String message() {
		return message;
	}
}
