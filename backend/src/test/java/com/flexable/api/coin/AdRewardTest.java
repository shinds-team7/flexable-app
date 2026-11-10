package com.flexable.api.coin;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

/** 광고 보상(AdMob 서버 검증 콜백). 규칙은 docs/coin-plan.md "광고 보상": 하루 3회, 1회 10코인, 같은 transaction_id는 한 번. */
@SpringBootTest
@AutoConfigureMockMvc
class AdRewardTest {

	/** 구글 서명 검증은 가짜로 바꾼다: 서명 값이 "ok"일 때만 통과. 실제 검증은 GoogleAdSignatureVerifierTest. */
	@TestConfiguration
	static class Config {
		@Bean
		@Primary
		AdSignatureVerifier fakeVerifier() {
			return q -> q != null && q.contains("&signature=ok");
		}
	}

	@Autowired
	MockMvc mvc;

	private String[] signup() throws Exception {
		ResultActions r = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"ad-" + UUID.randomUUID()
					+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated());
		String body = r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		return new String[] { JsonPath.read(body, "$.accessToken"), String.valueOf((Object) JsonPath.read(body, "$.user.id")) };
	}

	private ResultActions callback(String userId, String tx, String signature) throws Exception {
		return mvc.perform(get("/api/v1/ads/reward-callback?ad_network=5450213213286189855&ad_unit=1234&reward_amount=1"
				+ "&reward_item=coin&timestamp=1&transaction_id=" + tx + "&user_id=" + userId + "&signature="
				+ signature + "&key_id=1"));
	}

	private ResultActions wallet(String token) throws Exception {
		return mvc.perform(get("/api/v1/coins").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
	}

	@Test
	void paysTenCoinsThreeTimesADayAndOncePerTransaction() throws Exception {
		String[] me = signup();
		wallet(me[0]).andExpect(jsonPath("$.ad.rewardedToday").value(0))
			.andExpect(jsonPath("$.ad.dailyLimit").value(3))
			.andExpect(jsonPath("$.ad.reward").value(10));

		callback(me[1], "tx1", "ok").andExpect(status().isOk());
		// 같은 transaction_id를 다시 보내도(구글 재시도) 한 번만 준다
		callback(me[1], "tx1", "ok").andExpect(status().isOk());
		callback(me[1], "tx2", "ok").andExpect(status().isOk());
		callback(me[1], "tx3", "ok").andExpect(status().isOk());
		// 4번째는 한도를 넘어 200이지만 주지 않는다
		callback(me[1], "tx4", "ok").andExpect(status().isOk());

		wallet(me[0]).andExpect(jsonPath("$.balance").value(530))
			.andExpect(jsonPath("$.ad.rewardedToday").value(3));
	}

	@Test
	void unknownUserGetsOkWithoutReward() throws Exception {
		// AdMob 콘솔의 URL 확인은 없는 user_id로 부르기도 한다. 500이 아니라 200이어야 한다
		callback("999999999", "tx1", "ok").andExpect(status().isOk());
	}

	@Test
	void rejectsBadSignatureAndMalformedRequests() throws Exception {
		String[] me = signup();
		callback(me[1], "tx1", "forged").andExpect(status().isForbidden());
		callback("abc", "tx1", "ok").andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/ads/reward-callback")).andExpect(status().isForbidden());
		wallet(me[0]).andExpect(jsonPath("$.balance").value(500));
	}
	private ResultActions bonus(String token, String requestId, int seconds) throws Exception {
		return mvc.perform(post("/api/v1/coins/ad-bonus").header("Authorization", "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"requestId\":\"" + requestId + "\",\"watchedSeconds\":" + seconds + "}"));
	}

	@Test
	void watchTimeBonusMakesTenFifteenOrTwentyAfterTheCallback() throws Exception {
		String[] me = signup();
		// 콜백이 오기 전에는 보너스를 줄 수 없다(앱이 잠시 뒤 다시 부른다)
		bonus(me[0], "req-0001", 40).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("AD_NOT_REWARDED"));

		callback(me[1], "tx1", "ok").andExpect(status().isOk());
		bonus(me[0], "req-0001", 20).andExpect(status().isOk())
			.andExpect(jsonPath("$.reward").value(10))
			.andExpect(jsonPath("$.bonus").value(5))
			.andExpect(jsonPath("$.total").value(15))
			.andExpect(jsonPath("$.wallet.balance").value(515));
		// 같은 요청을 다시 보내도 한 번만
		bonus(me[0], "req-0001", 20).andExpect(status().isOk()).andExpect(jsonPath("$.wallet.balance").value(515));
		// 광고 1번에 보너스 1번: 다른 요청 id라도 콜백이 더 오기 전에는 못 받는다
		bonus(me[0], "req-0002", 40).andExpect(status().isConflict());

		callback(me[1], "tx2", "ok").andExpect(status().isOk());
		bonus(me[0], "req-0002", 31).andExpect(status().isOk())
			.andExpect(jsonPath("$.bonus").value(10))
			.andExpect(jsonPath("$.total").value(20));

		callback(me[1], "tx3", "ok").andExpect(status().isOk());
		bonus(me[0], "req-0003", 14).andExpect(status().isOk())
			.andExpect(jsonPath("$.bonus").value(0))
			.andExpect(jsonPath("$.total").value(10));

		wallet(me[0]).andExpect(jsonPath("$.balance").value(545)).andExpect(jsonPath("$.ad.rewardedToday").value(3));
		mvc.perform(get("/api/v1/coins/ledger").header("Authorization", "Bearer " + me[0]))
			.andExpect(jsonPath("$.items[1].reason").value("AD_BONUS"))
			.andExpect(jsonPath("$.items[1].amount").value(10));
	}

	@Test
	void bonusBoundariesAndValidation() throws Exception {
		org.assertj.core.api.Assertions.assertThat(CoinService.adBonusFor(0)).isZero();
		org.assertj.core.api.Assertions.assertThat(CoinService.adBonusFor(14)).isZero();
		org.assertj.core.api.Assertions.assertThat(CoinService.adBonusFor(15)).isEqualTo(5);
		org.assertj.core.api.Assertions.assertThat(CoinService.adBonusFor(29)).isEqualTo(5);
		org.assertj.core.api.Assertions.assertThat(CoinService.adBonusFor(30)).isEqualTo(10);
		String[] me = signup();
		bonus(me[0], "short", 20).andExpect(status().isBadRequest());
		bonus(me[0], "req-0001", -1).andExpect(status().isBadRequest());
		bonus(me[0], "req-0001", 3601).andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/coins/ad-bonus").contentType(MediaType.APPLICATION_JSON)
			.content("{\"requestId\":\"req-0001\",\"watchedSeconds\":20}")).andExpect(status().isUnauthorized());
	}
}
