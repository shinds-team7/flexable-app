package com.flexable.api.weblink;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface WebLinkCodeRepository extends JpaRepository<WebLinkCode, Long> {

	Optional<WebLinkCode> findByCodeHash(String codeHash);

	/** 새 코드를 발급할 때 이 사용자의 이전 코드와 모든 만료 코드를 지운다. */
	@Modifying
	@Query("delete from WebLinkCode c where c.userId = :userId or c.expiresAt < :now")
	void deleteByUserIdOrExpired(long userId, Instant now);

	/** 한 번만 쓰이게 지운 행 수로 판단한다. 같은 코드가 동시에 들어오면 한쪽만 1을 받는다. */
	@Modifying
	@Query("delete from WebLinkCode c where c.id = :id")
	int deleteOnce(long id);
}
