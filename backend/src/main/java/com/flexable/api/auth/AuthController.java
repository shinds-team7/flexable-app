package com.flexable.api.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.AuthDtos.AuthResponse;
import com.flexable.api.auth.AuthDtos.LoginRequest;
import com.flexable.api.auth.AuthDtos.PasswordRequest;
import com.flexable.api.auth.AuthDtos.SignupRequest;
import com.flexable.api.user.UserResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public class AuthController {

	private final AuthService auth;

	public AuthController(AuthService auth) {
		this.auth = auth;
	}

	@PostMapping("/auth/signup")
	@ResponseStatus(HttpStatus.CREATED)
	AuthResponse signup(@Valid @RequestBody SignupRequest req) {
		return auth.signup(req);
	}

	@PostMapping("/auth/login")
	AuthResponse login(@Valid @RequestBody LoginRequest req) {
		return auth.login(req);
	}

	@PostMapping("/auth/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void logout(@AuthenticationPrincipal Jwt jwt) {
		auth.logout(CurrentUser.id(jwt));
	}

	@GetMapping("/me")
	UserResponse me(@AuthenticationPrincipal Jwt jwt) {
		return auth.me(CurrentUser.id(jwt));
	}

	@DeleteMapping("/me")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void delete(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PasswordRequest req) {
		auth.deleteAccount(CurrentUser.id(jwt), req.password(), req.confirm());
	}
}
