package com.flexable.api.budget;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface FixedExpensePostingRepository extends JpaRepository<FixedExpensePosting, Long> {

	/** 키가 날짜로 시작하므로 문자열 비교로 그 날짜 이후 기록만 가져온다. */
	@Query("select p from FixedExpensePosting p where p.userId = :userId and p.postingKey >= :from order by p.id")
	List<FixedExpensePosting> findFrom(Long userId, String from);

	@Query("select p.transactionId from FixedExpensePosting p where p.userId = :userId")
	List<Long> findTransactionIds(Long userId);

	@Modifying
	@Query("delete from FixedExpensePosting p where p.userId = :userId")
	void deleteByUserId(Long userId);
}
