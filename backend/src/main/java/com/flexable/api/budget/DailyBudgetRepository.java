package com.flexable.api.budget;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface DailyBudgetRepository extends JpaRepository<DailyBudget, Long> {

	/** 같은 날짜는 덮어쓴다. 동시에 처음 요청이 와도 고유 키 충돌 없이 한 행만 남는다(H2도 MySQL 모드). */
	@Modifying
	@Query(value = "insert into daily_budgets (user_id, budget_date, daily_budget) values (:userId, :date, :budget)"
			+ " on duplicate key update daily_budget = :budget", nativeQuery = true)
	void upsert(Long userId, LocalDate date, long budget);

	@Query("select d from DailyBudget d where d.userId = :userId order by d.date")
	List<DailyBudget> findOrdered(Long userId);

	/** 설정 수정에 영향받지 않는 그래프 시작일. 아직 하루 예산을 조회하지 않았다면 null. */
	@Query("select min(d.date) from DailyBudget d where d.userId = :userId")
	LocalDate findFirstDate(Long userId);

	@Modifying
	@Query("delete from DailyBudget d where d.userId = :userId")
	void deleteByUserId(Long userId);
}
