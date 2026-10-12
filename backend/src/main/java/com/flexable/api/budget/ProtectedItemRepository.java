package com.flexable.api.budget;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProtectedItemRepository extends JpaRepository<ProtectedItem, Long> {

	@Query("select p from ProtectedItem p where p.userId = :userId order by p.sortOrder asc, p.id asc")
	List<ProtectedItem> findOrdered(Long userId);

	@Modifying
	@Query("delete from ProtectedItem p where p.userId = :userId")
	void deleteByUserId(Long userId);
}
