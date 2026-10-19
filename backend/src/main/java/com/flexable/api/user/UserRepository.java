package com.flexable.api.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	/**
	 * 사용자 행을 고치는 곳은 모두 이 잠금 조회로 읽는다. 엔티티는 모든 열을 다시 쓰므로, 잠금 없이 읽은 값으로
	 * 저장하면 다른 요청이 바꾼 비밀번호·token_version을 되돌릴 수 있다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<User> findWithLockById(long id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<User> findWithLockByEmail(String email);
}
