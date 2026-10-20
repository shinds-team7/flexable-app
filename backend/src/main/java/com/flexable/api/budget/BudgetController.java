package com.flexable.api.budget;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.budget.BudgetDtos.SeedMoneyRequest;
import com.flexable.api.budget.BudgetDtos.SeedMoneyResponse;
import com.flexable.api.budget.BudgetDtos.SettingsRequest;
import com.flexable.api.budget.BudgetDtos.SettingsResponse;
import com.flexable.api.budget.BudgetDtos.TodayResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/budget")
public class BudgetController {

	private final BudgetService service;
	private final SeedMoneyService seedMoney;

	public BudgetController(BudgetService service, SeedMoneyService seedMoney) {
		this.service = service;
		this.seedMoney = seedMoney;
	}

	@GetMapping("/settings")
	SettingsResponse get(@AuthenticationPrincipal Jwt jwt) {
		return service.get(CurrentUser.id(jwt));
	}

	@PutMapping("/settings")
	SettingsResponse put(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SettingsRequest req) {
		return service.put(CurrentUser.id(jwt), req);
	}

	@GetMapping("/today")
	TodayResponse today(@AuthenticationPrincipal Jwt jwt) {
		return service.today(CurrentUser.id(jwt));
	}

	@GetMapping("/seed-money")
	SeedMoneyResponse seedMoney(@AuthenticationPrincipal Jwt jwt) {
		return seedMoney.get(CurrentUser.id(jwt));
	}

	@PostMapping("/seed-money/entries")
	@ResponseStatus(HttpStatus.CREATED)
	SeedMoneyResponse confirmSeedMoney(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SeedMoneyRequest req) {
		return seedMoney.confirm(CurrentUser.id(jwt), req);
	}
}
