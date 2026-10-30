package com.flexable.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 메이트(Gemini). 키는 서버 환경 변수(GEMINI_API_KEY)로만 넣고 저장소에 두지 않는다.
 * 키가 비어 있으면 POST /chat/messages는 503 CHAT_UNAVAILABLE이다.
 */
@ConfigurationProperties("app.chat")
public record ChatProperties(String geminiApiKey, String geminiModel) {

	public boolean enabled() {
		return geminiApiKey != null && !geminiApiKey.isBlank();
	}

	public String model() {
		return geminiModel == null || geminiModel.isBlank() ? "gemini-3.5-flash-lite" : geminiModel.trim();
	}
}
