package com.flexable.api.statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * docs/policies.md §9 = tests/policy/statement-import.json. PDF 글자 읽기(StatementPdfReader)만 가짜로 두고
 * 파싱·중복·잔액 기준 시각·카테고리 추정·저장은 실제 API로 검사한다. 시각은 서울 현지 시각이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StatementImportPolicyTest {

	private static final JsonMapper JSON = JsonMapper.builder().build();
	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
	private static final String SETTINGS = "{\"balance\":500000,\"payday\":25,\"incomeAmount\":2000000,"
			+ "\"fixedExpenses\":[],\"protectedItems\":[]}";

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
	StatementPdfReader reader;

	@TestFactory
	Stream<DynamicTest> cases() throws Exception {
		JsonNode root = JSON.readTree(Files.readString(Path.of("..", "tests", "policy", "statement-import.json")));
		List<String> statement = new ArrayList<>();
		root.get("statement").forEach(n -> statement.add(n.asString()));
		List<DynamicTest> tests = new ArrayList<>();
		for (JsonNode c : root.get("cases")) {
			tests.add(DynamicTest.dynamicTest(c.get("name").asString(), () -> run(c, statement)));
		}
		return tests.stream();
	}

	private void run(JsonNode c, List<String> shared) throws Exception {
		// 사례가 자기 거래내역서를 가지면 그것을, 아니면 공통 거래내역서를 쓴다.
		List<String> statement = new ArrayList<>(shared);
		if (c.has("statement")) {
			statement.clear();
			c.get("statement").forEach(n -> statement.add(n.asString()));
		}
		when(reader.lines(any(), any())).thenReturn(statement);
		// 토큰 만료는 실제 시각으로 검사하므로 가입은 지금 시각에 한다.
		clock.now = Instant.now();
		String token = signup();
		if (c.has("balanceAt")) {
			clock.now = seoul(c.get("balanceAt").asString());
			expect(auth(json(put("/api/v1/budget/settings"), SETTINGS), token), 200);
		}
		clock.now = seoul(c.get("now").asString());
		if (c.has("existing")) {
			for (JsonNode e : c.get("existing")) {
				String body = "{\"type\":\"" + e.get("type").asString() + "\",\"amount\":" + e.get("amount").asLong()
						+ ",\"title\":\"" + e.get("title").asString() + "\",\"categoryId\":"
						+ categoryId(token, e.get("type").asString(), e.get("category").asString())
						+ ",\"occurredAt\":\"" + e.get("at").asString() + "+09:00\"}";
				expect(auth(json(post("/api/v1/transactions"), body), token), 201);
			}
		}
		if (c.path("uploadTwice").asBoolean(false)) {
			upload(token);
		}
		JsonNode result = upload(token);
		JsonNode exp = c.get("expected");
		assertThat(result.get("bank").asString()).isEqualTo("SHINHAN");
		assertThat(result.get("from").asString()).isEqualTo("2026-10-01");
		assertThat(result.get("to").asString()).isEqualTo("2026-10-31");
		assertThat(result.get("imported").asInt()).as("imported").isEqualTo(exp.get("imported").asInt());
		assertThat(result.get("duplicates").asInt()).as("duplicates").isEqualTo(exp.get("duplicates").asInt());
		assertThat(result.get("afterBalance").asInt()).as("afterBalance").isEqualTo(exp.get("afterBalance").asInt());
		if (exp.has("saved")) {
			JsonNode items = body(expect(
					auth(get("/api/v1/transactions").param("from", "2026-10-01").param("to", "2026-10-31"), token), 200))
				.get("items");
			List<String> actual = new ArrayList<>();
			items.forEach(t -> actual.add(String.join("|", t.get("type").asString(), t.get("amount").asString(),
					t.get("title").asString(), t.get("category").get("name").asString(),
					OffsetDateTime.parse(t.get("occurredAt").asString()).atZoneSameInstant(SEOUL).toLocalDateTime().toString())));
			List<String> expected = new ArrayList<>();
			exp.get("saved").forEach(t -> expected.add(String.join("|", t.get("type").asString(),
					t.get("amount").asString(), t.get("title").asString(), t.get("category").asString(),
					LocalDateTime.parse(t.get("at").asString()).toString())));
			assertThat(actual).containsExactlyElementsOf(expected);
		}
	}

	private JsonNode upload(String token) throws Exception {
		MockMultipartFile file = new MockMultipartFile("file", "statement.pdf", "application/pdf",
				"%PDF-test".getBytes(StandardCharsets.US_ASCII));
		return body(expect(auth(multipart("/api/v1/transactions/statement-import").file(file).param("password", "000000"),
				token), 200));
	}

	private String categoryId(String token, String type, String name) throws Exception {
		for (JsonNode n : body(expect(auth(get("/api/v1/categories").param("type", type), token), 200))) {
			if (n.get("name").asString().equals(name)) {
				return n.get("id").asString();
			}
		}
		throw new IllegalStateException("카테고리 없음: " + name);
	}

	private String signup() throws Exception {
		String email = "statement-" + UUID.randomUUID() + "@example.com";
		return body(expect(json(post("/api/v1/auth/signup"),
				"{\"email\":\"" + email + "\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"),
				201))
			.get("accessToken")
			.asString();
	}

	private static Instant seoul(String local) {
		return LocalDateTime.parse(local).atZone(SEOUL).toInstant();
	}

	private MvcResult expect(AbstractMockHttpServletRequestBuilder<?> req, int status) throws Exception {
		MvcResult r = mvc.perform(req).andReturn();
		assertThat(r.getResponse().getStatus()).as(r.getResponse().getContentAsString(StandardCharsets.UTF_8))
			.isEqualTo(status);
		return r;
	}

	private static JsonNode body(MvcResult r) throws Exception {
		return JSON.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
	}

	private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder req, String body) {
		return req.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private static <B extends AbstractMockHttpServletRequestBuilder<B>> B auth(B req, String token) {
		return req.header("Authorization", "Bearer " + token);
	}
}
