package com.flexable.api.coin;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface CoinLedgerRepository extends JpaRepository<CoinLedger, Long> {

	boolean existsByUserIdAndReasonAndRefKey(Long userId, CoinReason reason, String refKey);

	/** 아직 모달로 보여 주지 않은 보상, 오래된 순 */
	@Query("select l from CoinLedger l where l.userId = :userId and l.notifiedAt is null order by l.id")
	List<CoinLedger> findUnnotified(Long userId);

	/** 내 내역만 표시한다. 남의 id는 user_id 조건에 걸러진다. */
	@Modifying
	@Query("update CoinLedger l set l.notifiedAt = :now where l.userId = :userId and l.id in :ids and l.notifiedAt is null")
	int markNotified(Long userId, Collection<Long> ids, Instant now);

	/** before보다 오래된 내 내역, 최신순 */
	List<CoinLedger> findByUserIdAndIdLessThanOrderByIdDesc(Long userId, Long before, Limit limit);

	@Modifying
	@Query("delete from CoinLedger l where l.userId = :userId")
	void deleteByUserId(Long userId);
}
