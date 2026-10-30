package com.flexable.api.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

/**
 * AI 메이트: 서버 계산 예산과 카테고리별 합계만 모델에 넘기고, 변경은 제안(action)만 돌려준다.
 * 2026-10-27(화) 정오로 시계를 고정한다. 수입일 25일, 잔액 1,000,000원이면 기본 배분 하루 예산은 34,482원이다.
 */
@SpringBootTest(properties = "app.chat.gemini-api-key=test-gemini-key")
@AutoConfigureMockMvc
class ChatFlowTest {

	static class MutableClock extends Clock {
		volatile Instant now = Instant.parse("2026-10-27T03:00:00Z");

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
	ChatModel model;

	private static final String SETTINGS = "{\"balance\":1000000,\"payday\":25,\"incomeAmount\":2000000,"
			+ "\"cardUnpaid\":0,\"fixedExpenses\":[],\"protectedItems\":[]}";
	private static final String ASK = "{\"messages\":[{\"role\":\"USER\",\"text\":\"주말에 좀 더 쓰고 싶어\"}]}";

	private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder b, String token, String body) {
		b.header("Authorization", "Bearer " + token);
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	/** 토큰 만료는 실제 시각으로 검사하므로, 가입(토큰 발급)만 지금 시각에 하고 고정한 시각으로 돌아온다. */
	private String signup() throws Exception {
		Instant fixed = clock.now;
		clock.now = Instant.now();
		try {
			ResultActions r = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"chat-" + UUID.randomUUID()
						+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
				.andExpect(status().isCreated());
			return JsonPath.read(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.accessToken");
		}
		finally {
			clock.now = fixed;
		}
	}

	private long foodCategory(String token) throws Exception {
		String categories = mvc.perform(auth(get("/api/v1/categories?type=EXPENSE"), token, null))
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		return ((Number) JsonPath.<net.minidev.json.JSONArray>read(categories, "$[?(@.name == '식비')].id").get(0)).longValue();
	}

	@Test
	@SuppressWarnings("unchecked")
	void sendsServerBudgetAndProposesPresetWithoutSaving() throws Exception {
		String token = signup();
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());
		mvc.perform(auth(post("/api/v1/transactions"), token, "{\"type\":\"EXPENSE\",\"amount\":12000,\"categoryId\":"
				+ foodCategory(token) + ",\"title\":\"비밀 점심\",\"memo\":\"비밀 메모\",\"occurredAt\":\"2026-10-27T12:00:00+09:00\"}"))
			.andExpect(status().isCreated());

		when(model.generate(anyString(), anyList(), anyList())).thenReturn(new ChatModel.Reply("좋아요.", "WEEKEND"));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.action.type", is("DAY_PRESET")))
			.andExpect(jsonPath("$.action.preset", is("WEEKEND")))
			.andExpect(jsonPath("$.action.label", is("주말 넉넉히")))
			.andExpect(jsonPath("$.reply", is("좋아요.\n\n요일별 배분을 **주말 넉넉히**로 바꿀까요?\n확인을 누르면 오늘 하루 예산부터 바뀌어요.")));

		ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
		ArgumentCaptor<List<String>> presets = ArgumentCaptor.forClass(List.class);
		verify(model).generate(system.capture(), anyList(), presets.capture());
		// 지금 배분(기본)과 기록이 부족한 내 기록 기준은 제안하지 않는다
		assertThat(presets.getValue()).containsExactly("WEEKEND", "WEEKDAY");
		// 금액은 홈과 같은 서버 계산값을 그대로 넘긴다
		String today = mvc.perform(auth(get("/api/v1/budget/today"), token, null))
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		long available = ((Number) JsonPath.read(today, "$.todayAvailable")).longValue();
		long daily = ((Number) JsonPath.read(today, "$.dailyBudget")).longValue();
		String cycleStart = JsonPath.read(today, "$.cycleStart");
		assertThat(system.getValue())
			.contains("오늘: 2026-10-27(화)")
			.contains(String.format("오늘 쓸 수 있는 돈: %,d원 (오늘 하루 예산 %,d원, 오늘 쓴 돈 12,000원)", available, daily))
			.contains("요일별 생활비 배분: 기본 배분")
			.contains("이번 기간(" + cycleStart + " ~ 2026-10-27) 지출 합계 12,000원: 식비 12,000원(1건)")
			.contains("직전 같은 길이 기간(")
			.doesNotContain("비밀");

		// 제안만 했으므로 배분은 그대로다
		mvc.perform(auth(get("/api/v1/budget/day-weights"), token, null)).andExpect(jsonPath("$.preset", is("EVEN")));
	}

	@Test
	void ignoresPresetsThatCannotBeProposed() throws Exception {
		String token = signup();
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());

		// 지금 배분과 같은 프리셋: 말만 돌려준다
		when(model.generate(anyString(), anyList(), anyList())).thenReturn(new ChatModel.Reply("지금 그대로예요.", "EVEN"));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.reply", is("지금 그대로예요.")))
			.andExpect(jsonPath("$.action", nullValue()));

		// 기록이 부족한 내 기록 기준만 제안하고 말이 없으면 실패로 본다
		when(model.generate(anyString(), anyList(), anyList())).thenReturn(new ChatModel.Reply("", "RECORD"));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isBadGateway())
			.andExpect(jsonPath("$.code", is("CHAT_FAILED")));
	}

	@Test
	void treatsSingleMentionedPresetAsProposal() throws Exception {
		String token = signup();
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());

		// 도구 없이 말로만 권해도 바꿀 수 있는 배분이 하나뿐이면 제안으로 붙인다
		when(model.generate(anyString(), anyList(), anyList()))
			.thenReturn(new ChatModel.Reply("**주말 넉넉히** 배분이 잘 맞겠어요.", null));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.action.preset", is("WEEKEND")));

		// 둘 이상이거나 지금 배분(기본 배분)만 나오면 붙이지 않는다
		when(model.generate(anyString(), anyList(), anyList()))
			.thenReturn(new ChatModel.Reply("주말 넉넉히와 평일 넉넉히 중에 고를 수 있어요.", null));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.action", nullValue()));
		when(model.generate(anyString(), anyList(), anyList()))
			.thenReturn(new ChatModel.Reply("지금은 기본 배분이에요.", null));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.action", nullValue()));
		mvc.perform(auth(get("/api/v1/budget/day-weights"), token, null)).andExpect(jsonPath("$.preset", is("EVEN")));
	}

	@Test
	@SuppressWarnings("unchecked")
	void answersWithoutBudgetButOffersNoChange() throws Exception {
		String token = signup();
		when(model.generate(anyString(), anyList(), anyList())).thenReturn(new ChatModel.Reply("먼저 설정해 주세요.", "WEEKEND"));
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.action", nullValue()));
		ArgumentCaptor<List<String>> presets = ArgumentCaptor.forClass(List.class);
		ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
		verify(model).generate(system.capture(), anyList(), presets.capture());
		assertThat(presets.getValue()).isEmpty();
		assertThat(system.getValue()).contains("아직 초기 예산(잔액·수입일)을 설정하지 않았다")
			.contains("이번 기간(2026-10-01 ~ 2026-10-27) 지출 합계 0원, 기록 없음");
	}

	@Test
	void limitsCallsPerUser() throws Exception {
		String token = signup();
		when(model.generate(anyString(), anyList(), anyList())).thenReturn(new ChatModel.Reply("네.", null));
		for (int i = 0; i < ChatRateLimiter.MAX_CALLS; i++) {
			mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK)).andExpect(status().isOk());
		}
		mvc.perform(auth(post("/api/v1/chat/messages"), token, ASK))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.retryAfterSeconds").exists());
	}

	@Test
	void rejectsHistoryEndingWithModel() throws Exception {
		String token = signup();
		mvc.perform(auth(post("/api/v1/chat/messages"), token,
				"{\"messages\":[{\"role\":\"USER\",\"text\":\"안녕\"},{\"role\":\"MODEL\",\"text\":\"네\"}]}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.messages").exists());
		mvc.perform(auth(post("/api/v1/chat/messages"), token,
				"{\"messages\":[{\"role\":\"USER\",\"text\":\"" + "가".repeat(1001) + "\"}]}"))
			.andExpect(status().isBadRequest());
		verify(model, never()).generate(any(), any(), any());
	}
}
