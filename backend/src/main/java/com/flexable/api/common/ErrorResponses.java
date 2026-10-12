package com.flexable.api.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;

public final class ErrorResponses {

	private ErrorResponses() {
	}

	public static Map<String, Object> body(ErrorCode code, String message, Map<String, Object> extra) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("code", code.name());
		body.put("message", message);
		body.putAll(extra);
		return body;
	}

	public static ResponseEntity<Map<String, Object>> of(ErrorCode code) {
		return ResponseEntity.status(code.status()).body(body(code, code.message(), Map.of()));
	}
}
