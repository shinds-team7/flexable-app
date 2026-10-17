package com.flexable.api.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {
	Optional<UserIdentity> findByProviderAndProviderUserId(String provider, String providerUserId);
	Optional<UserIdentity> findFirstByUserIdOrderByIdAsc(long userId);
	List<UserIdentity> findByUserId(long userId);
}
