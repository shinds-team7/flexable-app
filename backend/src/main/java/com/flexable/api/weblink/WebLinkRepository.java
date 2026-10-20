package com.flexable.api.weblink;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface WebLinkRepository extends JpaRepository<WebLink, Long> {

	Optional<WebLink> findByLinkHash(String linkHash);

	List<WebLink> findByUserIdOrderByCreatedAtDesc(long userId);

	@Modifying
	@Query("delete from WebLink l where l.linkHash = :linkHash")
	int deleteByLinkHash(String linkHash);

	@Modifying
	@Query("delete from WebLink l where l.id = :id and l.userId = :userId")
	int deleteByIdAndUserId(long id, long userId);
}
