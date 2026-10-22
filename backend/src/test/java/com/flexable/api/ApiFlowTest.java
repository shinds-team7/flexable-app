package com.flexable.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;
import com.flexable.api.auth.LoginAttemptLimiter;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

@SpringBootTest
@AutoConfigureMockMvc
class ApiFlowTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	LoginAttemptLimiter loginLimiter;

	@Autowired
	org.springframework.jdbc.core.JdbcTemplate jdbc;

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private final LocalDate todayDate = LocalDate.now(SEOUL);

	private final String today = todayDate.toString();

	/** 오늘이 아닌 날짜(1~28). 오늘 날짜 고정지출은 자동 기록되므로 거래 수를 세는 테스트에서 피한다. */
	private final int notToday = todayDate.getDayOfMonth() % 28 + 1;

	private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String token, String body) {
		if (token != null) {
			b.header("Authorization", "Bearer " + token);
		}
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private String body(MvcResult r) throws Exception {
		return r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
	}

	private String signup(String email) throws Exception {
		MvcResult r = mvc.perform(json(post("/api/v1/auth/signup"), null,
				"{\"email\":\"" + email + "\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.user.onboarded", is(false)))
			.andReturn();
		return JsonPath.read(body(r), "$.accessToken");
	}

	private long categoryId(String token, String type, String name) throws Exception {
		MvcResult r = mvc.perform(json(get("/api/v1/categories?type=" + type), token, null))
			.andExpect(status().isOk())
			.andReturn();
		Number id = JsonPath.<net.minidev.json.JSONArray>read(body(r), "$[?(@.name == '" + name + "')].id")
			.stream()
			.map(Number.class::cast)
			.findFirst()
			.orElseThrow();
		return id.longValue();
	}

	@Test
	void signupValidationAndDuplicates() throws Exception {
		mvc.perform(json(post("/api/v1/auth/signup"), null,
				"{\"email\":\"bad\",\"password\":\"short\",\"agreeTerms\":true,\"agreePrivacy\":false}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.fields.email").exists())
			.andExpect(jsonPath("$.fields.agreePrivacy").exists());

		signup("Dup@Example.com");
		mvc.perform(json(post("/api/v1/auth/signup"), null,
				"{\"email\":\"dup@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EMAIL_UNAVAILABLE")));

		mvc.perform(json(post("/api/v1/auth/login"), null, "{\"email\":\"dup@example.com\",\"password\":\"wrong1234\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code", is("INVALID_CREDENTIALS")));
		mvc.perform(json(post("/api/v1/auth/login"), null, "{\"email\":\" DUP@example.com \",\"password\":\"abcd1234\"}"))
			.andExpect(status().isOk());
	}

	@Test
	void fullFailureStoreBlocksUntrackedCredentialsUntilCapacityIsReleased() throws Exception {
		String prefix = "capacity-" + UUID.randomUUID();
		String validEmail = prefix + "@example.com";
		String trackedEmail = prefix + "-tracked@example.com";
		signup(validEmail);
		signup(trackedEmail);
		try {
			loginLimiter.recordFailure(trackedEmail);
			for (int i = 0; i < 10_000; i++) {
				try {
					loginLimiter.recordFailure(prefix + "-" + i + "@example.invalid");
				}
				catch (ApiException ex) {
					org.junit.jupiter.api.Assertions.assertEquals(ErrorCode.TOO_MANY_ATTEMPTS, ex.code());
					break;
				}
			}
			for (int i = 0; i < 6; i++) {
				mvc.perform(json(post("/api/v1/auth/login"), null,
						"{\"email\":\"" + validEmail + "\",\"password\":\"wrong1234\"}"))
					.andExpect(status().isTooManyRequests())
					.andExpect(jsonPath("$.code", is("TOO_MANY_ATTEMPTS")))
					.andExpect(jsonPath("$.retryAfterSeconds").isNumber());
			}
			mvc.perform(json(post("/api/v1/auth/login"), null,
					"{\"email\":\"" + validEmail + "\",\"password\":\"abcd1234\"}"))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code", is("TOO_MANY_ATTEMPTS")));
			// A tracked, unblocked account can still log in and release its slot.
			mvc.perform(json(post("/api/v1/auth/login"), null,
					"{\"email\":\"" + trackedEmail + "\",\"password\":\"abcd1234\"}"))
				.andExpect(status().isOk());
			mvc.perform(json(post("/api/v1/auth/login"), null,
					"{\"email\":\"" + validEmail + "\",\"password\":\"abcd1234\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty());
		}
		finally {
			for (int i = 0; i < 10_000; i++) {
				loginLimiter.reset(prefix + "-" + i + "@example.invalid");
			}
			loginLimiter.reset(validEmail);
			loginLimiter.reset(trackedEmail);
		}
	}

	@Test
	void loginIsRateLimited() throws Exception {
		signup("limit@example.com");
		for (int i = 0; i < 5; i++) {
			mvc.perform(json(post("/api/v1/auth/login"), null,
					"{\"email\":\"limit@example.com\",\"password\":\"wrong1234\"}"))
				.andExpect(status().isUnauthorized());
		}
		mvc.perform(json(post("/api/v1/auth/login"), null,
				"{\"email\":\"limit@example.com\",\"password\":\"abcd1234\"}"))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.retryAfterSeconds").isNumber());
	}

	@Test
	void loginRejectsOverlongEmail() throws Exception {
		String email = "a".repeat(250) + "@example.com";
		mvc.perform(json(post("/api/v1/auth/login"), null,
				"{\"email\":\"" + email + "\",\"password\":\"wrong1234\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")));
	}

	@Test
	void requiresToken() throws Exception {
		mvc.perform(get("/api/v1/me"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code", is("UNAUTHORIZED")));
		mvc.perform(get("/api/v1/me").header("Authorization", "Bearer nope"))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
	}

	@Test
	void fullFlow() throws Exception {
		String token = signup("flow@example.com");

		mvc.perform(json(get("/api/v1/categories"), token, null)).andExpect(jsonPath("$", hasSize(11)));
		mvc.perform(json(get("/api/v1/budget/today"), token, null))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("BUDGET_NOT_SET")));

		mvc.perform(json(put("/api/v1/budget/settings"), token, """
				{"balance":1000000,"payday":25,"incomeAmount":2400000,
				 "fixedExpenses":[{"name":"월세","amount":450000,"day":%d}],
				 "protectedItems":[{"name":"비상금","amount":300000}]}
				""".formatted(notToday)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.cardUnpaid", is(0)))
			.andExpect(jsonPath("$.fixedExpenses[0].id").isNumber());
		mvc.perform(json(get("/api/v1/budget/today"), token, null))
			.andExpect(jsonPath("$.hasTransactions", is(false)));
		mvc.perform(json(get("/api/v1/me"), token, null)).andExpect(jsonPath("$.onboarded", is(true)));

		long food = categoryId(token, "EXPENSE", "식비");
		long salary = categoryId(token, "INCOME", "급여");
		String key = UUID.randomUUID().toString();
		String txBody = "{\"type\":\"EXPENSE\",\"amount\":8500,\"categoryId\":" + food + ",\"title\":\"김밥\"}";
		MvcResult created = mvc.perform(json(post("/api/v1/transactions"), token, txBody).header("Idempotency-Key", key))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.category.name", is("식비")))
			.andReturn();
		int txId = JsonPath.read(body(created), "$.id");
		mvc.perform(json(post("/api/v1/transactions"), token, txBody).header("Idempotency-Key", key))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id", is(txId)));

		mvc.perform(json(post("/api/v1/transactions"), token,
				"{\"type\":\"EXPENSE\",\"amount\":100,\"categoryId\":" + salary + ",\"title\":\"x\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.categoryId").exists());

		mvc.perform(json(get("/api/v1/transactions?from=" + today + "&to=" + today), token, null))
			.andExpect(jsonPath("$.items", hasSize(1)));
		mvc.perform(json(get("/api/v1/budget/today"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.todaySpent", is(8500)))
			.andExpect(jsonPath("$.estimatedBalance", is(1000000 - 8500)))
			.andExpect(jsonPath("$.hasTransactions", is(true)))
			.andExpect(jsonPath("$.weekDaysLeft").isNumber())
			.andExpect(jsonPath("$.weekAvailable").isNumber())
			// 하루 예산을 처음 기록한 날이라 캐릭터는 Lv.1 0%에서 시작(같은 날 다시 불러도 행이 겹치지 않음)
			.andExpect(jsonPath("$.characterPoints", is(0)))
			.andExpect(jsonPath("$.characterDelta", is(0)));
		mvc.perform(json(get("/api/v1/analysis/summary?from=" + today + "&to=" + today), token, null))
			.andExpect(jsonPath("$.expenseTotal", is(8500)))
			.andExpect(jsonPath("$.byCategory[0].ratio", is(1.0)))
			.andExpect(jsonPath("$.daily", hasSize(1)));

		mvc.perform(json(patch("/api/v1/transactions/" + txId), token, "{\"amount\":9000,\"memo\":\"점심\"}"))
			.andExpect(jsonPath("$.amount", is(9000)))
			.andExpect(jsonPath("$.memo", is("점심")));
		mvc.perform(json(patch("/api/v1/transactions/" + txId), token, "{\"memo\":null}"))
			.andExpect(jsonPath("$.memo").doesNotExist());

		// 사용자 카테고리: 생성 → 중복 → 거래 이동 후 삭제
		MvcResult cat = mvc.perform(json(post("/api/v1/categories"), token,
				"{\"name\":\"데이트\",\"type\":\"EXPENSE\",\"color\":\"#ff0000\",\"icon\":\"heart\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.color", is("#FF0000")))
			.andReturn();
		int catId = JsonPath.read(body(cat), "$.id");
		mvc.perform(json(post("/api/v1/categories"), token, "{\"name\":\"데이트\",\"type\":\"EXPENSE\"}"))
			.andExpect(status().isConflict());
		mvc.perform(json(patch("/api/v1/transactions/" + txId), token, "{\"categoryId\":" + catId + "}"))
			.andExpect(jsonPath("$.category.name", is("데이트")));
		mvc.perform(json(delete("/api/v1/categories/" + catId), token, null)).andExpect(status().isNoContent());
		mvc.perform(json(get("/api/v1/transactions/" + txId), token, null))
			.andExpect(jsonPath("$.category.name", is("기타")));
		mvc.perform(json(delete("/api/v1/categories/" + food), token, null))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("CATEGORY_DEFAULT")));

		// 다른 사용자는 볼 수 없다
		String other = signup("other@example.com");
		mvc.perform(json(get("/api/v1/transactions/" + txId), other, null)).andExpect(status().isNotFound());

		// 탈퇴
		mvc.perform(json(delete("/api/v1/me"), token, "{\"password\":\"wrong1234\"}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(json(delete("/api/v1/me"), token, "{\"password\":\"abcd1234\"}")).andExpect(status().isNoContent());
		mvc.perform(json(get("/api/v1/me"), token, null)).andExpect(status().isUnauthorized());
		mvc.perform(json(post("/api/v1/auth/login"), null, "{\"email\":\"flow@example.com\",\"password\":\"abcd1234\"}"))
			.andExpect(status().isUnauthorized());
		signup("flow@example.com");
	}

	@Test
	void concurrentRetriesWithSameIdempotencyKeyCreateOneTransaction() throws Exception {
		String token = signup("idem-race@example.com");
		long food = categoryId(token, "EXPENSE", "식비");
		String key = UUID.randomUUID().toString();
		String txBody = "{\"type\":\"EXPENSE\",\"amount\":4500,\"categoryId\":" + food + ",\"title\":\"커피\"}";

		int n = 6;
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(n);
		List<Future<MvcResult>> results = new ArrayList<>();
		for (int i = 0; i < n; i++) {
			Callable<MvcResult> send = () -> {
				start.await();
				return mvc.perform(json(post("/api/v1/transactions"), token, txBody).header("Idempotency-Key", key))
					.andReturn();
			};
			results.add(pool.submit(send));
		}
		start.countDown();
		List<Integer> statuses = new ArrayList<>();
		List<Integer> ids = new ArrayList<>();
		for (Future<MvcResult> f : results) {
			MvcResult r = f.get();
			statuses.add(r.getResponse().getStatus());
			ids.add(JsonPath.read(body(r), "$.id"));
		}
		pool.shutdown();

		// 하나만 만들고(201) 나머지는 그 거래를 돌려준다(200)
		assertThat(statuses).filteredOn(s -> s == 201).hasSize(1);
		assertThat(statuses).filteredOn(s -> s == 200).hasSize(n - 1);
		assertThat(ids).containsOnly(ids.get(0));
		mvc.perform(json(get("/api/v1/transactions?from=" + today + "&to=" + today), token, null))
			.andExpect(jsonPath("$.items", hasSize(1)));
	}

	@Test
	void fixedExpensesArePostedAsTransactions() throws Exception {
		String token = signup("fixed@example.com");
		LocalDate from = todayDate.minusDays(40);
		String range = "?from=" + from + "&to=" + today;
		// 40일 전 잔액, 오늘 날짜 월세 → 지난달과 오늘 두 번 나갔다
		String settings = """
				{"balance":1000000,"balanceAt":"%s","payday":25,"incomeAmount":2400000,
				 "fixedExpenses":[{"name":"월세","amount":450000,"day":%d}]}
				""".formatted(OffsetDateTime.now(SEOUL).minusDays(40), todayDate.getDayOfMonth());
		mvc.perform(json(put("/api/v1/budget/settings"), token, settings)).andExpect(status().isOk());

		MvcResult list = mvc.perform(json(get("/api/v1/transactions" + range), token, null))
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].title", is("월세")))
			.andExpect(jsonPath("$.items[0].type", is("EXPENSE")))
			.andExpect(jsonPath("$.items[0].amount", is(450000)))
			.andExpect(jsonPath("$.items[0].category.name", is("고정지출")))
			.andExpect(jsonPath("$.items[0].fromFixed", is(true)))
			.andExpect(jsonPath("$.items[0].memo", is("고정지출 자동 기록")))
			.andReturn();
		mvc.perform(json(get("/api/v1/budget/today"), token, null))
			.andExpect(jsonPath("$.estimatedBalance", is(1000000 - 900000)))
			.andExpect(jsonPath("$.reservedFixed", is(0)))
			.andExpect(jsonPath("$.todaySpent", is(0)))
			.andExpect(jsonPath("$.hasTransactions", is(true)));
		mvc.perform(json(get("/api/v1/analysis/summary" + range), token, null))
			.andExpect(jsonPath("$.expenseTotal", is(900000)))
			.andExpect(jsonPath("$.expenseCount", is(2)));

		// 다시 조회해도, 지운 뒤에도, 설정을 다시 저장해도 같은 날짜는 다시 만들지 않는다
		int older = JsonPath.read(body(list), "$.items[1].id");
		mvc.perform(json(delete("/api/v1/transactions/" + older), token, null)).andExpect(status().isNoContent());
		mvc.perform(json(get("/api/v1/transactions" + range), token, null)).andExpect(jsonPath("$.items", hasSize(1)));
		mvc.perform(json(put("/api/v1/budget/settings"), token, """
				{"balance":550000,"payday":25,"incomeAmount":2400000,
				 "fixedExpenses":[{"name":"월세","amount":450000,"day":%d}]}
				""".formatted(todayDate.getDayOfMonth()))).andExpect(status().isOk());
		mvc.perform(json(get("/api/v1/transactions" + range), token, null)).andExpect(jsonPath("$.items", hasSize(1)));
	}

	@Test
	void fixedExpensePostingEdgeCases() throws Exception {
		String token = signup("fixed-edge@example.com");
		int day = todayDate.getDayOfMonth();
		String range = "?from=" + todayDate.minusDays(40) + "&to=" + today;
		OffsetDateTime balanceAt = OffsetDateTime.now(SEOUL).minusDays(40);
		String rent = "{\"name\":\"월세\",\"amount\":450000,\"day\":" + day + "}";
		String settings = """
				{"balance":2000000,"balanceAt":"%s","payday":25,"incomeAmount":2400000,
				 "fixedExpenses":[%s,{"name":"Netflix","amount":17000,"day":%d},{"name":"netflix","amount":17000,"day":%d}]}
				""";
		// 같은 이름 두 개, 대소문자만 다른 이름 두 개 — 모두 따로 기록된다
		mvc.perform(json(put("/api/v1/budget/settings"), token, settings.formatted(balanceAt, rent + "," + rent, day, day)))
			.andExpect(status().isOk());
		// 오늘 월세 하나는 직접 기록해 둠 → 자동 기록은 오늘 월세 한 건만 대신한다
		mvc.perform(json(post("/api/v1/transactions"), token, "{\"type\":\"EXPENSE\",\"amount\":450000,\"categoryId\":"
				+ categoryId(token, "EXPENSE", "식비") + ",\"title\":\"월세\"}"))
			.andExpect(status().isCreated());

		MvcResult list = mvc.perform(json(get("/api/v1/transactions" + range), token, null))
			.andExpect(jsonPath("$.items", hasSize(8)))
			.andExpect(jsonPath("$.items[?(@.fromFixed == true)]", hasSize(7)))
			.andReturn();

		// 자동 기록을 다른 카테고리로 옮기면 일반 지출이 된다
		int auto = JsonPath.<net.minidev.json.JSONArray>read(body(list), "$.items[?(@.fromFixed == true)].id")
			.stream()
			.map(Number.class::cast)
			.findFirst()
			.orElseThrow()
			.intValue();
		mvc.perform(json(patch("/api/v1/transactions/" + auto), token,
				"{\"categoryId\":" + categoryId(token, "EXPENSE", "식비") + "}"))
			.andExpect(jsonPath("$.fromFixed", is(false)));

		// 같은 월세를 하나 더 추가해 다시 저장 → 새 항목은 두 날짜 모두 기록된다.
		// 이미 쓴 직접 기록과, 다른 카테고리로 옮긴 자동 기록은 새 항목을 대신하지 않는다.
		mvc.perform(json(put("/api/v1/budget/settings"), token,
				settings.formatted(balanceAt, rent + "," + rent + "," + rent, day, day)))
			.andExpect(status().isOk());
		mvc.perform(json(get("/api/v1/transactions" + range), token, null)).andExpect(jsonPath("$.items", hasSize(10)));

		// 자동 기록 도입 전에 설정한 사용자: 도입 이후 날짜만 기록한다
		String old = signup("fixed-old@example.com");
		mvc.perform(json(put("/api/v1/budget/settings"), old, """
				{"balance":1000000,"balanceAt":"%s","payday":25,"incomeAmount":2400000,
				 "fixedExpenses":[{"name":"월세","amount":450000,"day":%d}]}
				""".formatted(OffsetDateTime.now(SEOUL).minusDays(40), day))).andExpect(status().isOk());
		jdbc.update("update budget_settings set fixed_posting_since = ? where user_id = (select id from users where email = ?)",
				java.time.LocalDateTime.now(java.time.ZoneOffset.UTC), "fixed-old@example.com"); // 저장은 UTC
		mvc.perform(json(get("/api/v1/transactions" + range), old, null)).andExpect(jsonPath("$.items", hasSize(1)));
	}

	@Test
	void logoutRevokesToken() throws Exception {
		String token = signup("logout@example.com");
		mvc.perform(json(post("/api/v1/auth/logout"), token, null)).andExpect(status().isNoContent());
		mvc.perform(json(get("/api/v1/me"), token, null)).andExpect(status().isUnauthorized());
	}
}
