package com.flexable.api.budget;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

/**
 * 시드머니: 모아둔 돈 + 수입일 전날부터 반영하는 주기별 금액. 날짜가 중요해서 시계를 고정한다.
 * 2026년 10월 26일(월)이 수입일이면 반영일(주기 마지막 날)은 10월 25일이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeedMoneyFlowTest {

	static final String KEY = "test-service-key-0123456789abcdef0123";

	static class MutableClock extends Clock {
		volatile Instant now = Instant.parse("2026-10-01T03:00:00Z");

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}

		@Override
		public Instant instant() {
			return now;
		}

		/** 서울 날짜 정오로 옮긴다. */
		void seoulNoon(String date) {
			now = Instant.parse(date + "T03:00:00Z");
		}
	}

	@TestConfiguration
	static class ClockConfig {
		@Bean
		@Primary
		MutableClock testClock() {
			return new MutableClock();
		}
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	MutableClock clock;

	private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder b, String token, String body) {
		b.header("Authorization", "Bearer " + token);
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private String read(ResultActions r, String path) throws Exception {
		return String.valueOf((Object) JsonPath.read(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), path));
	}

	private String signup() throws Exception {
		ResultActions r = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"seed-" + UUID.randomUUID()
					+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated());
		return read(r, "$.accessToken");
	}

	private static final String SETTINGS = "{\"balance\":1000000,\"payday\":26,\"incomeAmount\":2000000,"
			+ "\"cardUnpaid\":50000,\"fixedExpenses\":[],\"protectedItems\":[{\"name\":\"적금\",\"amount\":300000}]";

	@Test
	void confirmOncePerCycleAndWaitUntilNextCycle() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":500000}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.seedBase").value(500000));
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk());

		// 이전 앱(seedBase 없음)이 설정을 다시 저장해도 모아둔 돈은 그대로다.
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + "}"))
			.andExpect(jsonPath("$.seedBase").value(500000));

		// 앱을 쓰기 시작한 뒤 끝난 주기가 없으면 반영할 것이 없다.
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.base").value(500000))
			.andExpect(jsonPath("$.total").value(500000))
			.andExpect(jsonPath("$.monthlyGoal").value(300000))
			.andExpect(jsonPath("$.pending").value(nullValue()));

		// 수입일 전날: 매달 저축할 돈 30만, 남은 돈 전부 = 잔액 100만 − 카드 미결제 5만.
		clock.seoulNoon("2026-10-25");
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(jsonPath("$.pending.cycleEnd").value("2026-10-25"))
			.andExpect(jsonPath("$.pending.payday").value("2026-10-26"))
			.andExpect(jsonPath("$.pending.goalAmount").value(300000))
			.andExpect(jsonPath("$.pending.allAmount").value(950000));

		// 응답하지 않으면 다음 주기 중에도 기다린다.
		clock.seoulNoon("2026-10-28");
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(jsonPath("$.pending.cycleEnd").value("2026-10-25"));
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-10-25\",\"choice\":\"ALL\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.total").value(1450000))
			.andExpect(jsonPath("$.saved").value(950000))
			.andExpect(jsonPath("$.pending").value(nullValue()))
			.andExpect(jsonPath("$.entries[0].choice").value("ALL"));
		// 옮긴 돈은 통장 잔액에서 빠진다.
		mvc.perform(auth(get("/api/v1/budget/today"), token, null))
			.andExpect(jsonPath("$.estimatedBalance").value(50000));
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-10-25\",\"choice\":\"GOAL\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("SEED_NOT_PENDING"));

		// 다음 수입일(11/26 목) 전날. 직접 입력은 금액이 필요하고 0원도 된다.
		clock.seoulNoon("2026-11-25");
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-11-25\",\"choice\":\"MANUAL\"}"))
			.andExpect(status().isBadRequest());
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-11-25\",\"choice\":\"MANUAL\",\"amount\":0}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.total").value(1450000));
	}

	@Test
	void unansweredCycleIsSkippedAtNextCycleEnd() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":0}")).andExpect(status().isOk());
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk());

		clock.seoulNoon("2026-11-25");
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(jsonPath("$.pending.cycleEnd").value("2026-11-25"));
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-10-25\",\"choice\":\"GOAL\"}"))
			.andExpect(status().isConflict());
	}

	@Test
	void webLinkReadsConfirmedSeedMoney() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		String code = read(mvc.perform(auth(post("/api/v1/me/web-link-codes"), token, null)), "$.code");
		String linkId = read(mvc.perform(post("/internal/v1/web-links").header("X-Service-Key", KEY)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"" + code + "\"}")).andExpect(status().isCreated()), "$.linkId");

		mvc.perform(get("/internal/v1/web-links/" + linkId + "/seed-money").header("X-Service-Key", KEY))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("BUDGET_NOT_SET"));

		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":500000}")).andExpect(status().isOk());
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk());
		clock.seoulNoon("2026-10-25");
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-10-25\",\"choice\":\"GOAL\"}"))
			.andExpect(status().isCreated());

		mvc.perform(get("/internal/v1/web-links/" + linkId + "/seed-money").header("X-Service-Key", KEY))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total").value(800000))
			.andExpect(jsonPath("$.base").value(500000))
			.andExpect(jsonPath("$.monthlyGoal").value(300000))
			.andExpect(jsonPath("$.lastEntry.cycleEnd").value("2026-10-25"))
			.andExpect(jsonPath("$.lastEntry.choice").value("GOAL"))
			.andExpect(jsonPath("$.updatedAt").exists());
	}
}
