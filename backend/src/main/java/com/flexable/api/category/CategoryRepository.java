package com.flexable.api.category;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.flexable.api.common.TxType;

public interface CategoryRepository extends JpaRepository<Category, Long> {

	@Query("select c from Category c where c.userId = :userId order by c.isDefault desc, c.id asc")
	List<Category> findAllOrdered(Long userId);

	@Query("select c from Category c where c.userId = :userId and c.type = :type order by c.isDefault desc, c.id asc")
	List<Category> findAllOrdered(Long userId, TxType type);

	Optional<Category> findByIdAndUserId(Long id, Long userId);

	boolean existsByUserIdAndTypeAndName(Long userId, TxType type, String name);

	Optional<Category> findByUserIdAndTypeAndNameAndIsDefaultTrue(Long userId, TxType type, String name);

	@Modifying
	@Query("delete from Category c where c.userId = :userId")
	void deleteByUserId(Long userId);
}
