package com.flexable.api.budget;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SeedMoneyEntryRepository extends JpaRepository<SeedMoneyEntry, Long> {

	List<SeedMoneyEntry> findByUserIdOrderByCycleEndDesc(Long userId);

	List<SeedMoneyEntry> findByUserIdOrderByCycleEndAsc(Long userId);

	boolean existsByUserIdAndCycleEnd(Long userId, LocalDate cycleEnd);

	/** 잔액 기준 시각 뒤에 옮긴 돈. 통장 잔액에서 빠진 돈이라 추정 잔액에서 뺀다. */
	@Query("select coalesce(sum(e.amount), 0) from SeedMoneyEntry e where e.userId = :userId and e.createdAt > :since")
	long sumCreatedAfter(Long userId, Instant since);
}
