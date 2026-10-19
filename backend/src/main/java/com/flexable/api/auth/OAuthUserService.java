package com.flexable.api.auth;

import java.time.Clock;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.flexable.api.category.CategoryService;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.user.User;
import com.flexable.api.user.UserIdentity;
import com.flexable.api.user.UserIdentityRepository;
import com.flexable.api.user.UserRepository;

@Service
public class OAuthUserService {
	private final UserRepository users;
	private final UserIdentityRepository identities;
	private final CategoryService categories;
	private final Clock clock;

	public OAuthUserService(UserRepository users, UserIdentityRepository identities, CategoryService categories, Clock clock) {
		this.users = users;
		this.identities = identities;
		this.categories = categories;
		this.clock = clock;
	}
	@Transactional
	public long findOrCreate(String provider, OAuthProviderClient.Profile profile) {
		var existing = identities.findByProviderAndProviderUserId(provider, profile.providerUserId());
		if (existing.isPresent()) {
			return existing.get().getUserId();
		}
		String email = profile.emailVerified() && profile.email() != null && !profile.email().isBlank()
				? profile.email().trim().toLowerCase(Locale.ROOT) : null;
		User owner = email == null ? null : users.findWithLockByEmail(email).orElse(null);
		if (owner != null) {
			return link(owner, provider, profile.providerUserId(), email);
		}
		User user = users.saveAndFlush(new User(email, null, clock.instant()));
		categories.createDefaults(user.getId());
		identities.saveAndFlush(new UserIdentity(user.getId(), provider, profile.providerUserId(), email, clock.instant()));
		return user.getId();
	}
	/**
	 * 공급자가 확인한 이메일과 같은 계정에 로그인 방법을 붙인다. 이메일 가입은 메일 인증을 하지 않으므로
	 * 남의 주소로 미리 가입해 둔 사람이 계속 들어오지 못하게 비밀번호와 기존 로그인 세션을 무효화한다.
	 * 같은 공급자의 다른 계정이 이미 붙어 있으면 어느 쪽이 주인인지 알 수 없어 연결하지 않는다.
	 * 사용자 행을 잠근 채로 확인하므로 같은 계정에 대한 연결 요청은 하나씩 처리된다.
	 */
	private long link(User owner, String provider, String providerUserId, String email) {
		boolean taken = identities.findWithLockByUserId(owner.getId()).stream().anyMatch(i -> provider.equals(i.getProvider()));
		if (taken) {
			throw new ApiException(ErrorCode.EMAIL_UNAVAILABLE);
		}
		if (owner.getPasswordHash() != null) {
			owner.clearPassword();
			owner.revokeTokens();
		}
		identities.saveAndFlush(new UserIdentity(owner.getId(), provider, providerUserId, email, clock.instant()));
		return owner.getId();
	}
}
