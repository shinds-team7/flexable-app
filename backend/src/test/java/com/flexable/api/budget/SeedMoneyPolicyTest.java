package com.flexable.api.budget;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * docs/policies.md §3 예시 표 = tests/policy/seed-money.json. 반영 대기는 저장된 하루 예산·반영 기록에 달려 있어 API로 검사한다.
 * 케이스마다 새 회원으로 start 날 정오(서울)에 예산을 설정하고 오늘 쓸 수 있는 돈을 조회한 뒤, date 날 정오에 조회·반영한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeedMoneyPolicyTest {

	private static final JsonMapper JSON = JsonMapper.builder().build();

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

	@TestFactory
	Stream<DynamicTest> seedMoneyPolicyCases() throws Exception {
		JsonNode root = JSON.readTree(Files.readString(Path.of("..", "tests", "policy", "seed-money.json")));
		return root.get("cases").valueStream().map(c -> DynamicTest.dynamicTest(c.get("name").asString(), () -> run(c)));
	}

	private void run(JsonNode c) throws Exception {
		clock.seoulNoon(c.get("start").asString());
		String token = signup();
		call(put("/api/v1/budget/settings"), token, settings(c.get("settings")), 200);
		call(get("/api/v1/budget/today"), token, null, 200);

		clock.seoulNoon(c.get("date").asString());
		JsonNode seed = call(get("/api/v1/budget/seed-money"), token, null, 200);
		JsonNode pending = c.get("pending");
		if (pending.isNull()) {
			assertThat(seed.get("pending").isNull()).as("반영할 주기 없음").isTrue();
			return;
		}
		JsonNode p = seed.get("pending");
		assertThat(p.get("cycleEnd").asString()).isEqualTo(pending.get("cycleEnd").asString());
		assertThat(p.get("payday").asString()).isEqualTo(pending.get("payday").asString());
		assertThat(p.get("goalAmount").asLong()).isEqualTo(pending.get("goalAmount").asLong());
		assertThat(p.get("allAmount").asLong()).isEqualTo(pending.get("allAmount").asLong());
		if (!c.has("confirm")) {
			return;
		}

		ObjectNode body = ((ObjectNode) c.get("confirm").deepCopy()).put("cycleEnd", p.get("cycleEnd").asString());
		JsonNode after = call(post("/api/v1/budget/seed-money/entries"), token, body.toString(), 201);
		JsonNode ex = c.get("after");
		assertThat(after.get("total").asLong()).isEqualTo(ex.get("total").asLong());
		assertThat(after.get("saved").asLong()).isEqualTo(ex.get("saved").asLong());
		assertThat(after.get("pending").isNull()).isTrue();
		JsonNode today = call(get("/api/v1/budget/today"), token, null, 200);
		assertThat(today.get("estimatedBalance").asLong()).isEqualTo(ex.get("estimatedBalance").asLong());
	}

	private static String settings(JsonNode s) {
		ObjectNode body = JSON.createObjectNode()
			.put("balance", s.get("balance").asLong())
			.put("payday", s.get("payday").asInt())
			.put("incomeAmount", 2_000_000)
			.put("cardUnpaid", s.get("cardUnpaid").asLong())
			.put("seedBase", s.get("seedBase").asLong());
		ArrayNode fixed = body.putArray("fixedExpenses");
		s.get("fixed").valueStream().forEach(f -> fixed.addObject()
			.put("name", "고정지출" + f.get("day").asInt())
			.put("amount", f.get("amount").asLong())
			.put("day", f.get("day").asInt()));
		ArrayNode saving = body.putArray("protectedItems");
		s.get("protected").valueStream().forEach(a -> saving.addObject().put("name", "적금").put("amount", a.asLong()));
		return body.toString();
	}

	private String signup() throws Exception {
		String body = "{\"email\":\"policy-" + UUID.randomUUID()
				+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}";
		return call(post("/api/v1/auth/signup"), null, body, 201).get("accessToken").asString();
	}

	private JsonNode call(MockHttpServletRequestBuilder req, String token, String body, int status) throws Exception {
		if (token != null) {
			req.header("Authorization", "Bearer " + token);
		}
		if (body != null) {
			req.contentType(MediaType.APPLICATION_JSON).content(body);
		}
		var res = mvc.perform(req).andReturn().getResponse();
		String text = res.getContentAsString(StandardCharsets.UTF_8);
		assertThat(res.getStatus()).as(text).isEqualTo(status);
		return JSON.readTree(text);
	}
}
