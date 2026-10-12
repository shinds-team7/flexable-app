package com.flexable.api.transaction;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

	Optional<Transaction> findByIdAndUserId(Long id, Long userId);

	Optional<Transaction> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

	/** [from, to) 구간, 최신순 */
	@Query("select t from Transaction t where t.userId = :userId and t.occurredAt >= :from and t.occurredAt < :to"
			+ " order by t.occurredAt desc, t.id desc")
	List<Transaction> findInRange(Long userId, Instant from, Instant to);

	@Query("select t from Transaction t where t.userId = :userId and t.occurredAt >= :from")
	List<Transaction> findSince(Long userId, Instant from);

	@Modifying
	@Query("update Transaction t set t.categoryId = :to where t.userId = :userId and t.categoryId = :from")
	int moveCategory(Long userId, Long from, Long to);

	@Modifying
	@Query("delete from Transaction t where t.userId = :userId")
	void deleteByUserId(Long userId);
}
