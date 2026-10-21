package com.flexable.api.outfit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserOutfitRepository extends JpaRepository<UserOutfit, UserOutfit.Key> {

	List<UserOutfit> findByUserId(Long userId);

	boolean existsByUserIdAndOutfitId(Long userId, String outfitId);

	@Modifying
	@Query("delete from UserOutfit o where o.userId = :userId")
	void deleteByUserId(Long userId);
}
