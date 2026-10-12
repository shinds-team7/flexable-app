package com.flexable.api.budget;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface FixedExpenseRepository extends JpaRepository<FixedExpense, Long> {

	@Query("select f from FixedExpense f where f.userId = :userId order by f.sortOrder asc, f.id asc")
	List<FixedExpense> findOrdered(Long userId);

	@Modifying
	@Query("delete from FixedExpense f where f.userId = :userId")
	void deleteByUserId(Long userId);
}
