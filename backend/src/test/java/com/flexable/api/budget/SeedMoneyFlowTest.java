package com.flexable.api.budget;

import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
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

	@Autowired
	SeedMoneyEntryRepository seedEntries;

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
				.content("{\"email\":\"seed-" + UUID.randomUUID()
						+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
				.andExpect(status().isCreated());
			return read(r, "$.accessToken");
		}
		finally {
			clock.now = fixed;
		}
	}

	private static final String SETTINGS = "{\"balance\":1000000,\"payday\":26,\"incomeAmount\":2000000,"
			+ "\"cardUnpaid\":50000,\"fixedExpenses\":[],\"protectedItems\":[{\"name\":\"적금\",\"amount\":300000}]";

	private String link(String token) throws Exception {
		String code = read(mvc.perform(auth(post("/api/v1/me/web-link-codes"), token, null)), "$.code");
		return read(mvc.perform(post("/internal/v1/web-links").header("X-Service-Key", KEY)
			.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code + "\"}"))
			.andExpect(status().isCreated()), "$.linkId");
	}

	private ResultActions webSeed(String linkId) throws Exception {
		return mvc.perform(get("/internal/v1/web-links/" + linkId + "/seed-money").header("X-Service-Key", KEY));
	}

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
		webSeed(linkId).andExpect(status().isOk())
			.andExpect(jsonPath("$.entries", hasSize(0)))
			.andExpect(jsonPath("$.startedOn").value(nullValue()))
			.andExpect(jsonPath("$.total").value(500000))
			.andExpect(jsonPath("$.base").value(500000))
			.andExpect(jsonPath("$.lastEntry").value(nullValue()));
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk());
		clock.seoulNoon("2026-10-25");
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(jsonPath("$.pending.cycleEnd").value("2026-10-25"));
		webSeed(linkId).andExpect(jsonPath("$.entries", hasSize(0)))
			.andExpect(jsonPath("$.startedOn").value("2026-10-01"))
			.andExpect(jsonPath("$.total").value(500000))
			.andExpect(jsonPath("$.pending").doesNotExist())
			.andExpect(jsonPath("$.goalAmount").doesNotExist())
			.andExpect(jsonPath("$.allAmount").doesNotExist())
			.andExpect(jsonPath("$.transactions").doesNotExist());
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
			.andExpect(jsonPath("$.entries[0].totalAfter").value(800000))
			.andExpect(jsonPath("$.entries[0].createdAt").value("2026-10-25T12:00:00+09:00"))
			.andExpect(jsonPath("$.updatedAt").exists());
	}

	@Test
	void webEditsTotalByChangingSeedBase() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		String linkId = link(token);
		mvc.perform(webPut(linkId, "{\"total\":1000000}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("BUDGET_NOT_SET"));

		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":500000}")).andExpect(status().isOk());
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk());
		clock.seoulNoon("2026-10-25");
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
				"{\"cycleEnd\":\"2026-10-25\",\"choice\":\"GOAL\"}"))
			.andExpect(status().isCreated());

		// 반영한 돈 300,000은 그대로 두고 모아둔 돈을 1,200,000 − 300,000으로 바꾼다.
		clock.seoulNoon("2026-10-27");
		mvc.perform(webPut(linkId, "{\"total\":1200000}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.total").value(1200000))
			.andExpect(jsonPath("$.base").value(900000))
			.andExpect(jsonPath("$.entries", hasSize(1)))
			.andExpect(jsonPath("$.entries[0].totalAfter").value(1200000))
			.andExpect(jsonPath("$.updatedAt").value("2026-10-27T12:00:00+09:00"));
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(jsonPath("$.base").value(900000))
			.andExpect(jsonPath("$.saved").value(300000))
			.andExpect(jsonPath("$.total").value(1200000));

		// 반영한 돈보다 작게는 고칠 수 없다. 반영한 돈과 같으면 모아둔 돈이 0원이다.
		mvc.perform(webPut(linkId, "{\"total\":299999}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
			.andExpect(jsonPath("$.fields.total").exists());
		mvc.perform(webPut(linkId, "{\"total\":300000}")).andExpect(jsonPath("$.base").value(0));
		mvc.perform(webPut(linkId, "{\"total\":-1}")).andExpect(status().isBadRequest());
		mvc.perform(webPut(linkId, "{}")).andExpect(status().isBadRequest());
		mvc.perform(put("/internal/v1/web-links/" + linkId + "/seed-money").contentType(MediaType.APPLICATION_JSON)
			.content("{\"total\":1}")).andExpect(status().isUnauthorized());
	}

	private MockHttpServletRequestBuilder webPut(String linkId, String body) {
		return put("/internal/v1/web-links/" + linkId + "/seed-money").header("X-Service-Key", KEY)
			.contentType(MediaType.APPLICATION_JSON)
			.content(body);
	}

	@Test
	void webHistoryKeepsConfirmedChoicesAndZeroButDoesNotFillSkippedCycles() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		String linkId = link(token);
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":500000}"))
			.andExpect(status().isOk());
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk());
		clock.seoulNoon("2026-10-25");
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
			"{\"cycleEnd\":\"2026-10-25\",\"choice\":\"ALL\"}"))
			.andExpect(status().isCreated());
		// 11월은 응답하지 않는다. 12월의 명시적인 0원만 기록으로 남긴다.
		// 12/26은 토요일이라 수입일이 12/28로 밀린다. 주기 종료일은 12/27이다.
		clock.seoulNoon("2026-12-27");
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
			"{\"cycleEnd\":\"2026-12-27\",\"choice\":\"MANUAL\",\"amount\":0}"))
			.andExpect(status().isCreated());
		clock.seoulNoon("2027-01-25");
		mvc.perform(auth(post("/api/v1/budget/seed-money/entries"), token,
			"{\"cycleEnd\":\"2027-01-25\",\"choice\":\"GOAL\"}"))
			.andExpect(status().isCreated());

		webSeed(linkId).andExpect(status().isOk())
			.andExpect(jsonPath("$.entries", hasSize(3)))
			.andExpect(jsonPath("$.entries[0].cycleEnd").value("2026-10-25"))
			.andExpect(jsonPath("$.entries[0].choice").value("ALL"))
			.andExpect(jsonPath("$.entries[0].amount").value(950000))
			.andExpect(jsonPath("$.entries[0].totalAfter").value(1450000))
			.andExpect(jsonPath("$.entries[1].cycleEnd").value("2026-12-27"))
			.andExpect(jsonPath("$.entries[1].choice").value("MANUAL"))
			.andExpect(jsonPath("$.entries[1].amount").value(0))
			.andExpect(jsonPath("$.entries[1].totalAfter").value(1450000))
			.andExpect(jsonPath("$.entries[2].cycleEnd").value("2027-01-25"))
			.andExpect(jsonPath("$.entries[2].choice").value("GOAL"))
			.andExpect(jsonPath("$.entries[2].amount").value(300000))
			.andExpect(jsonPath("$.entries[2].totalAfter").value(1750000))
			.andExpect(jsonPath("$.total").value(1750000));

		// base를 바꾸면 과거 누적값도 같은 차액만큼 바뀐다. 시작일과 확정 금액은 유지한다.
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":100000}"))
			.andExpect(status().isOk());
		webSeed(linkId).andExpect(jsonPath("$.startedOn").value("2026-10-01"))
			.andExpect(jsonPath("$.base").value(100000))
			.andExpect(jsonPath("$.entries[0].totalAfter").value(1050000))
			.andExpect(jsonPath("$.entries[1].totalAfter").value(1050000))
			.andExpect(jsonPath("$.entries[2].totalAfter").value(1350000))
			.andExpect(jsonPath("$.total").value(1350000))
			.andExpect(jsonPath("$.lastEntry.cycleEnd").value("2027-01-25"))
			.andExpect(jsonPath("$.updatedAt").value("2027-01-25T12:00:00+09:00"));
	}

	@Test
	void webHistoryIncludesAllCyclesInOrderAndOnlyLinkedUser() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		String linkId = link(token);
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS + ",\"seedBase\":500000}"))
			.andExpect(status().isOk());
		long userId = Long.parseLong(read(mvc.perform(auth(get("/api/v1/me"), token, null)), "$.id"));
		// 저장 순서와 무관하게 정렬하고, 앱의 12건 제한을 적용하지 않는지 확인한다.
		for (int i = 12; i >= 0; i--) {
			seedEntries.save(new SeedMoneyEntry(userId, LocalDate.of(2025, 9, 25).plusMonths(i),
				SeedMoneyEntry.Choice.MANUAL, 100, clock.instant()));
		}
		String otherToken = signup();
		long otherId = Long.parseLong(read(mvc.perform(auth(get("/api/v1/me"), otherToken, null)), "$.id"));
		seedEntries.save(new SeedMoneyEntry(otherId, LocalDate.of(2025, 9, 25),
			SeedMoneyEntry.Choice.MANUAL, 999, clock.instant()));
		webSeed(linkId).andExpect(status().isOk())
			.andExpect(jsonPath("$.entries", hasSize(13)))
			.andExpect(jsonPath("$.entries[0].cycleEnd").value("2025-09-25"))
			.andExpect(jsonPath("$.entries[0].totalAfter").value(500100))
			.andExpect(jsonPath("$.entries[12].cycleEnd").value("2026-09-25"))
			.andExpect(jsonPath("$.entries[12].totalAfter").value(501300))
			.andExpect(jsonPath("$.total").value(501300));
		mvc.perform(auth(get("/api/v1/budget/seed-money"), token, null))
			.andExpect(jsonPath("$.entries", hasSize(12)))
			.andExpect(jsonPath("$.entries[0].cycleEnd").value("2026-09-25"));
	}

	@Test
	void webSeedErrorsRemainUnchanged() throws Exception {
		clock.seoulNoon("2026-10-01");
		String token = signup();
		String linkId = link(token);
		webSeed(linkId).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("BUDGET_NOT_SET"));
		webSeed("unknown-link").andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
		String path = "/internal/v1/web-links/" + linkId + "/seed-money";
		for (String key : new String[] { null, "wrong-key-wrong-key-wrong-key-wrong" }) {
			MockHttpServletRequestBuilder request = get(path);
			if (key != null) request.header("X-Service-Key", key);
			mvc.perform(request).andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
		}
		mvc.perform(auth(get(path), token, null)).andExpect(status().isUnauthorized());
		mvc.perform(delete("/internal/v1/web-links/" + linkId).header("X-Service-Key", KEY))
			.andExpect(status().isNoContent());
		webSeed(linkId).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
	}
}
