package com.flexable.api.coin;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 구글이 공개한 키(verifier-keys.json)로 ECDSA(SHA-256) 서명을 확인한다.
 * 서명 대상은 쿼리에서 "&signature=" 앞까지의 원문이다. 모르는 key_id가 오면 키 목록을 다시 받는다(최대 5분에 한 번).
 */
@Component
public class GoogleAdSignatureVerifier implements AdSignatureVerifier {

	static final String KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
	private static final Logger log = LoggerFactory.getLogger(GoogleAdSignatureVerifier.class);
	private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() { };
	private static final Duration REFRESH_GAP = Duration.ofMinutes(5);

	private final RestClient http;
	private final Map<String, PublicKey> keys = new ConcurrentHashMap<>();
	private volatile Instant fetchedAt = Instant.EPOCH;

	public GoogleAdSignatureVerifier(RestClient oauthRestClient) {
		this.http = oauthRestClient;
	}

	@Override
	public boolean verify(String query) {
		if (query == null) {
			return false;
		}
		int at = query.indexOf("&signature=");
		if (at < 0) {
			return false;
		}
		String message = query.substring(0, at);
		String signature = param(query, "signature");
		String keyId = param(query, "key_id");
		if (signature == null || keyId == null) {
			return false;
		}
		PublicKey key = key(keyId);
		if (key == null) {
			return false;
		}
		try {
			Signature s = Signature.getInstance("SHA256withECDSA");
			s.initVerify(key);
			s.update(message.getBytes(StandardCharsets.UTF_8));
			return s.verify(Base64.getUrlDecoder().decode(signature));
		}
		catch (Exception e) {
			return false;
		}
	}

	private PublicKey key(String keyId) {
		PublicKey known = keys.get(keyId);
		if (known != null || Instant.now().isBefore(fetchedAt.plus(REFRESH_GAP))) {
			return known;
		}
		refresh();
		return keys.get(keyId);
	}

	private synchronized void refresh() {
		if (Instant.now().isBefore(fetchedAt.plus(REFRESH_GAP))) {
			return;
		}
		fetchedAt = Instant.now();
		try {
			Map<String, Object> body = http.get().uri(KEYS_URL).retrieve().body(MAP);
			if (body == null || !(body.get("keys") instanceof List<?> list)) {
				return;
			}
			KeyFactory factory = KeyFactory.getInstance("EC");
			for (Object item : list) {
				if (item instanceof Map<?, ?> m && m.get("keyId") != null && m.get("base64") instanceof String b64) {
					keys.put(String.valueOf(m.get("keyId")),
							factory.generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(b64))));
				}
			}
		}
		catch (Exception e) {
			log.warn("AdMob 검증 키를 받지 못했어요: {}", e.toString());
		}
	}

	static String param(String query, String name) {
		for (String pair : query.split("&")) {
			if (pair.startsWith(name + "=")) {
				return pair.substring(name.length() + 1);
			}
		}
		return null;
	}
}
