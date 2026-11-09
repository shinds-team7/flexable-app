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
	static final String SCHEDULE = "propose_schedule";
	private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() { };

	private final RestClient http;
	private final ChatProperties props;

	public GeminiChatModel(RestClient geminiRestClient, ChatProperties props) {
		this.http = geminiRestClient;
		this.props = props;
	}

	@Override
	public Reply generate(String system, List<Message> messages, List<String> presets) {
		return generate(system, messages, presets, List.of());
	}

	@Override
	public Reply generate(String system, List<Message> messages, List<String> presets, List<String> categories) {
        return generate(system, messages, presets, categories, false);
    }

    @Override
    public Reply generate(String system, List<Message> messages, List<String> presets,
            List<String> categories, boolean income) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
		body.put("contents", contents(messages));
		List<Map<String, Object>> declarations = new ArrayList<>();
		if (!presets.isEmpty()) {
			declarations.add(Map.of(
					"name", PROPOSE,
					"description", "사용자가 요일별 하루 예산 배분을 바꾸고 싶어 할 때 바꿀 배분 방법을 제안한다. "
							+ "바로 저장되지 않고 사용자가 확인 버튼을 눌러야 바뀐다.",
					"parameters", Map.of("type", "object",
							"properties", Map.of("preset", Map.of("type", "string", "enum", presets,
									"description", "EVEN 기본 배분, RECORD 내 기록 기준, WEEKEND 주말 넉넉히, WEEKDAY 평일 넉넉히")),
							"required", List.of("preset"))));
		}
		if (!categories.isEmpty()) {
			Map<String, Object> props = new LinkedHashMap<>();
			props.put("title", Map.of("type", "string", "description", "일정 제목. 짧게(예: 술약속, 친구 생일 식사)"));
			props.put("date", Map.of("type", "string", "description", "일정 날짜 yyyy-MM-dd. 오늘이 아닌 가장 가까운 미래"));
			props.put("category", Map.of("type", "string", "enum", categories, "description", "쓸 돈이 속하는 지출 카테고리"));
			props.put("amount", Map.of("type", "integer", "description", "사용자가 직접 말한 금액(원). 말하지 않았으면 넣지 않는다"));
			declarations.add(Map.of(
					"name", SCHEDULE,
					"description", "사용자가 앞으로의 약속·모임 같은 일정을 말했을 때 예정 지출 등록을 제안한다. 금액은 서버가 기록으로 "
							+ "예측하므로 사용자가 말하지 않았다면 amount를 넣지 않는다. 바로 저장되지 않고 사용자가 확인해야 등록된다.",
					"parameters", Map.of("type", "object", "properties", props,
							"required", List.of("title", "date", "category"))));
		}
        if (income) {
            Map<String, Object> fields = new LinkedHashMap<>();
            fields.put("target", Map.of("type", "string", "enum", List.of("TRANSACTION", "SETTINGS")));
            fields.put("operation", Map.of("type", "string", "enum", List.of("CREATE", "UPDATE")));
            for (String name : List.of("title", "date", "category", "matchDate", "matchTitle")) {
                fields.put(name, Map.of("type", "string"));
            }
            for (String name : List.of("amount", "payday", "matchAmount")) {
                fields.put(name, Map.of("type", "integer"));
            }
            declarations.add(Map.of("name", "propose_income", "description",
                    "수입 등록·수정을 제안한다. TRANSACTION은 실제 받은 돈의 거래 기록, SETTINGS는 매달 받을 예정 수입액(amount)·수입일(payday). "
                    + "둘 중 불명확하면 먼저 되묻는다. CREATE는 명확한 제목·금액·날짜(오늘 기본), UPDATE는 사용자가 말한 수정 필드만 포함. "
                    + "matchDate(yyyy-MM-dd)·matchAmount·matchTitle은 기존 거래를 찾는 조건이며 새 값과 구분한다. "
                    + "category는 사용자가 명시한 수입 카테고리만, 날짜는 yyyy-MM-dd. 금액을 추정하거나 거래 ID를 만들지 않는다. 확인 전 저장되지 않는다.",
                    "parameters", Map.of("type", "object", "properties", fields,
                            "required", List.of("target", "operation"))));
        }
		if (!declarations.isEmpty()) {
			body.put("tools", List.of(Map.of("functionDeclarations", declarations)));
		}
		// 생각 단계를 줄여 응답을 빠르게 한다(Gemini 3 계열 thinkingLevel).
		body.put("generationConfig", Map.of("temperature", 0.6, "thinkingConfig", Map.of("thinkingLevel", "low")));

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
		ScheduleCall schedule = null;
        IncomeCall income = null;
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
			if (part.get("functionCall") instanceof Map<?, ?> call && SCHEDULE.equals(call.get("name"))
					&& call.get("args") instanceof Map<?, ?> args) {
				schedule = new ScheduleCall(str(args.get("title")), str(args.get("date")), str(args.get("category")),
						num(args.get("amount")));
			}
            if (part.get("functionCall") instanceof Map<?, ?> call && "propose_income".equals(call.get("name"))
                    && call.get("args") instanceof Map<?, ?> args) {
                income = new IncomeCall(str(args.get("target")), str(args.get("operation")),
                        str(args.get("title")), str(args.get("date")), str(args.get("category")),
                        exact(args.get("amount")), exact(args.get("payday")), str(args.get("matchDate")),
                        exact(args.get("matchAmount")), str(args.get("matchTitle")));
            }
		}
		if (text.isEmpty() && preset == null && schedule == null && income == null) {
			throw new Failure("Gemini 응답에 답변이 없음");
		}
		return new Reply(text.toString().trim(), preset, schedule, income);
	}

    private static Long exact(Object o) {
        if (o == null) return null;
        try {
            return new java.math.BigDecimal(o.toString().replace(",", "").trim()).longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            return Long.MIN_VALUE; // invalid supplied value must never become an omitted field
        }
    }

	private static String str(Object o) {
		return o instanceof String s ? s : null;
	}

	/** 모델이 정수를 실수(27300.0)나 문자열로 줄 때도 받는다. */
	private static Long num(Object o) {
		if (o instanceof Number n) {
			return n.longValue();
		}
		if (o instanceof String s) {
			try {
				return Long.parseLong(s.replace(",", "").trim());
			}
			catch (NumberFormatException e) {
				return null;
			}
		}
		return null;
	}
}
