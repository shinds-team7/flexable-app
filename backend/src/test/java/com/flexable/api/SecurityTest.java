package com.flexable.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Base64;
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

/**
 * 접근 제어 보안 테스트: 로그인 없는 접근, 토큰 위조, 다른 사용자 데이터 접근, 허용되지 않은 출처(CORS)를 막는지 본다.
 * 2026-10-16 보안 검토 때 로컬에서만 돌리던 검사를 CI에 넣은 것이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityTest {

	@Autowired
	MockMvc mvc;

	private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();

	private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String token, String body) {
		if (token != null) {
			b.header("Authorization", "Bearer " + token);
		}
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private String body(MvcResult r) throws Exception {
		return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private String signup() throws Exception {
		String email = "security-" + UUID.randomUUID() + "@example.com";
		MvcResult r = mvc.perform(json(post("/api/v1/auth/signup"), null,
				"{\"email\":\"" + email + "\",\"password\":\"Review12345\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated())
			.andReturn();
		return JsonPath.read(body(r), "$.accessToken");
	}

	private long createCategory(String token) throws Exception {
		MvcResult r = mvc.perform(json(post("/api/v1/categories"), token, "{\"name\":\"보안검사\",\"type\":\"EXPENSE\"}"))
			.andExpect(status().isCreated())
			.andReturn();
		return ((Number) JsonPath.read(body(r), "$.id")).longValue();
	}

	@Test
	void privateEndpointsRequireLogin() throws Exception {
		String[] urls = { "/api/v1/me", "/api/v1/budget/settings", "/api/v1/budget/today", "/api/v1/categories",
				"/api/v1/transactions?from=2026-10-01&to=2026-10-16",
				"/api/v1/analysis/summary?from=2026-10-01&to=2026-10-16" };
		for (String url : urls) {
			mvc.perform(get(url)).andExpect(status().isUnauthorized());
		}
	}

	@Test
	void forgedAndUnsignedTokensAreRejected() throws Exception {
		String token = signup();
		String[] parts = token.split("\\.");
		String forgedPayload = B64URL
			.encodeToString("{\"sub\":\"1\",\"tv\":0,\"exp\":4102444800}".getBytes(StandardCharsets.UTF_8));

		// 서명은 그대로 두고 내용만 바꾼 토큰
		mvc.perform(json(get("/api/v1/me"), parts[0] + "." + forgedPayload + "." + parts[2], null))
			.andExpect(status().isUnauthorized());
		// 서명 없는(alg=none) 토큰
		String none = B64URL.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
		mvc.perform(json(get("/api/v1/me"), none + "." + forgedPayload + ".", null)).andExpect(status().isUnauthorized());
		// 원래 토큰은 통과(검사가 모든 토큰을 막아서 통과하는 것이 아님을 확인)
		mvc.perform(json(get("/api/v1/me"), token, null)).andExpect(status().isOk());
	}

	@Test
	void otherUsersTransactionsAndCategoriesAreBlocked() throws Exception {
		String owner = signup();
		String other = signup();
		long category = createCategory(owner);
		MvcResult created = mvc.perform(json(post("/api/v1/transactions"), owner,
				"{\"type\":\"EXPENSE\",\"amount\":1234,\"categoryId\":" + category + ",\"title\":\"private\"}"))
			.andExpect(status().isCreated())
			.andReturn();
		long id = ((Number) JsonPath.read(body(created), "$.id")).longValue();

		// 다른 사용자는 거래를 보거나 고치거나 지울 수 없다(존재 여부도 알려 주지 않도록 404)
		mvc.perform(json(get("/api/v1/transactions/" + id), other, null)).andExpect(status().isNotFound());
		mvc.perform(json(patch("/api/v1/transactions/" + id), other, "{\"amount\":9999}")).andExpect(status().isNotFound());
		mvc.perform(json(delete("/api/v1/transactions/" + id), other, null)).andExpect(status().isNotFound());
		// 남의 카테고리를 고치거나 지우거나 내 거래에 쓸 수 없다
		mvc.perform(json(patch("/api/v1/categories/" + category), other, "{\"name\":\"changed\"}"))
			.andExpect(status().isNotFound());
		mvc.perform(json(delete("/api/v1/categories/" + category), other, null)).andExpect(status().isNotFound());
		mvc.perform(json(post("/api/v1/transactions"), other,
				"{\"type\":\"EXPENSE\",\"amount\":1,\"categoryId\":" + category + ",\"title\":\"foreign\"}"))
			.andExpect(status().isBadRequest());
		// 목록에도 나오지 않는다
		LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
		String range = "?from=" + today.minusDays(1) + "&to=" + today.plusDays(1);
		mvc.perform(json(get("/api/v1/transactions" + range), other, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)));

		// 주인의 거래는 바뀌지 않았다
		mvc.perform(json(get("/api/v1/transactions/" + id), owner, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.amount").value(1234))
			.andExpect(jsonPath("$.title").value("private"));
	}

	@Test
	void onlyConfiguredOriginsPassCors() throws Exception {
		mvc.perform(options("/api/v1/me").header("Origin", "https://untrusted.example.invalid")
			.header("Access-Control-Request-Method", "GET")
			.header("Access-Control-Request-Headers", "Authorization")).andExpect(status().isForbidden());
		// 테스트 설정(application.yml)의 허용 출처는 통과
		mvc.perform(options("/api/v1/me").header("Origin", "http://localhost:8081")
			.header("Access-Control-Request-Method", "GET")
			.header("Access-Control-Request-Headers", "Authorization"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8081"));
	}

}
