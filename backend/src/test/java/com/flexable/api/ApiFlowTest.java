package com.flexable.api;

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
import java.time.ZoneId;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
class ApiFlowTest {

	@Autowired
	MockMvc mvc;

	private final String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();

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
				 "fixedExpenses":[{"name":"월세","amount":450000,"day":1}],
				 "protectedItems":[{"name":"비상금","amount":300000}]}
				"""))
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
			.andExpect(jsonPath("$.weekAvailable").isNumber());
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
	void logoutRevokesToken() throws Exception {
		String token = signup("logout@example.com");
		mvc.perform(json(post("/api/v1/auth/logout"), token, null)).andExpect(status().isNoContent());
		mvc.perform(json(get("/api/v1/me"), token, null)).andExpect(status().isUnauthorized());
	}
}
