package com.flexable.api.budget;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.budget.BudgetDtos.SettingsRequest;
import com.flexable.api.budget.BudgetDtos.SettingsResponse;
import com.flexable.api.budget.BudgetDtos.TodayResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/budget")
public class BudgetController {

	private final BudgetService service;

	public BudgetController(BudgetService service) {
		this.service = service;
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
}
