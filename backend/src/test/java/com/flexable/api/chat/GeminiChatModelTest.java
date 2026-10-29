package com.flexable.api.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.flexable.api.chat.ChatDtos.Message;
import com.flexable.api.chat.ChatDtos.Role;
import com.flexable.api.config.ChatProperties;

class GeminiChatModelTest {
	private static final String URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
	private MockRestServiceServer server;
	private GeminiChatModel model;

	@BeforeEach
	void setup() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		model = new GeminiChatModel(builder.build(), new ChatProperties("test-key", ""));
	}

	@Test
	void sendsKeyInHeaderAndReadsFunctionCall() {
		server.expect(requestTo(URL))
			.andExpect(method(HttpMethod.POST))
			.andExpect(header("x-goog-api-key", "test-key"))
			.andExpect(jsonPath("$.systemInstruction.parts[0].text").value("규칙"))
			// 앞쪽 인사말은 버리고 이어진 사용자 메시지는 한 턴으로 합친다
			.andExpect(jsonPath("$.contents", Matchers.hasSize(3)))
			.andExpect(jsonPath("$.contents[0].role").value("user"))
			.andExpect(jsonPath("$.contents[0].parts[0].text").value("안녕\n주말에 더 쓰고 싶어"))
			.andExpect(jsonPath("$.contents[1].role").value("model"))
			.andExpect(jsonPath("$.contents[2].role").value("user"))
			.andExpect(jsonPath("$.tools[0].functionDeclarations[0].name").value("propose_day_preset"))
			.andExpect(jsonPath("$.tools[0].functionDeclarations[0].parameters.properties.preset.enum",
					Matchers.contains("WEEKEND", "WEEKDAY")))
			.andRespond(withSuccess("""
				{"candidates":[{"content":{"role":"model","parts":[
				  {"text":"생각 중","thought":true},
				  {"text":"주말 예산을 늘려 볼게요."},
				  {"functionCall":{"name":"propose_day_preset","args":{"preset":"WEEKEND"}}}]}}]}
				""", MediaType.APPLICATION_JSON));
		ChatModel.Reply r = model.generate("규칙", List.of(
				new Message(Role.MODEL, "무엇을 도와드릴까요?"),
				new Message(Role.USER, "안녕"),
				new Message(Role.USER, "주말에 더 쓰고 싶어"),
				new Message(Role.MODEL, "어떻게 바꿀까요?"),
				new Message(Role.USER, "바꿔 줘")), List.of("WEEKEND", "WEEKDAY"));
		assertThat(r.text()).isEqualTo("주말 예산을 늘려 볼게요.");
		assertThat(r.proposedPreset()).isEqualTo("WEEKEND");
		server.verify();
	}

	@Test
	void noToolsWithoutPresetsAndFailuresAreWrapped() {
		server.expect(requestTo(URL))
			.andExpect(jsonPath("$.tools").doesNotExist())
			.andRespond(withSuccess("{\"candidates\":[]}", MediaType.APPLICATION_JSON));
		assertThatThrownBy(() -> model.generate("규칙", List.of(new Message(Role.USER, "안녕")), List.of()))
			.isInstanceOf(ChatModel.Failure.class);
		server.verify();
		server.reset();

		server.expect(requestTo(URL)).andRespond(withServerError());
		assertThatThrownBy(() -> model.generate("규칙", List.of(new Message(Role.USER, "안녕")), List.of()))
			.isInstanceOf(ChatModel.Failure.class)
			.hasMessage("Gemini 응답 500");
	}
}
