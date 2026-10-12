package com.flexable.api.auth;

import java.time.Clock;
import java.time.ZoneId;
import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.auth.AuthDtos.AuthResponse;
import com.flexable.api.auth.AuthDtos.LoginRequest;
import com.flexable.api.auth.AuthDtos.SignupRequest;
import com.flexable.api.category.CategoryService;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.Times;
import com.flexable.api.config.AppProperties;
import com.flexable.api.user.AccountDeletionService;
import com.flexable.api.user.User;
import com.flexable.api.user.UserRepository;
import com.flexable.api.user.UserResponse;

@Service
public class AuthService {

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final TokenService tokens;
	private final LoginAttemptLimiter limiter;
	private final CategoryService categories;
	private final AccountDeletionService deletion;
	private final Clock clock;
	private final ZoneId zone;
	/** 없는 이메일로 로그인할 때도 같은 시간만큼 해시 비교를 하기 위한 값 */
	private final String dummyHash;

	public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenService tokens,
			LoginAttemptLimiter limiter, CategoryService categories, AccountDeletionService deletion, Clock clock,
			AppProperties props) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.tokens = tokens;
		this.limiter = limiter;
		this.categories = categories;
		this.deletion = deletion;
		this.clock = clock;
		this.zone = props.zoneId();
		this.dummyHash = passwordEncoder.encode("not-a-real-password-0");
	}

	@Transactional
	public AuthResponse signup(SignupRequest req) {
		String email = normalize(req.email());
		if (users.existsByEmail(email)) {
			throw new ApiException(ErrorCode.EMAIL_UNAVAILABLE);
		}
		User user;
		try {
			user = users.saveAndFlush(new User(email, passwordEncoder.encode(req.password()), clock.instant()));
		}
		catch (DataIntegrityViolationException e) {
			throw new ApiException(ErrorCode.EMAIL_UNAVAILABLE);
		}
		categories.createDefaults(user.getId());
		return respond(user);
	}

	@Transactional(readOnly = true)
	public AuthResponse login(LoginRequest req) {
		String email = normalize(req.email());
		limiter.check(email);
		User user = users.findByEmail(email).orElse(null);
		boolean ok = passwordEncoder.matches(req.password(), user == null ? dummyHash : user.getPasswordHash());
		if (user == null || !ok) {
			limiter.recordFailure(email);
			throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
		}
		limiter.reset(email);
		return respond(user);
	}

	@Transactional
	public void logout(long userId) {
		users.findById(userId).ifPresent(User::revokeTokens);
	}

	@Transactional(readOnly = true)
	public UserResponse me(long userId) {
		return UserResponse.of(find(userId), zone);
	}

	@Transactional
	public void deleteAccount(long userId, String password) {
		User user = find(userId);
		if (!passwordEncoder.matches(password, user.getPasswordHash())) {
			throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "비밀번호가 맞지 않아요");
		}
		deletion.deleteAll(userId);
	}

	private User find(long userId) {
		return users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
	}

	private AuthResponse respond(User user) {
		TokenService.IssuedToken token = tokens.issue(user);
		return new AuthResponse(token.value(), Times.at(token.expiresAt(), zone), UserResponse.of(user, zone));
	}

	private static String normalize(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}
}
