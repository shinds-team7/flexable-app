package com.flexable.api.budget;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
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
 * 요일별 비중(§5): 프리셋을 고르면 오늘 하루 예산부터 바뀐다. 2026-10-27(화) 정오로 시계를 고정하고,
 * 수입일 25일이면 다음 수입일은 11-25(수)라 남은 29일 중 화요일만 5번이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DayWeightsFlowTest {

	static class MutableClock extends Clock {
		volatile Instant now = Instant.parse("2026-10-27T03:00:00Z");

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

	private static final String SETTINGS = "{\"balance\":1000000,\"payday\":25,\"incomeAmount\":2000000,"
			+ "\"cardUnpaid\":0,\"fixedExpenses\":[],\"protectedItems\":[]}";

	private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder b, String token, String body) {
		b.header("Authorization", "Bearer " + token);
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private String read(ResultActions r, String path) throws Exception {
		return String.valueOf((Object) JsonPath.read(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), path));
	}

	/** 토큰 만료는 실제 시각으로 검사하므로, 가입(토큰 발급)만 지금 시각에 하고 고정한 시각으로 돌아온다. */
	private String signup() throws Exception {
		Instant fixed = clock.now;
		clock.now = Instant.now();
		try {
			ResultActions r = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"days-" + UUID.randomUUID()
						+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
				.andExpect(status().isCreated());
			return read(r, "$.accessToken");
		}
		finally {
			clock.now = fixed;
		}
	}

	private void spend(String token, long category, String date, long amount) throws Exception {
		mvc.perform(auth(post("/api/v1/transactions"), token, "{\"type\":\"EXPENSE\",\"amount\":" + amount
				+ ",\"categoryId\":" + category + ",\"title\":\"x\",\"occurredAt\":\"" + date + "T12:00:00+09:00\"}"))
			.andExpect(status().isCreated());
	}

	@Test
	void presetChangesTodayBudget() throws Exception {
		String token = signup();
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());

		// 기본 배분: 1,000,000 ÷ 29일
		mvc.perform(auth(get("/api/v1/budget/today"), token, null))
			.andExpect(jsonPath("$.dayPreset", is("EVEN")))
			.andExpect(jsonPath("$.dailyBudget", is(34482)));
		mvc.perform(auth(get("/api/v1/budget/day-weights"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.preset", is("EVEN")))
			.andExpect(jsonPath("$.presets[1].id", is("RECORD")))
			.andExpect(jsonPath("$.presets[1].weights", nullValue()))
			.andExpect(jsonPath("$.record.days", is(0)))
			.andExpect(jsonPath("$.record.from", nullValue()));
		mvc.perform(auth(put("/api/v1/budget/day-weights"), token, "{\"preset\":\"RECORD\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.preset").exists());

		// 10-20(화)~10-26(월) 하루씩 기록: 월~목 10,000, 금 20,000, 토 30,000, 일 15,000
		String categories = mvc.perform(auth(get("/api/v1/categories?type=EXPENSE"), token, null))
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		long food = ((Number) JsonPath.<net.minidev.json.JSONArray>read(categories, "$[?(@.name == '식비')].id").get(0)).longValue();
		String[] dates = { "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26" };
		long[] amounts = { 10000, 10000, 10000, 20000, 30000, 15000, 10000 };
		for (int i = 0; i < dates.length; i++) {
			spend(token, food, dates[i], amounts[i]);
		}
		mvc.perform(auth(get("/api/v1/budget/day-weights"), token, null))
			.andExpect(jsonPath("$.presets[1].weights", contains(10, 10, 9, 9, 19, 29, 14)))
			.andExpect(jsonPath("$.record.from", is("2026-10-20")))
			.andExpect(jsonPath("$.record.days", is(7)));

		mvc.perform(auth(put("/api/v1/budget/day-weights"), token, "{\"preset\":\"RECORD\",\"weights\":[30,30,30,30,30,30,30]}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.preset", is("RECORD")))
			.andExpect(jsonPath("$.weights", contains(10, 10, 9, 9, 19, 29, 14)));
		// 남은 날 비중 합 = 4주 × 100 + 화요일 10 = 410. 화 1,000,000 × 10 ÷ 410, 토 × 29 ÷ 410
		mvc.perform(auth(get("/api/v1/budget/today"), token, null))
			.andExpect(jsonPath("$.dayPreset", is("RECORD")))
			.andExpect(jsonPath("$.dailyBudget", is(24390)))
			.andExpect(jsonPath("$.dayBudgets[5]", is(70731)));

		mvc.perform(auth(put("/api/v1/budget/day-weights"), token, "{\"preset\":\"CUSTOM\",\"weights\":[5,5,5,5,5,5,31]}"))
			.andExpect(status().isBadRequest());
		mvc.perform(auth(put("/api/v1/budget/day-weights"), token, "{\"preset\":\"CUSTOM\",\"weights\":[5,5]}"))
			.andExpect(status().isBadRequest());
		mvc.perform(auth(put("/api/v1/budget/day-weights"), token, "{\"preset\":\"CUSTOM\",\"weights\":[10,30,10,10,10,10,10]}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.preset", is("CUSTOM")));
		// 비중 합 = 4주 × 90 + 화요일 30 = 390. 화 1,000,000 × 30 ÷ 390
		mvc.perform(auth(get("/api/v1/budget/today"), token, null))
			.andExpect(jsonPath("$.dailyBudget", is(76923)));

		// 예산을 다시 설정해도 비중은 그대로
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());
		mvc.perform(auth(get("/api/v1/budget/day-weights"), token, null))
			.andExpect(jsonPath("$.preset", is("CUSTOM")))
			.andExpect(jsonPath("$.weights", contains(10, 30, 10, 10, 10, 10, 10)));
	}
}
