package com.flexable.api.coin;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface CoinWalletRepository extends JpaRepository<CoinWallet, Long> {

	/** 지갑이 없으면 만든다. 동시에 처음 요청이 와도 고유 키 충돌 없이 한 행만 남는다(H2도 MySQL 모드). */
	@Modifying
	@Query(value = "insert into coin_wallets (user_id, balance, passive_collected, version, created_at)"
			+ " values (:userId, 0, 0, 0, :now) on duplicate key update balance = balance", nativeQuery = true)
	void ensure(Long userId, Instant now);

	/** 잔액·적립을 바꾸는 요청은 지갑 행을 잠가 한 사용자에 하나씩 처리한다. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select w from CoinWallet w where w.userId = :userId")
	Optional<CoinWallet> findForUpdate(Long userId);

	/** 엔티티 대신 id만 돌려준다(뒤에서 잠그고 읽을 때 잠그기 전 값이 영속성 컨텍스트에 남지 않게). */
	@Query("select w.userId from CoinWallet w where w.referralCode = :code")
	Optional<Long> findUserIdByReferralCode(String code);

	boolean existsByReferralCode(String code);

	@Modifying
	@Query("delete from CoinWallet w where w.userId = :userId")
	void deleteByUserId(Long userId);
}
