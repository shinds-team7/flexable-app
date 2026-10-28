package com.flexable.api.chat;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.flexable.api.chat.ChatDtos.Message;
import com.flexable.api.chat.ChatDtos.Role;
import com.flexable.api.config.ChatProperties;

/**
 * Gemini generateContent REST 호출. 키는 쿼리가 아니라 x-goog-api-key 헤더로 보낸다(접속 기록에 남지 않게).
 * 변경 제안은 함수 호출(propose_day_preset)로 받고, 실제 저장은 하지 않는다.
 */
@Component
public class GeminiChatModel implements ChatModel {

	static final String URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
	static final String PROPOSE = "propose_day_preset";
	private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() { };

	private final RestClient http;
	private final ChatProperties props;

	public GeminiChatModel(RestClient geminiRestClient, ChatProperties props) {
		this.http = geminiRestClient;
		this.props = props;
	}

	@Override
	public Reply generate(String system, List<Message> messages, List<String> presets) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
		body.put("contents", contents(messages));
		if (!presets.isEmpty()) {
			body.put("tools", List.of(Map.of("functionDeclarations", List.of(Map.of(
					"name", PROPOSE,
					"description", "사용자가 요일별 하루 예산 배분을 바꾸고 싶어 할 때 바꿀 배분 방법을 제안한다. "
							+ "바로 저장되지 않고 사용자가 확인 버튼을 눌러야 바뀐다.",
					"parameters", Map.of("type", "object",
							"properties", Map.of("preset", Map.of("type", "string", "enum", presets,
									"description", "EVEN 기본 배분, RECORD 내 기록 기준, WEEKEND 주말 넉넉히, WEEKDAY 평일 넉넉히")),
							"required", List.of("preset")))))));
		}
		body.put("generationConfig", Map.of("temperature", 0.6));

		Map<String, Object> res;
		try {
			res = http.post()
				.uri(URL, props.model())
				.header("x-goog-api-key", props.geminiApiKey().trim())
				.contentType(MediaType.APPLICATION_JSON)
				.body(body)
				.retrieve()
				.body(MAP);
		}
		catch (RestClientResponseException e) {
			// 응답 본문에는 요청 내용이 섞일 수 있어 상태 코드만 남긴다.
			throw new Failure("Gemini 응답 " + e.getStatusCode().value(), e);
		}
		catch (RestClientException e) {
			throw new Failure("Gemini 호출 실패: " + e.getClass().getSimpleName(), e);
		}
		return parse(res);
	}

	/** 첫 사용자 메시지 앞의 인사말(MODEL)은 버리고, 같은 역할이 이어지면 한 턴으로 합친다(Gemini는 user·model을 번갈아 받는다). */
	static List<Map<String, Object>> contents(List<Message> messages) {
		List<Map<String, Object>> out = new ArrayList<>();
		Role last = null;
		StringBuilder text = new StringBuilder();
		for (Message m : messages) {
			if (last == null && m.role() != Role.USER) {
				continue;
			}
			if (m.role() != last && last != null) {
				out.add(turn(last, text.toString()));
				text.setLength(0);
			}
			if (!text.isEmpty()) {
				text.append('\n');
			}
			text.append(m.text().trim());
			last = m.role();
		}
		if (last != null) {
			out.add(turn(last, text.toString()));
		}
		return out;
	}

	private static Map<String, Object> turn(Role role, String text) {
		return Map.of("role", role == Role.USER ? "user" : "model", "parts", List.of(Map.of("text", text)));
	}

	static Reply parse(Map<String, Object> res) {
		if (res == null || !(res.get("candidates") instanceof List<?> candidates) || candidates.isEmpty()
				|| !(candidates.get(0) instanceof Map<?, ?> first)
				|| !(first.get("content") instanceof Map<?, ?> content)
				|| !(content.get("parts") instanceof List<?> parts)) {
			throw new Failure("Gemini 응답에 답변이 없음");
		}
		StringBuilder text = new StringBuilder();
		String preset = null;
		for (Object p : parts) {
			if (!(p instanceof Map<?, ?> part) || Boolean.TRUE.equals(part.get("thought"))) {
				continue;
			}
			if (part.get("text") instanceof String t) {
				text.append(t);
			}
			if (part.get("functionCall") instanceof Map<?, ?> call && PROPOSE.equals(call.get("name"))
					&& call.get("args") instanceof Map<?, ?> args && args.get("preset") instanceof String s) {
				preset = s;
			}
		}
		if (text.isEmpty() && preset == null) {
			throw new Failure("Gemini 응답에 답변이 없음");
		}
		return new Reply(text.toString().trim(), preset);
	}
}
