package com.flexable.api.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {
	Optional<UserIdentity> findByProviderAndProviderUserId(String provider, String providerUserId);
	Optional<UserIdentity> findFirstByUserIdOrderByIdAsc(long userId);
	List<UserIdentity> findByUserId(long userId);
	/** 잠금 읽기라 같은 트랜잭션의 이전 스냅숏이 아니라 방금 커밋된 행까지 본다. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	List<UserIdentity> findWithLockByUserId(long userId);
}
