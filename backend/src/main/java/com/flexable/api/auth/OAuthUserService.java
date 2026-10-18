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
		if (email != null && users.existsByEmail(email)) {
			throw new ApiException(ErrorCode.EMAIL_UNAVAILABLE);
		}
		User user = users.saveAndFlush(new User(email, null, clock.instant()));
		categories.createDefaults(user.getId());
		identities.saveAndFlush(new UserIdentity(user.getId(), provider, profile.providerUserId(), email, clock.instant()));
		return user.getId();
	}
}
