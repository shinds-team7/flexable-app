package com.flexable.api.outfit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OutfitRepository extends JpaRepository<Outfit, String> {

	@Query("select o from Outfit o order by o.sortOrder")
	List<Outfit> findOrdered();
}
