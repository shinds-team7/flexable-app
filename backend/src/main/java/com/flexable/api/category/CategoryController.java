package com.flexable.api.category;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.category.CategoryDtos.CategoryResponse;
import com.flexable.api.category.CategoryDtos.CreateRequest;
import com.flexable.api.category.CategoryDtos.UpdateRequest;
import com.flexable.api.category.CategoryDtos.OrderRequest;
import com.flexable.api.common.TxType;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

	private final CategoryService service;

	public CategoryController(CategoryService service) {
		this.service = service;
	}

	@GetMapping
	List<CategoryResponse> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) TxType type) {
		return service.list(CurrentUser.id(jwt), type);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	CategoryResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateRequest req) {
		return service.create(CurrentUser.id(jwt), req);
	}

	@PatchMapping("/{id}")
	CategoryResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
			@Valid @RequestBody UpdateRequest req) {
		return service.update(CurrentUser.id(jwt), id, req);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
		service.delete(CurrentUser.id(jwt), id);
	}

	@PutMapping("/order")
	List<CategoryResponse> order(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody OrderRequest req) {
		return service.reorder(CurrentUser.id(jwt), req);
	}
}
