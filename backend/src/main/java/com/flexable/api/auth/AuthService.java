package com.flexable.api.auth;

import java.time.Clock;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.flexable.api.config.OAuthProperties;
import com.flexable.api.user.UserIdentityRepository;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.auth.AuthDtos.AuthResponse;
import com.flexable.api.auth.AuthDtos.LoginRequest;
import com.flexable.api.auth.AuthDtos.SignupRequest;
import com.flexable.api.budget.SettingsRepository;
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

	private static final Logger log = LoggerFactory.getLogger(AuthService.class);
	private final UserIdentityRepository identities;
	private final OAuthProviderClient oauthClient;
	private final OAuthProperties oauthProps;

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final TokenService tokens;
	private final LoginAttemptLimiter limiter;
	private final CategoryService categories;
	private final SettingsRepository settings;
	private final AccountDeletionService deletion;
	private final Clock clock;
	private final ZoneId zone;
	/** 없는 이메일로 로그인할 때도 같은 시간만큼 해시 비교를 하기 위한 값 */
	private final String dummyHash;

	public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenService tokens,
			LoginAttemptLimiter limiter, CategoryService categories, AccountDeletionService deletion, Clock clock,
			AppProperties props, UserIdentityRepository identities, OAuthProviderClient oauthClient, OAuthProperties oauthProps,
			SettingsRepository settings) {
		this.settings = settings;
		this.identities = identities;
		this.oauthClient = oauthClient;
		this.oauthProps = oauthProps;
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
		var social = user == null ? null : identities.findFirstByUserIdOrderByIdAsc(user.getId()).orElse(null);
		if (social != null) {
			// 같은 이메일에 소셜 로그인이 붙으면 비밀번호가 맞아도 그 방법으로 돌려보낸다(선가입 계정 차단).
			limiter.recordFailure(email);
			String name = "kakao".equals(social.getProvider()) ? "카카오" : "Google";
			throw new ApiException(ErrorCode.SOCIAL_ACCOUNT, name + "로 가입한 계정이에요. " + name + "로 로그인해 주세요",
					Map.of("provider", social.getProvider()));
		}
		boolean ok = passwordEncoder.matches(req.password(), user == null || user.getPasswordHash() == null ? dummyHash : user.getPasswordHash());
		if (user == null || user.getPasswordHash() == null || !ok) {
			limiter.recordFailure(email);
			throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
		}
		limiter.reset(email);
		return respond(user);
	}

	@Transactional
	public void logout(long userId) {
		users.findWithLockById(userId).ifPresent(User::revokeTokens);
	}

	@Transactional(readOnly = true)
	public UserResponse me(long userId) {
		return userResponse(find(userId));
	}

	@Transactional
	public void deleteAccount(long userId, String password, String confirm) {
		// 소셜 연결과 동시에 오면 연결이 끝난 뒤의 상태로 확인한다. 잠금 순서는 다른 쓰기와 같게 설정 → 사용자.
		settings.findForUpdate(userId);
		User user = users.findWithLockById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
		// 소셜 로그인이 붙은 계정은 비밀번호를 쓸 수 없으므로 확인 문구로 탈퇴한다.
		if (identities.findWithLockByUserId(userId).isEmpty()) {
			if (password == null || password.isBlank()) {
				throw ApiException.invalid("password", "비밀번호를 입력해 주세요");
			}
			if (!passwordEncoder.matches(password, user.getPasswordHash())) {
				throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "비밀번호가 맞지 않아요");
			}
		}
		else if (!"탈퇴".equals(confirm)) {
			throw ApiException.invalid("confirm", "확인 문구 '탈퇴'를 입력해 주세요");
		}
		if (oauthProps.kakao().adminKey() != null && !oauthProps.kakao().adminKey().isBlank()) {
			identities.findByUserId(userId).stream().filter(i -> "kakao".equals(i.getProvider())).forEach(i -> {
				try {
					oauthClient.unlinkKakao(i.getProviderUserId());
				}
				catch (RestClientResponseException e) {
					log.warn("카카오 연결 끊기 실패: provider=kakao, status={}", e.getStatusCode().value());
				}
				catch (RuntimeException e) {
					log.warn("카카오 연결 끊기 실패: cause={}", e.getClass().getSimpleName());
				}
			});
		}
		deletion.deleteAll(userId);
	}

	@Transactional(readOnly = true)
	public AuthResponse socialLogin(long userId) {
		return respond(find(userId));
	}

	private UserResponse userResponse(User user) {
		// 소셜 로그인이 붙어 있으면 비밀번호가 남아 있어도 그 방법으로만 들어온다.
		String provider = identities.findFirstByUserIdOrderByIdAsc(user.getId()).map(i -> i.getProvider()).orElse("email");
		return UserResponse.of(user, zone, provider);
	}

	private User find(long userId) {
		return users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
	}

	private AuthResponse respond(User user) {
		TokenService.IssuedToken token = tokens.issue(user);
		return new AuthResponse(token.value(), Times.at(token.expiresAt(), zone), userResponse(user));
	}

	private static String normalize(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}
}
