package com.flexable.api.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.Request;
import com.atlassian.oai.validator.model.SimpleResponse;
import com.atlassian.oai.validator.report.LevelResolver;
import com.atlassian.oai.validator.report.ValidationReport;
import com.jayway.jsonpath.JsonPath;

/**
 * 계약 테스트: 실제 응답(상태 코드·본문)을 docs/contracts/app-api.yaml·web-link-api.yaml로 검사한다.
 * 스펙에 없는 상태 코드나 필드가 나오면 실패한다. 엔드포인트마다 정상·오류 응답을 한 번 이상 부른다.
 * 시드머니 반영 대기는 날짜에 달려 있어 시계를 고정한다. 토큰 만료는 실제 시각으로 검사하므로 가입은 지금 시각에 한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ContractTest {

	private static final OpenApiInteractionValidator APP = validator("app-api.yaml");
	private static final OpenApiInteractionValidator WEB = validator("web-link-api.yaml");
	private static final String KEY = "test-service-key-0123456789abcdef0123";
	private static final String PASSWORD = "abcd1234";

	static class MutableClock extends Clock {
		volatile Instant now = Instant.now();

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

	private static OpenApiInteractionValidator validator(String file) {
		try {
			String spec = Files.readString(Path.of("..", "docs", "contracts", file));
			return OpenApiInteractionValidator.createForInlineApiSpecification(spec)
				.withLevelResolver(LevelResolver.create()
					// 스펙에 적지 않은 필드가 응답에 있으면 실패
					.withLevel("validation.schema.additionalProperties", ValidationReport.Level.ERROR)
					.build())
				.build();
		}
		catch (Exception e) {
			throw new IllegalStateException("docs/contracts/" + file + "을 읽지 못했어요", e);
		}
	}

	@BeforeEach
	void realTime() {
		clock.now = Instant.now();
	}

	/** 요청을 보내고 상태 코드를 확인한 뒤 응답을 스펙으로 검사한다. */
	private MvcResult call(OpenApiInteractionValidator spec, MockHttpServletRequestBuilder req, int expectedStatus)
			throws Exception {
		MvcResult r = mvc.perform(req).andReturn();
		var res = r.getResponse();
		String body = res.getContentAsString(StandardCharsets.UTF_8);
		String what = r.getRequest().getMethod() + " " + r.getRequest().getRequestURI();
		assertThat(res.getStatus()).as("%s → %s", what, body).isEqualTo(expectedStatus);
		SimpleResponse.Builder b = SimpleResponse.Builder.status(res.getStatus());
		if (res.getContentType() != null) {
			b.withContentType(res.getContentType());
		}
		if (!body.isEmpty()) {
			b.withBody(body);
		}
		ValidationReport report = spec.validateResponse(r.getRequest().getRequestURI(),
				Request.Method.valueOf(r.getRequest().getMethod()), b.build());
		List<String> errors = report.getMessages()
			.stream()
			.filter(msg -> msg.getLevel() == ValidationReport.Level.ERROR)
			.map(msg -> msg.getKey() + ": " + msg.getMessage())
			.toList();
		assertThat(errors).as("%s 응답이 docs/contracts와 달라요. 본문: %s", what, body).isEmpty();
		return r;
	}

	private MvcResult app(MockHttpServletRequestBuilder req, int status) throws Exception {
		return call(APP, req, status);
	}

	private MvcResult web(MockHttpServletRequestBuilder req, int status) throws Exception {
		return call(WEB, req.header("X-Service-Key", KEY), status);
	}

	private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder req, String body) {
		return req.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder req, String token) {
		return req.header("Authorization", "Bearer " + token);
	}

	private static String read(MvcResult r, String path) throws Exception {
		return String.valueOf((Object) JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8), path));
	}

	private static String newEmail() {
		return "contract-" + UUID.randomUUID() + "@example.com";
	}

	private static String signupBody(String email) {
		return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"agreeTerms\":true,\"agreePrivacy\":true}";
	}

	private String signup() throws Exception {
		return read(app(json(post("/api/v1/auth/signup"), signupBody(newEmail())), 201), "$.accessToken");
	}

	private static final String SETTINGS = "{\"balance\":1000000,\"payday\":26,\"incomeAmount\":2000000,\"cardUnpaid\":50000,"
			+ "\"fixedExpenses\":[{\"name\":\"월세\",\"amount\":200000,\"day\":15}],"
			+ "\"protectedItems\":[{\"name\":\"적금\",\"amount\":300000}],\"seedBase\":500000}";

	@Test
	void 공개_엔드포인트() throws Exception {
		app(get("/api/v1/health"), 200);
		app(get("/api/v1/auth/oauth/providers"), 200);
		app(get("/api/v1/auth/oauth/naver/start").param("redirectUri", "flexable://oauth/callback"), 404);
		app(get("/api/v1/auth/oauth/kakao/start"), 400);
		app(get("/api/v1/auth/oauth/kakao/start").param("redirectUri", "flexable://oauth/callback")
			.param("codeChallenge", "x".repeat(43)), 302);
		app(get("/api/v1/auth/oauth/kakao/callback").param("state", "nope").param("code", "nope"), 400);
		app(json(post("/api/v1/auth/oauth/exchange"), "{\"code\":\"nope\",\"codeVerifier\":\"nope\"}"), 401);
	}

	@Test
	void 계정() throws Exception {
		String email = newEmail();
		app(json(post("/api/v1/auth/signup"), signupBody(email)), 201);
		app(json(post("/api/v1/auth/signup"), signupBody(email)), 409);
		app(json(post("/api/v1/auth/signup"), "{\"email\":\"bad\",\"password\":\"short\",\"agreeTerms\":false}"), 400);
		app(json(post("/api/v1/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"wrong1234\"}"), 401);
		String token = read(app(json(post("/api/v1/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"), 200),
				"$.accessToken");
		app(json(post("/api/v1/auth/login"), "{}"), 400);

		app(get("/api/v1/me"), 401);
		app(auth(get("/api/v1/me"), token), 200);
		app(auth(post("/api/v1/auth/logout"), token), 204);

		// 로그인 실패 10분 5회 → 429
		String locked = newEmail();
		for (int i = 0; i < 5; i++) {
			app(json(post("/api/v1/auth/login"), "{\"email\":\"" + locked + "\",\"password\":\"wrong1234\"}"), 401);
		}
		app(json(post("/api/v1/auth/login"), "{\"email\":\"" + locked + "\",\"password\":\"wrong1234\"}"), 429);

		String other = signup();
		app(auth(json(delete("/api/v1/me"), "{\"password\":\"wrong1234\"}"), other), 401);
		app(auth(json(delete("/api/v1/me"), "{}"), other), 400);
		app(auth(json(delete("/api/v1/me"), "{\"password\":\"" + PASSWORD + "\"}"), other), 204);
	}

	@Test
	void 예산_시드머니와_웹_연동() throws Exception {
		String token = signup();
		String code = read(app(auth(post("/api/v1/me/web-link-codes"), token), 201), "$.code");
		String linkId = read(web(json(post("/internal/v1/web-links"), "{\"code\":\"" + code + "\"}"), 201), "$.linkId");
		web(get("/internal/v1/web-links/" + linkId + "/profile"), 200);
		web(get("/internal/v1/web-links/" + linkId + "/seed-money"), 404);

		clock.seoulNoon("2026-10-01");
		app(auth(get("/api/v1/budget/settings"), token), 404);
		app(auth(get("/api/v1/budget/today"), token), 404);
		app(auth(get("/api/v1/budget/seed-money"), token), 404);
		app(auth(get("/api/v1/budget/day-weights"), token), 404);
		app(auth(json(put("/api/v1/budget/day-weights"), "{\"preset\":\"WEEKEND\"}"), token), 404);
		app(auth(json(put("/api/v1/budget/settings"), "{\"balance\":1000,\"payday\":40,\"incomeAmount\":0}"), token), 400);
		app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
		app(auth(get("/api/v1/budget/settings"), token), 200);
		app(auth(get("/api/v1/budget/today"), token), 200);
		app(auth(get("/api/v1/budget/day-weights"), token), 200);
		app(auth(json(put("/api/v1/budget/day-weights"), "{\"preset\":\"RECORD\"}"), token), 400);
		app(auth(json(put("/api/v1/budget/day-weights"), "{\"preset\":\"CUSTOM\"}"), token), 400);
		app(auth(json(put("/api/v1/budget/day-weights"), "{\"preset\":\"WEEKEND\"}"), token), 200);
		app(auth(json(put("/api/v1/budget/day-weights"), "{\"preset\":\"CUSTOM\",\"weights\":[5,10,15,20,25,30,30]}"), token), 200);
		app(auth(get("/api/v1/budget/today"), token), 200);
		app(auth(get("/api/v1/budget/seed-money"), token), 200);
		app(auth(json(post("/api/v1/budget/seed-money/entries"), "{\"cycleEnd\":\"2026-09-25\",\"choice\":\"GOAL\"}"), token), 409);

		// 수입일 전날: 반영 대기가 있고, 반영하면 기록이 생긴다
		clock.seoulNoon("2026-10-25");
		String cycleEnd = read(app(auth(get("/api/v1/budget/seed-money"), token), 200), "$.pending.cycleEnd");
		app(auth(json(post("/api/v1/budget/seed-money/entries"), "{\"cycleEnd\":\"" + cycleEnd + "\",\"choice\":\"MANUAL\"}"), token), 400);
		app(auth(json(post("/api/v1/budget/seed-money/entries"), "{\"cycleEnd\":\"" + cycleEnd + "\",\"choice\":\"ALL\"}"), token), 201);
		app(auth(get("/api/v1/budget/today"), token), 200);
		web(get("/internal/v1/web-links/" + linkId + "/seed-money"), 200);
		web(json(put("/internal/v1/web-links/" + linkId + "/seed-money"), "{\"total\":2000000}"), 200);
		web(json(put("/internal/v1/web-links/" + linkId + "/seed-money"), "{\"total\":0}"), 400);

		clock.now = Instant.now();
		app(auth(get("/api/v1/me/web-links"), token), 200);
		web(json(post("/internal/v1/web-links"), "{\"code\":\"ZZZZZZ\"}"), 400);
		web(json(post("/internal/v1/web-links"), "{}"), 400);
		call(WEB, get("/internal/v1/web-links/" + linkId + "/profile").header("X-Service-Key", "wrong"), 401);
		web(delete("/internal/v1/web-links/" + linkId), 204);
		web(get("/internal/v1/web-links/" + linkId + "/profile"), 404);
		web(delete("/internal/v1/web-links/" + linkId), 404);

		// 앱 사용자가 해제
		String code2 = read(app(auth(post("/api/v1/me/web-link-codes"), token), 201), "$.code");
		web(json(post("/internal/v1/web-links"), "{\"code\":\"" + code2 + "\"}"), 201);
		String id = read(app(auth(get("/api/v1/me/web-links"), token), 200), "$[0].id");
		app(auth(delete("/api/v1/me/web-links/" + id), token), 204);
		app(auth(delete("/api/v1/me/web-links/" + id), token), 404);
	}

	@Test
	void 카테고리_거래_분석() throws Exception {
		String token = signup();
		app(auth(get("/api/v1/categories"), token), 200);
		MvcResult expense = app(auth(get("/api/v1/categories").param("type", "EXPENSE"), token), 200);
		app(auth(get("/api/v1/categories").param("type", "NOPE"), token), 400);
		String defaultId = read(expense, "$[0].id");

		String created = read(app(auth(json(post("/api/v1/categories"), "{\"name\":\"모임\",\"type\":\"EXPENSE\"}"), token), 201), "$.id");
		app(auth(json(post("/api/v1/categories"), "{\"name\":\"모임\",\"type\":\"EXPENSE\"}"), token), 409);
		app(auth(json(post("/api/v1/categories"), "{\"name\":\"\",\"type\":\"EXPENSE\"}"), token), 400);
		app(auth(json(patch("/api/v1/categories/" + created), "{\"color\":\"#12B76A\"}"), token), 200);
		app(auth(json(patch("/api/v1/categories/999999999"), "{\"name\":\"없음\"}"), token), 404);
		app(auth(delete("/api/v1/categories/" + defaultId), token), 409);

		String body = "{\"type\":\"EXPENSE\",\"amount\":8500,\"categoryId\":" + created + ",\"title\":\"김밥\",\"memo\":\"점심\"}";
		String key = UUID.randomUUID().toString();
		String txId = read(app(auth(json(post("/api/v1/transactions"), body), token).header("Idempotency-Key", key), 201), "$.id");
		app(auth(json(post("/api/v1/transactions"), body), token).header("Idempotency-Key", key), 200);
		app(auth(json(post("/api/v1/transactions"), "{\"type\":\"EXPENSE\",\"amount\":0}"), token), 400);
		String today = java.time.LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
		app(auth(get("/api/v1/transactions").param("from", today).param("to", today), token), 200);
		app(auth(get("/api/v1/transactions").param("from", today), token), 400);
		app(auth(get("/api/v1/transactions/" + txId), token), 200);
		app(auth(get("/api/v1/transactions/999999999"), token), 404);
		app(auth(json(patch("/api/v1/transactions/" + txId), "{\"memo\":null,\"amount\":9000}"), token), 200);
		app(auth(get("/api/v1/analysis/summary").param("from", today).param("to", today), token), 200);
		app(auth(get("/api/v1/analysis/summary").param("from", today), token), 400);

		// 카테고리를 지우면 거래는 기본 '기타'로 옮겨진다
		app(auth(delete("/api/v1/categories/" + created), token), 204);
		app(auth(delete("/api/v1/categories/" + created), token), 404);
		app(auth(get("/api/v1/transactions/" + txId), token), 200);
		app(auth(delete("/api/v1/transactions/" + txId), token), 204);
		app(auth(delete("/api/v1/transactions/" + txId), token), 404);
	}

	@Test
	void 코인_코스튬_추천() throws Exception {
		String token = signup();
		MvcResult checkIn = app(auth(post("/api/v1/coins/check-in"), token), 200);
		String rewardId = read(checkIn, "$.rewards[0].id");
		app(auth(json(post("/api/v1/coins/rewards/ack"), "{\"ids\":[" + rewardId + "]}"), token), 204);
		app(auth(get("/api/v1/coins"), token), 200);
		app(auth(post("/api/v1/coins/collect"), token), 200);

		app(auth(get("/api/v1/outfits"), token), 200);
		app(auth(post("/api/v1/outfits/outfit-03/purchase"), token), 200);
		app(auth(post("/api/v1/outfits/outfit-03/purchase"), token), 409);
		String newest = read(app(auth(get("/api/v1/coins/ledger?limit=1"), token), 200), "$.nextBefore");
		app(auth(get("/api/v1/coins/ledger?before=" + newest), token), 200);
		app(auth(get("/api/v1/coins/ledger?limit=0"), token), 400);
		app(auth(post("/api/v1/outfits/costume-lv1/purchase"), token), 409);
		app(auth(json(put("/api/v1/outfits/equipped"), "{\"outfitId\":\"outfit-03\"}"), token), 200);
		app(auth(json(put("/api/v1/outfits/equipped"), "{\"outfitId\":\"outfit-01\"}"), token), 409);
		app(auth(json(put("/api/v1/outfits/equipped"), "{\"outfitId\":null}"), token), 200);

		String code = read(app(auth(get("/api/v1/referrals/me"), token), 200), "$.code");
		app(auth(json(post("/api/v1/referrals"), "{\"code\":\"" + code + "\"}"), token), 400);
		String other = signup();
		app(auth(json(post("/api/v1/referrals"), "{\"code\":\"" + code + "\"}"), other), 200);
		app(auth(json(post("/api/v1/referrals"), "{\"code\":\"" + code + "\"}"), other), 409);
	}
}
