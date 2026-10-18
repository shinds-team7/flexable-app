package com.flexable.api.auth;

import java.time.OffsetDateTime;

import com.flexable.api.user.UserResponse;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

	private AuthDtos() {
	}

	public record SignupRequest(
			@NotBlank(message = "이메일을 입력해 주세요") @Email(message = "이메일 형식을 확인해 주세요") @Size(max = 254, message = "이메일 형식을 확인해 주세요") String email,
			@NotNull(message = "비밀번호를 입력해 주세요") @Size(min = 8, max = 64, message = "비밀번호는 8자 이상 64자 이하로 입력해 주세요") @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "비밀번호에 영문과 숫자를 모두 넣어 주세요") String password,
			@AssertTrue(message = "서비스 이용약관에 동의해 주세요") boolean agreeTerms,
			@AssertTrue(message = "개인정보 수집·이용에 동의해 주세요") boolean agreePrivacy) {
	}

	public record LoginRequest(
			@NotBlank(message = "이메일을 입력해 주세요") @Size(max = 254, message = "이메일 형식을 확인해 주세요") String email,
			@NotBlank(message = "비밀번호를 입력해 주세요") String password) {
	}

	public record PasswordRequest(String password, String confirm) {
	}

	public record AuthResponse(String accessToken, OffsetDateTime expiresAt, UserResponse user) {
	}
}
