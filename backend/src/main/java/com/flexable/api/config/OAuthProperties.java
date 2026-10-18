package com.flexable.api.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.oauth")
public record OAuthProperties(String callbackBaseUrl, List<String> allowedRedirectUris, Kakao kakao, Google google) {
	public record Kakao(String clientId, String clientSecret, String adminKey, String scope) {
	}
	public record Google(String clientId, String clientSecret) {
	}
	public String clientId(String provider) {
		return "kakao".equals(provider) ? kakao.clientId() : google.clientId();
	}
	public String callback(String provider) {
		return callbackBaseUrl + "/api/v1/auth/oauth/" + provider + "/callback";
	}
}
