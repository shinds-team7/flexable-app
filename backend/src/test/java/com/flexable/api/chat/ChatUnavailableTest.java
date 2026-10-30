package com.flexable.api.chat;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

/** 서버에 GEMINI_API_KEY가 없으면 모델을 부르지 않고 503 CHAT_UNAVAILABLE. */
@SpringBootTest
@AutoConfigureMockMvc
class ChatUnavailableTest {
	@Autowired
	MockMvc mvc;
	@MockitoBean
	ChatModel model;

	@Test
	void withoutKeyReturnsUnavailable() throws Exception {
		String signup = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"nochat-" + UUID.randomUUID()
					+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		String token = JsonPath.read(signup, "$.accessToken");
		mvc.perform(post("/api/v1/chat/messages").header("Authorization", "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"messages\":[{\"role\":\"USER\",\"text\":\"안녕\"}]}"))
			.andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.code", is("CHAT_UNAVAILABLE")));
		verify(model, never()).generate(any(), any(), any());
	}
}
