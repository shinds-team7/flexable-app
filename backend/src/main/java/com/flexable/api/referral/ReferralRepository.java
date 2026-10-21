package com.flexable.api.referral;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ReferralRepository extends JpaRepository<Referral, Long> {

	long countByInviterId(Long inviterId);

	@Modifying
	@Query("delete from Referral r where r.inviteeId = :userId")
	void deleteByInviteeId(Long userId);

	/** 초대한 사람이 탈퇴하면 기록은 남기고(다시 등록 못 하게) 초대한 사람만 비운다. */
	@Modifying
	@Query("update Referral r set r.inviterId = null where r.inviterId = :userId")
	void clearInviter(Long userId);
}
