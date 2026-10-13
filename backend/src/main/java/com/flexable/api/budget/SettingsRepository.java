package com.flexable.api.budget;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface SettingsRepository extends JpaRepository<BudgetSettings, Long> {

	/** 같은 사용자의 고정지출 자동 기록을 한 번에 하나만 하도록 잠근다. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select b from BudgetSettings b where b.userId = :userId")
	Optional<BudgetSettings> findForUpdate(Long userId);

	@Modifying
	@Query("delete from BudgetSettings b where b.userId = :userId")
	void deleteByUserId(Long userId);
}
