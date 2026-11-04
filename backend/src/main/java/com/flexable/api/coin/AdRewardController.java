package com.flexable.api.coin;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * AdMob 보상형 광고 서버 검증(SSV) 콜백. 로그인 없이 구글 서버가 부르며, 서명이 맞을 때만 코인을 준다.
 * 앱은 광고 요청 때 user_id에 내 사용자 id를 넣는다. 규칙은 docs/coin-plan.md "광고 보상".
 */
@RestController
@RequestMapping("/api/v1/ads")
public class AdRewardController {

	private final CoinService coins;
	private final AdSignatureVerifier verifier;
	private final String adUnit;

	public AdRewardController(CoinService coins, AdSignatureVerifier verifier,
			@Value("${app.ad.unit-id:}") String adUnit) {
		this.coins = coins;
		this.verifier = verifier;
		this.adUnit = adUnit;
	}

	/** 이미 줬거나 한도를 넘은 콜백도 200으로 답한다(구글이 재시도하지 않게). 서명·형식이 틀리면 403/400. */
	@GetMapping("/reward-callback")
	ResponseEntity<Void> callback(HttpServletRequest request) {
		String query = request.getQueryString();
		if (!verifier.verify(query)) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
		}
		String transactionId = decoded(query, "transaction_id");
		String userId = decoded(query, "user_id");
		String unit = decoded(query, "ad_unit");
		boolean unitOk = adUnit.isBlank() || unit != null && adUnit.endsWith("/" + unit);
		if (transactionId == null || transactionId.length() > 40 || userId == null || !unitOk) {
			return ResponseEntity.badRequest().build();
		}
		long id;
		try {
			id = Long.parseLong(userId);
		}
		catch (NumberFormatException e) {
			return ResponseEntity.badRequest().build();
		}
		coins.rewardAd(id, transactionId);
		return ResponseEntity.ok().build();
	}

	private static String decoded(String query, String name) {
		String raw = GoogleAdSignatureVerifier.param(query, name);
		return raw == null ? null : URLDecoder.decode(raw, StandardCharsets.UTF_8);
	}
}
