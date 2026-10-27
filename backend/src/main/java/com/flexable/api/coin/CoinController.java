package com.flexable.api.coin;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.coin.CoinDtos.AckRequest;
import com.flexable.api.coin.CoinDtos.CheckInResponse;
import com.flexable.api.coin.CoinDtos.CollectResponse;
import com.flexable.api.coin.CoinDtos.LedgerPage;
import com.flexable.api.coin.CoinDtos.Wallet;

/** 코인 지갑·check-in·모으기. 규칙은 docs/coin-plan.md. */
@RestController
@RequestMapping("/api/v1/coins")
public class CoinController {

	private final CoinService service;

	public CoinController(CoinService service) {
		this.service = service;
	}

	@PostMapping("/check-in")
	CheckInResponse checkIn(@AuthenticationPrincipal Jwt jwt) {
		return service.checkIn(CurrentUser.id(jwt));
	}

	@PostMapping("/rewards/ack")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void ack(@AuthenticationPrincipal Jwt jwt, @RequestBody AckRequest req) {
		service.ack(CurrentUser.id(jwt), req.ids());
	}

	@GetMapping
	Wallet wallet(@AuthenticationPrincipal Jwt jwt) {
		return service.wallet(CurrentUser.id(jwt));
	}

	@PostMapping("/collect")
	CollectResponse collect(@AuthenticationPrincipal Jwt jwt) {
		return service.collect(CurrentUser.id(jwt));
	}

	@GetMapping("/ledger")
	LedgerPage ledger(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long before,
			@RequestParam(defaultValue = "" + CoinService.LEDGER_DEFAULT_LIMIT) int limit) {
		return service.ledger(CurrentUser.id(jwt), before, limit);
	}
}
