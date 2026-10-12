package com.flexable.api.budget;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SettingsRepository extends JpaRepository<BudgetSettings, Long> {

	@Modifying
	@Query("delete from BudgetSettings b where b.userId = :userId")
	void deleteByUserId(Long userId);
}
