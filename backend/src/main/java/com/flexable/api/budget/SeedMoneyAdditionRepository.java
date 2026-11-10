package com.flexable.api.budget;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SeedMoneyAdditionRepository extends JpaRepository<SeedMoneyAddition, Long> {

	List<SeedMoneyAddition> findByUserIdOrderByCreatedAtAscIdAsc(Long userId);

	@Query("select coalesce(sum(a.amount), 0) from SeedMoneyAddition a where a.userId = :userId")
	long sumByUserId(Long userId);

	/** 잔액 기준 시각 뒤에 옮긴 돈. 통장 잔액에서 빠진 돈이라 추정 잔액에서 뺀다. */
	@Query("select coalesce(sum(a.amount), 0) from SeedMoneyAddition a where a.userId = :userId and a.createdAt > :since and a.adjustment = false")
	long sumCreatedAfter(Long userId, Instant since);
}
