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

		wallet(me[0]).andExpect(jsonPath("$.balance").value(30))
			.andExpect(jsonPath("$.ad.rewardedToday").value(3));
	}

	@Test
	void rejectsBadSignatureAndMalformedRequests() throws Exception {
		String[] me = signup();
		callback(me[1], "tx1", "forged").andExpect(status().isForbidden());
		callback("abc", "tx1", "ok").andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/ads/reward-callback")).andExpect(status().isForbidden());
		wallet(me[0]).andExpect(jsonPath("$.balance").value(0));
	}
}
