package com.flexable.api.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.Request;
import com.atlassian.oai.validator.model.SimpleResponse;
import com.atlassian.oai.validator.report.LevelResolver;
import com.atlassian.oai.validator.report.ValidationReport;
import com.flexable.api.chat.ChatModel;
import com.flexable.api.coin.AdSignatureVerifier;
import com.jayway.jsonpath.JsonPath;

/**
 * 계약 테스트: 실제 응답(상태 코드·본문)을 docs/contracts/app-api.yaml·web-link-api.yaml로 검사한다.
 * 스펙에 없는 상태 코드나 필드가 나오면 실패한다. 엔드포인트마다 정상·오류 응답을 한 번 이상 부른다.
 * 시드머니 반영 대기는 날짜에 달려 있어 시계를 고정한다. 토큰 만료는 실제 시각으로 검사하므로 가입은 지금 시각에 한다.
 * AI 메이트는 실제 Gemini 대신 가짜 모델(ChatModel)로 답한다.
 */
@SpringBootTest(properties = "app.chat.gemini-api-key=test-gemini-key")
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

	@MockitoBean
	ChatModel chatModel;

	@MockitoBean
	AdSignatureVerifier adVerifier;

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
		app(json(post("/api/v1/client-errors"),
				"{\"kind\":\"API\",\"message\":\"계약 확인\",\"method\":\"POST\",\"path\":\"/api/v1/transactions\",\"status\":400}"),
				204);
		app(json(post("/api/v1/client-errors"), "{\"kind\":\"SERVER\",\"message\":\"x\"}"), 400);
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
		app(auth(json(post("/api/v1/budget/seed-money/transfers"), "{\"amount\":1}"), token), 201);
		app(auth(json(post("/api/v1/budget/seed-money/transfers"), "{\"amount\":0}"), token), 400);
		app(auth(json(put("/api/v1/budget/seed-money/base"), "{\"base\":10}"), token), 200);
		app(auth(json(put("/api/v1/budget/seed-money/base"), "{\"base\":-1}"), token), 400);
		app(json(put("/api/v1/budget/seed-money/total"), "{\"total\":1}"), 401);
		app(auth(json(put("/api/v1/budget/seed-money/total"), "{\"total\":-1}"), token), 400);
		app(auth(json(put("/api/v1/budget/seed-money/total"), "{\"total\":1000000000000}"), token), 400);
		app(auth(json(put("/api/v1/budget/seed-money/total"), "{}"), token), 400);
		app(auth(json(put("/api/v1/budget/seed-money/total"), "{\"total\":100}"), token), 200);

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
		app(auth(delete("/api/v1/categories/" + defaultId), token), 204);

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
	void AI_메이트() throws Exception {
		String token = signup();
		String ask = "{\"messages\":[{\"role\":\"MODEL\",\"text\":\"무엇을 도와드릴까요?\"},"
				+ "{\"role\":\"USER\",\"text\":\"주말에 좀 더 쓰고 싶어\"}],\"mate\":\"FRIEND\"}";
		app(json(post("/api/v1/chat/messages"), ask), 401);
		app(auth(json(post("/api/v1/chat/messages"), "{\"messages\":[]}"), token), 400);
		app(auth(json(post("/api/v1/chat/messages"), "{\"messages\":[{\"role\":\"MODEL\",\"text\":\"안녕\"}]}"), token), 400);

		// 예산 설정 전에도 답한다(제안 없음)
		when(chatModel.generate(any(), any(), any())).thenReturn(new ChatModel.Reply("초기 예산을 먼저 설정해 주세요.", null));
		app(auth(json(post("/api/v1/chat/messages"), ask), token), 200);

		app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
		when(chatModel.generate(any(), any(), any())).thenReturn(new ChatModel.Reply("", "WEEKEND"));
		MvcResult proposed = app(auth(json(post("/api/v1/chat/messages"), ask), token), 200);
		assertThat(read(proposed, "$.action.preset")).isEqualTo("WEEKEND");

		when(chatModel.generate(any(), any(), any())).thenThrow(new ChatModel.Failure("test"));
		app(auth(json(post("/api/v1/chat/messages"), ask), token), 502);
	}

	@Test
	void AI_메이트_일정_제안과_예정_지출_예산_반영() throws Exception {
		String token = signup();
		clock.seoulNoon("2026-10-30");
		app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
		when(chatModel.generate(any(), any(), any(), any()))
			.thenReturn(new ChatModel.Reply("", null, new ChatModel.ScheduleCall("술약속", "2026-11-02", "식비", 50000L)));
		when(chatModel.generate(any(), any(), any())).thenReturn(new ChatModel.Reply("**50,000원**으로 등록할까요?", null));
		String ask = "{\"messages\":[{\"role\":\"USER\",\"text\":\"월요일 저녁 술약속\"}],\"accepts\":[\"SCHEDULE\"],"
				+ "\"pending\":{\"title\":\"술약속\",\"date\":\"2026-11-02\",\"categoryId\":1,\"amount\":30000}}";
		MvcResult proposed = app(auth(json(post("/api/v1/chat/messages"), ask), token), 200);
		assertThat(read(proposed, "$.action.type")).isEqualTo("SCHEDULE");
		String categoryId = read(proposed, "$.action.schedule.categoryId");

		app(auth(json(post("/api/v1/scheduled-expenses"), "{\"amount\":50000,\"categoryId\":" + categoryId
				+ ",\"title\":\"술약속\",\"date\":\"2026-11-02\"}"), token), 201);
		MvcResult today = app(auth(get("/api/v1/budget/today"), token), 200);
		assertThat(read(today, "$.reservedPlanned")).isEqualTo("50000");
		assertThat(read(today, "$.dayPlans[0].date")).isEqualTo("2026-11-02");
	}

	@Test
	void 예정_지출과_카테고리_순서() throws Exception {
		String token=signup();
		clock.seoulNoon("2026-10-30");
		MvcResult found=app(auth(get("/api/v1/categories?type=EXPENSE"),token),200);
		java.util.List<Integer> ids=JsonPath.read(found.getResponse().getContentAsString(StandardCharsets.UTF_8),"$[*].id");
		app(auth(json(put("/api/v1/categories/order"),"{\"type\":\"EXPENSE\",\"ids\":"+ids+"}"),token),200);
		app(auth(json(put("/api/v1/categories/order"),"{\"type\":\"EXPENSE\",\"ids\":[]}"),token),400);
		app(json(put("/api/v1/categories/order"),"{\"type\":\"EXPENSE\",\"ids\":[]}"),401);
		String body="{\"amount\":10000,\"categoryId\":"+ids.get(0)+",\"title\":\"선물\",\"date\":\"2026-10-31\"}";
		app(json(post("/api/v1/scheduled-expenses"),body),401);
		String id=read(app(auth(json(post("/api/v1/scheduled-expenses"),body),token),201),"$.id");
		app(auth(get("/api/v1/scheduled-expenses?from=2026-10-31&to=2026-10-31"),token),200);
		app(auth(get("/api/v1/scheduled-expenses?from=2026-11-01&to=2026-10-31"),token),400);
		app(auth(json(post("/api/v1/scheduled-expenses"),body.replace("2026-10-31","2026-10-30")),token),400);
		app(auth(json(put("/api/v1/scheduled-expenses/"+id),body),token),200);
		app(auth(json(put("/api/v1/scheduled-expenses/999999999"),body),token),404);
		app(auth(delete("/api/v1/scheduled-expenses/"+id),token),204);
		app(auth(delete("/api/v1/scheduled-expenses/"+id),token),404);
	}

	@Test
	void 코인_코스튬_추천() throws Exception {
		String token = signup();
		MvcResult checkIn = app(auth(post("/api/v1/coins/check-in"), token), 200);
		String rewardId = read(checkIn, "$.rewards[0].id");
		app(auth(json(post("/api/v1/coins/rewards/ack"), "{\"ids\":[" + rewardId + "]}"), token), 204);
		app(auth(get("/api/v1/coins"), token), 200);
		app(auth(post("/api/v1/coins/collect"), token), 200);
		String bonus = "{\"requestId\":\"contract-0001\",\"watchedSeconds\":20}";
		app(auth(json(post("/api/v1/coins/ad-bonus"), bonus), token), 409);
		app(auth(json(post("/api/v1/coins/ad-bonus"), "{\"requestId\":\"x\",\"watchedSeconds\":20}"), token), 400);
		when(adVerifier.verify(any())).thenReturn(true);
		String userId = String.valueOf((Object) JsonPath.read(
				app(auth(get("/api/v1/me"), token), 200).getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id"));
		app(get("/api/v1/ads/reward-callback?transaction_id=contract-tx&user_id=" + userId + "&signature=s&key_id=1"), 200);
		app(auth(json(post("/api/v1/coins/ad-bonus"), bonus), token), 200);
		app(auth(get("/api/v1/coins/attendance"), token), 200);
		app(auth(post("/api/v1/coins/attendance"), token), 200);

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

    @Test
    void incomeSettingsPreservesOtherValuesAndRejectsStaleProposals() throws Exception {
        String token = signup();
        clock.seoulNoon("2026-11-09");
        String change = "{\"incomeAmount\":3000000,\"payday\":20,\"expectedIncomeAmount\":2000000,\"expectedPayday\":26}";
        app(json(patch("/api/v1/budget/settings/income"), change), 401);
        app(auth(json(patch("/api/v1/budget/settings/income"), change), token), 404);
        MvcResult before = app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
        app(auth(json(put("/api/v1/budget/day-weights"), "{\"preset\":\"WEEKEND\"}"), token), 200);
        MvcResult after = app(auth(json(patch("/api/v1/budget/settings/income"), change), token), 200);
        for (String path : List.of("balance", "balanceAt", "cardUnpaid", "seedBase", "fixedExpenses", "protectedItems")) {
            assertThat(read(after, "$." + path)).as(path).isEqualTo(read(before, "$." + path));
        }
        assertThat(read(after, "$.incomeAmount")).isEqualTo("3000000");
        assertThat(read(after, "$.payday")).isEqualTo("20");
        assertThat(read(app(auth(get("/api/v1/budget/day-weights"), token), 200), "$.preset")).isEqualTo("WEEKEND");
        app(auth(json(patch("/api/v1/budget/settings/income"), change), token), 200);
        MvcResult stale = app(auth(json(patch("/api/v1/budget/settings/income"), change.replace("3000000", "4000000")), token), 409);
        assertThat(read(stale, "$.code")).isEqualTo("BUDGET_INCOME_CHANGED");
        app(auth(json(patch("/api/v1/budget/settings/income"), change.replace("\"payday\":20", "\"payday\":32")), token), 400);
        app(auth(json(patch("/api/v1/budget/settings/income"), "{}"), token), 400);
    }

    private MvcResult incomeAsk(String token, ChatModel.IncomeCall income) throws Exception {
        when(chatModel.generate(any(), any(), any(), any(), org.mockito.ArgumentMatchers.eq(true)))
                .thenReturn(new ChatModel.Reply("", null, null, income));
        return app(auth(json(post("/api/v1/chat/messages"),
                "{\"accepts\":[\"INCOME\"],\"messages\":[{\"role\":\"USER\",\"text\":\"수입 바꿔줘\"}]}"), token), 200);
    }

    @Test
    void incomeProposalsNeverWriteAndUpdateOnlyRequestedFields() throws Exception {
        String token = signup();
        clock.seoulNoon("2026-11-09");
        app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
        MvcResult created = incomeAsk(token, new ChatModel.IncomeCall("TRANSACTION", "CREATE", "용돈", "2026-11-09", null, 50000L, null, null, null, null));
        assertThat(read(created, "$.action.type")).isEqualTo("INCOME_TRANSACTION");
        String categoryId = read(created, "$.action.incomeTransaction.categoryId");
        assertThat(read(app(auth(get("/api/v1/transactions?from=2026-11-09&to=2026-11-09"), token), 200), "$.items")).isEqualTo("[]");
        String id = read(app(auth(json(post("/api/v1/transactions"), "{\"type\":\"INCOME\",\"title\":\"용돈\",\"amount\":50000,\"categoryId\":" + categoryId
                + ",\"memo\":\"보존할 비밀 메모\",\"occurredAt\":\"2026-11-09T11:00:00+09:00\"}"), token), 201), "$.id");
        var call = new ChatModel.IncomeCall("TRANSACTION", "UPDATE", null, null, null, 60000L, null, "2026-11-09", 50000L, "용돈");
        MvcResult proposed = incomeAsk(token, call);
        assertThat(read(proposed, "$.action.incomeTransaction.transactionId")).isEqualTo(id);
        assertThat(read(proposed, "$.action.incomeTransaction.changes")).isEqualTo("[\"AMOUNT\"]");
        assertThat(read(app(auth(get("/api/v1/transactions/" + id), token), 200), "$.amount")).isEqualTo("50000");
        MvcResult saved = app(auth(json(patch("/api/v1/transactions/" + id), "{\"amount\":60000}"), token), 200);
        assertThat(read(saved, "$.memo")).isEqualTo("보존할 비밀 메모");
        assertThat(read(saved, "$.title")).isEqualTo("용돈");
        assertThat(read(saved, "$.occurredAt")).contains("11:00:00");
        String other = signup();
        assertThat(read(incomeAsk(other, call), "$.action")).isEqualTo("null");
        app(auth(json(post("/api/v1/transactions"), "{\"type\":\"INCOME\",\"title\":\"용돈\",\"amount\":60000,\"categoryId\":" + categoryId + "}"), token), 201);
        var ambiguous = new ChatModel.IncomeCall("TRANSACTION", "UPDATE", null, null, null, 70000L, null, null, null, "용돈");
        assertThat(read(incomeAsk(token, ambiguous), "$.action")).isEqualTo("null");
    }

    @Test
    void expenseProposalValidatesLocallyNeverWritesAndHidesFromOldApps() throws Exception {
        String token = signup();
        clock.seoulNoon("2026-11-09");
        app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
        when(chatModel.generate(any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any()))
                .thenReturn(new ChatModel.Reply("", null, null, null,
                        new ChatModel.ExpenseCall("CREATE", null, null, "식비", 14000L, null, null, null)));
        String body = "{\"accepts\":[\"EXPENSE\"],\"messages\":[{\"role\":\"USER\",\"text\":\"식비로 14000원 빼줘\"}]}";
        MvcResult proposed = app(auth(json(post("/api/v1/chat/messages"), body), token), 200);
        assertThat(read(proposed, "$.action.type")).isEqualTo("EXPENSE_TRANSACTION");
        assertThat(read(proposed, "$.action.expenseTransaction.operation")).isEqualTo("CREATE");
        assertThat(read(proposed, "$.action.expenseTransaction.amount")).isEqualTo("14000");
        assertThat(read(proposed, "$.action.expenseTransaction.category")).isEqualTo("식비");
        assertThat(read(proposed, "$.action.expenseTransaction.title")).isEqualTo("식비");
        assertThat(read(proposed, "$.action.expenseTransaction.date")).isEqualTo("2026-11-09");
        assertThat(read(app(auth(get("/api/v1/transactions?from=2026-11-09&to=2026-11-09"), token), 200), "$.items")).isEqualTo("[]");
        var system = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(chatModel).generate(system.capture(), any(), any(), any(),
                org.mockito.ArgumentMatchers.anyBoolean(), any());
        assertThat(system.getValue()).contains("propose_expense", "지출 카테고리: ");
        // 옛 앱(EXPENSE를 알리지 않음)에는 지출 제안 도구를 열지 않는다
        when(chatModel.generate(any(), any(), any())).thenReturn(new ChatModel.Reply("앱 화면에서 해 주세요.", null));
        MvcResult old = app(auth(json(post("/api/v1/chat/messages"),
                "{\"messages\":[{\"role\":\"USER\",\"text\":\"식비로 14000원 빼줘\"}]}"), token), 200);
        assertThat(read(old, "$.action")).isEqualTo("null");
    }

    @Test
    void incomeSettingsProposalUsesCurrentOtherFieldAndDoesNotLeakRecords() throws Exception {
        String token = signup();
        app(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
        MvcResult proposed = incomeAsk(token, new ChatModel.IncomeCall("SETTINGS", "UPDATE", null, null, null, 4000000L, null, null, null, null));
        assertThat(read(proposed, "$.action.type")).isEqualTo("INCOME_SETTINGS");
        assertThat(read(proposed, "$.action.incomeSettings.payday")).isEqualTo("26");
        assertThat(read(proposed, "$.action.incomeSettings.expectedIncomeAmount")).isEqualTo("2000000");
        assertThat(read(app(auth(get("/api/v1/budget/settings"), token), 200), "$.incomeAmount")).isEqualTo("2000000");
        var system = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(chatModel).generate(system.capture(), any(), any(), any(), org.mockito.ArgumentMatchers.eq(true));
        assertThat(system.getValue()).contains("시드머니는").doesNotContain("2,000,000", "2000000");
        // 도구를 건너뛰고 "아래 버튼을 눌러"라고 말로만 답하지 않게, 일정과 같은 강도의 수입 규칙과 수입 카테고리 이름을 준다
        assertThat(system.getValue()).contains("반드시 propose_income 도구를 호출한다", "'버튼을 누르라'고 하지 않는다")
                .containsPattern("- 수입 카테고리: .*급여.*용돈");
    }

    @Test
    void invalidIncomeAndOldClientsReceiveNoIncomeAction() throws Exception {
        String token = signup();
        for (var call : List.of(
                new ChatModel.IncomeCall("TRANSACTION", "CREATE", "용돈", "2099-01-01", null, 100L, null, null, null, null),
                new ChatModel.IncomeCall("TRANSACTION", "CREATE", "용돈", null, null, null, null, null, null, null),
                new ChatModel.IncomeCall("TRANSACTION", "UPDATE", null, null, null, 100L, null, null, null, null),
                new ChatModel.IncomeCall("SETTINGS", "UPDATE", null, null, null, -1L, null, null, null, null))) {
            assertThat(read(incomeAsk(token, call), "$.action")).isEqualTo("null");
        }
        when(chatModel.generate(any(), any(), any())).thenReturn(new ChatModel.Reply("다시 알려 주세요", null, null,
                new ChatModel.IncomeCall("SETTINGS", "UPDATE", null, null, null, 500L, null, null, null, null)));
        MvcResult old = app(auth(json(post("/api/v1/chat/messages"), "{\"messages\":[{\"role\":\"USER\",\"text\":\"수입 수정\"}]}"), token), 200);
        assertThat(read(old, "$.action")).isEqualTo("null");
    }
}
