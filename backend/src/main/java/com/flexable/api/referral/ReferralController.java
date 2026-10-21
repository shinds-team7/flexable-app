package com.flexable.api.referral;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.referral.ReferralDtos.ReferralMe;
import com.flexable.api.referral.ReferralDtos.RegisterRequest;
import com.flexable.api.referral.ReferralDtos.Registered;

@RestController
@RequestMapping("/api/v1/referrals")
public class ReferralController {

	private final ReferralService service;

	public ReferralController(ReferralService service) {
		this.service = service;
	}

	@GetMapping("/me")
	ReferralMe me(@AuthenticationPrincipal Jwt jwt) {
		return service.me(CurrentUser.id(jwt));
	}

	@PostMapping
	Registered register(@AuthenticationPrincipal Jwt jwt, @RequestBody RegisterRequest req) {
		return service.register(CurrentUser.id(jwt), req.code());
	}
}
