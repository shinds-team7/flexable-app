package com.flexable.api.transaction;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.budget.FixedExpensePoster;
import com.flexable.api.common.TxType;
import com.flexable.api.transaction.TransactionDtos.CreateRequest;
import com.flexable.api.transaction.TransactionDtos.ListResponse;
import com.flexable.api.transaction.TransactionDtos.TransactionResponse;
import com.flexable.api.transaction.TransactionDtos.UpdateRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/transactions")
public class TransactionController {

	private final TransactionService service;
	private final FixedExpensePoster fixedPoster;

	public TransactionController(TransactionService service, FixedExpensePoster fixedPoster) {
		this.service = service;
		this.fixedPoster = fixedPoster;
	}

	@GetMapping
	ListResponse list(@AuthenticationPrincipal Jwt jwt,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(required = false) TxType type, @RequestParam(required = false) Long categoryId) {
		fixedPoster.postDue(CurrentUser.id(jwt));
		return new ListResponse(service.list(CurrentUser.id(jwt), from, to, type, categoryId));
	}

	@PostMapping
	ResponseEntity<TransactionResponse> create(@AuthenticationPrincipal Jwt jwt,
			@RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
			@Valid @RequestBody CreateRequest req) {
		TransactionService.Created created = service.create(CurrentUser.id(jwt), req, idempotencyKey);
		return ResponseEntity.status(created.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(created.body());
	}

	@GetMapping("/{id}")
	TransactionResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
		return service.get(CurrentUser.id(jwt), id);
	}

	@PatchMapping("/{id}")
	TransactionResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
			@Valid @RequestBody UpdateRequest req) {
		return service.update(CurrentUser.id(jwt), id, req);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
		service.delete(CurrentUser.id(jwt), id);
	}
}
