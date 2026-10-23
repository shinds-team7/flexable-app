package com.flexable.api.weblink;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
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

/** 웹사이트 [앱 연동하기]: 앱의 코드 발급 → 웹 서버의 연동·조회·해제, 서비스 키 검사, 앱 로그아웃·탈퇴의 영향. */
@SpringBootTest
@AutoConfigureMockMvc
class WebLinkFlowTest {

	static final String KEY = "test-service-key-0123456789abcdef0123";
	static final String OLD_KEY = "old-test-service-key-0123456789abcdef";
	static final String HEADER = "X-Service-Key";

	@Autowired
	MockMvc mvc;

	@Autowired
	WebLinkCodeRepository codes;

	record Account(String email, String token) {
	}

	private String body(MvcResult r) throws Exception {
		return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private MockHttpServletRequestBuilder user(MockHttpServletRequestBuilder b, String token) {
		return b.header("Authorization", "Bearer " + token);
	}

	private MockHttpServletRequestBuilder internal(MockHttpServletRequestBuilder b, String key, String body) {
		if (key != null) {
			b.header(HEADER, key);
		}
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private Account signup() throws Exception {
		String email = "weblink-" + UUID.randomUUID() + "@example.com";
		MvcResult r = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"" + email + "\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated())
			.andReturn();
		return new Account(email, JsonPath.read(body(r), "$.accessToken"));
	}

	private String issueCode(String token) throws Exception {
		MvcResult r = mvc.perform(user(post("/api/v1/me/web-link-codes"), token))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.expiresAt").exists())
			.andReturn();
		return JsonPath.read(body(r), "$.code");
	}

	private String link(String code) throws Exception {
		MvcResult r = mvc.perform(internal(post("/internal/v1/web-links"), KEY, "{\"code\":\"" + code + "\"}"))
			.andExpect(status().isCreated())
			.andReturn();
		return JsonPath.read(body(r), "$.linkId");
	}

	@Test
	void linkReadAndUnlinkFromWeb() throws Exception {
		Account a = signup();
		String code = issueCode(a.token());
		// 사용자가 소문자·하이픈을 섞어 입력해도 받아들인다.
		String typed = (code.substring(0, 3) + "-" + code.substring(3)).toLowerCase();
		MvcResult r = mvc.perform(internal(post("/internal/v1/web-links"), KEY, "{\"code\":\"" + typed + "\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.profile.email").value(a.email()))
			.andExpect(jsonPath("$.profile.provider").value("email"))
			.andReturn();
		String linkId = JsonPath.read(body(r), "$.linkId");

		// 한 번 쓴 코드는 다시 쓸 수 없다.
		mvc.perform(internal(post("/internal/v1/web-links"), KEY, "{\"code\":\"" + code + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("LINK_CODE_INVALID"));

		mvc.perform(internal(get("/internal/v1/web-links/" + linkId + "/profile"), KEY, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value(a.email()));
		mvc.perform(user(get("/api/v1/me/web-links"), a.token())).andExpect(jsonPath("$", hasSize(1)));

		mvc.perform(internal(delete("/internal/v1/web-links/" + linkId), KEY, null)).andExpect(status().isNoContent());
		mvc.perform(internal(get("/internal/v1/web-links/" + linkId + "/profile"), KEY, null))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
		mvc.perform(user(get("/api/v1/me/web-links"), a.token())).andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void internalApiRequiresServiceKey() throws Exception {
		Account a = signup();
		String code = issueCode(a.token());
		String req = "{\"code\":\"" + code + "\"}";
		// 앱 사용자 토큰으로는 열리지 않는다.
		mvc.perform(user(internal(post("/internal/v1/web-links"), null, req), a.token()))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
		mvc.perform(internal(post("/internal/v1/web-links"), "wrong-key-wrong-key-wrong-key-wrong", req))
			.andExpect(status().isUnauthorized());
		mvc.perform(internal(get("/internal/v1/web-links/anything/profile"), null, null))
			.andExpect(status().isUnauthorized());
		// 키 교체 중에는 이전 키도 받는다. 키 검사에서 막힌 요청은 코드를 쓰지 않았다.
		mvc.perform(internal(post("/internal/v1/web-links"), OLD_KEY, req)).andExpect(status().isCreated());
	}

	@Test
	void newCodeReplacesOldAndExpiredCodeFails() throws Exception {
		Account a = signup();
		String first = issueCode(a.token());
		String second = issueCode(a.token());
		mvc.perform(internal(post("/internal/v1/web-links"), KEY, "{\"code\":\"" + first + "\"}"))
			.andExpect(status().isBadRequest());

		Account b = signup();
		long userId = ((Number) JsonPath.read(body(mvc.perform(user(get("/api/v1/me"), b.token())).andReturn()), "$.id"))
			.longValue();
		Instant past = Instant.now().minusSeconds(60);
		codes.save(new WebLinkCode(userId, WebLinkService.sha256("EXPRD2"), past, past.minusSeconds(600)));
		mvc.perform(internal(post("/internal/v1/web-links"), KEY, "{\"code\":\"EXPRD2\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("LINK_CODE_INVALID"));

		link(second);
	}

	@Test
	void appLogoutKeepsLinkAndAppUnlinkOrDeletionEndsIt() throws Exception {
		Account a = signup();
		String linkId = link(issueCode(a.token()));
		mvc.perform(user(post("/api/v1/auth/logout"), a.token())).andExpect(status().isNoContent());
		mvc.perform(internal(get("/internal/v1/web-links/" + linkId + "/profile"), KEY, null)).andExpect(status().isOk());

		// 앱에서 해제: 목록의 id로 지운다. 남의 연동은 404.
		String token = JsonPath.read(body(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"" + a.email() + "\",\"password\":\"abcd1234\"}")).andReturn()), "$.accessToken");
		long id = ((Number) JsonPath.read(body(mvc.perform(user(get("/api/v1/me/web-links"), token)).andReturn()), "$[0].id"))
			.longValue();
		Account other = signup();
		mvc.perform(user(delete("/api/v1/me/web-links/" + id), other.token())).andExpect(status().isNotFound());
		mvc.perform(user(delete("/api/v1/me/web-links/" + id), token)).andExpect(status().isNoContent());
		mvc.perform(internal(get("/internal/v1/web-links/" + linkId + "/profile"), KEY, null))
			.andExpect(status().isNotFound());

		// 앱 탈퇴: 연동이 함께 지워진다.
		String linkId2 = link(issueCode(token));
		mvc.perform(user(delete("/api/v1/me"), token).contentType(MediaType.APPLICATION_JSON)
			.content("{\"password\":\"abcd1234\"}")).andExpect(status().isNoContent());
		mvc.perform(internal(get("/internal/v1/web-links/" + linkId2 + "/profile"), KEY, null))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
	}

	@Test
	void appEndpointsRequireLogin() throws Exception {
		mvc.perform(post("/api/v1/me/web-link-codes")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/v1/me/web-links")).andExpect(status().isUnauthorized());
	}

}
