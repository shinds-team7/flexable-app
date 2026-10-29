package com.flexable.api.scheduled;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;

public interface ScheduledExpenseRepository extends JpaRepository<ScheduledExpense,Long> {
    Optional<ScheduledExpense> findByIdAndUserId(Long id, Long userId);
    List<ScheduledExpense> findByUserIdAndDateBetweenOrderByDateAscIdAsc(Long userId, LocalDate from, LocalDate to);
    boolean existsByUserIdAndCategoryId(Long userId, Long categoryId);
    @Modifying @Query("update ScheduledExpense e set e.categoryId=:to where e.userId=:userId and e.categoryId=:from")
    int moveCategory(Long userId, Long from, Long to);
    @Modifying @Query("delete from ScheduledExpense e where e.userId=:userId")
    void deleteByUserId(Long userId);
}
