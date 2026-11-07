package com.flexable.api.errorlog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.errorlog.ErrorReport.Kind;
import com.flexable.api.errorlog.ErrorReport.Source;
import com.jayway.jsonpath.JsonPath;

/** 오류 기록(docs/decisions/2026-11-07-error-events.md): 앱 보고·서버 500 저장, 가리기, 하루 묶기, 한도, 탈퇴·30일 삭제. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(ErrorEventTest.Boom.class)
class ErrorEventTest {

	/** 처리하지 못한 예외(500)를 내는 테스트용 API */
	@RestController
	static class Boom {
		@GetMapping("/api/v1/test-boom/42")
		String boom() {
			throw new IllegalStateException("테스트 실패 user@example.com 12,000");
		}
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	ErrorEventRepository events;

	@Autowired
	ErrorEventService service;

	private String[] signup() throws Exception {
		String body = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"err-" + UUID.randomUUID()
					+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString(StandardCharsets.UTF_8);
		return new String[] { JsonPath.read(body, "$.accessToken"),
				String.valueOf((Object) JsonPath.read(body, "$.user.id")) };
	}

	private void report(String token, String json, int expected) throws Exception {
		var req = post("/api/v1/client-errors").contentType(MediaType.APPLICATION_JSON).content(json);
		if (token != null) {
			req.header("Authorization", "Bearer " + token);
		}
		mvc.perform(req).andExpect(status().is(expected));
	}

	private List<ErrorEvent> of(long userId) {
		return events.findAll().stream().filter(e -> Long.valueOf(userId).equals(e.getUserId())).toList();
	}

	private static String apiError(String message) {
		return """
				{"kind":"API","message":"%s","method":"POST","path":"/api/v1/transactions/123?from=2026-11-07",
				 "status":400,"code":"VALIDATION_FAILED","screen":"/home","appVersion":"1.8.0",
				 "updateId":"6afc12b2-545f-4cba-b53d-8ec9677e3fc7","platform":"android"}
				""".formatted(message);
	}

	@Test
	void appReportsAreMaskedAndTheSameErrorIsOneRowADay() throws Exception {
		String[] me = signup();
		long id = Long.parseLong(me[1]);
		report(me[0], apiError("요청 키가 너무 길어요 1,200원 a.b@example.com"), 204);
		report(me[0], apiError("요청 키가 너무 길어요 1,200원 a.b@example.com"), 204);

		List<ErrorEvent> mine = of(id);
		assertThat(mine).hasSize(1);
		ErrorEvent e = mine.get(0);
		assertThat(e.getOccurrences()).isEqualTo(2);
		assertThat(e.getSource()).isEqualTo("APP");
		assertThat(e.getKind()).isEqualTo("API");
		assertThat(e.getMessage()).isEqualTo("요청 키가 너무 길어요 #원 ***@***");
		assertThat(e.getPath()).isEqualTo("/api/v1/transactions/{id}");
		assertThat(e.getStatus()).isEqualTo(400);
		assertThat(e.getCode()).isEqualTo("VALIDATION_FAILED");
	}

	@Test
	void anonymousReportsAreAcceptedAndBadOnesRejected() throws Exception {
		long before = events.count();
		report(null, "{\"kind\":\"CRASH\",\"message\":\"Cannot read properties of undefined\",\"stack\":\"at Home\"}",
				204);
		assertThat(events.count()).isGreaterThan(before);
		report(null, "{\"kind\":\"SERVER\",\"message\":\"x\"}", 400);
		report(null, "{\"kind\":\"JS\",\"message\":\"\"}", 400);
		report(null, "{\"kind\":\"JS\",\"message\":\"x\",\"platform\":\"desktop\"}", 400);
	}

	@Test
	void oneSenderIsLimitedToThirtyReportsInTenMinutes() throws Exception {
		String[] me = signup();
		for (int i = 0; i < ErrorRecorder.MAX_REPORTS + 5; i++) {
			// 메시지가 달라야 줄이 따로 생긴다(숫자는 가려지므로 글자로 다르게)
			report(me[0], "{\"kind\":\"JS\",\"message\":\"오류 " + "가".repeat(i + 1) + "\"}", 204);
		}
		assertThat(of(Long.parseLong(me[1]))).hasSize(ErrorRecorder.MAX_REPORTS);
	}

	@Test
	void unhandledServerErrorsAreRecordedWithTheUser() throws Exception {
		String[] me = signup();
		mvc.perform(get("/api/v1/test-boom/42").header("Authorization", "Bearer " + me[0]))
			.andExpect(status().isInternalServerError())
			.andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
		List<ErrorEvent> mine = of(Long.parseLong(me[1]));
		assertThat(mine).hasSize(1);
		ErrorEvent e = mine.get(0);
		assertThat(e.getSource()).isEqualTo("SERVER");
		assertThat(e.getPath()).isEqualTo("/api/v1/test-boom/{id}");
		assertThat(e.getStatus()).isEqualTo(500);
		assertThat(e.getMessage()).isEqualTo("IllegalStateException: 테스트 실패 ***@*** #");
		assertThat(e.getStack()).contains("IllegalStateException");
	}

	@Test
	void deletingTheAccountRemovesItsErrors() throws Exception {
		String[] me = signup();
		report(me[0], apiError("탈퇴 전 오류"), 204);
		assertThat(of(Long.parseLong(me[1]))).hasSize(1);
		mvc.perform(delete("/api/v1/me").header("Authorization", "Bearer " + me[0])
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"password\":\"abcd1234\",\"confirm\":\"탈퇴\"}")).andExpect(status().isNoContent());
		assertThat(of(Long.parseLong(me[1]))).isEmpty();
	}

	@Test
	void cleanupDeletesRowsOlderThanThirtyDays() {
		LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
		ErrorReport r = new ErrorReport(Source.APP, Kind.JS, null, null, null, null, null, null, null, null, null,
				"오래된 오류", null);
		ErrorEvent old = events.save(new ErrorEvent(today.minusDays(ErrorEventService.KEEP_DAYS + 1),
				UUID.randomUUID().toString().replace("-", "") + "0".repeat(32),
				r, Instant.now()));
		ErrorEvent kept = events.save(new ErrorEvent(today.minusDays(ErrorEventService.KEEP_DAYS),
				"k".repeat(32) + UUID.randomUUID().toString().replace("-", ""), r, Instant.now()));
		service.cleanup();
		assertThat(events.findById(old.getId())).isEmpty();
		assertThat(events.findById(kept.getId())).isPresent();
	}

	@Test
	void maskingAndPathRules() {
		assertThat(ErrorEventService.mask("잔액 1,234,567원, 전화 010-1234-5678, 2개"))
			.isEqualTo("잔액 #원, 전화 #-#-#, 2개");
		assertThat(ErrorEventService.normalizePath("/api/v1/scheduled-expenses/77?from=2026-11-01"))
			.isEqualTo("/api/v1/scheduled-expenses/{id}");
		assertThat(ErrorEventService.normalizePath("/api/v1/outfits/outfit-03/purchase"))
			.isEqualTo("/api/v1/outfits/outfit-03/purchase");
		assertThat(ErrorEventService.normalizePath(null)).isNull();
	}
}
