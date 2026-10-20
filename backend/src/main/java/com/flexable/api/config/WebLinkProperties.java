package com.flexable.api.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 웹 서버가 /internal/** 을 부를 때 쓰는 서비스 키(쉼표 구분, 교체 중엔 두 개). 비어 있으면 internal API는 모두 401이다.
 * 32자 미만 키는 쓰지 않는다.
 */
@ConfigurationProperties("app.web-link")
public record WebLinkProperties(List<String> serviceKeys) {

	static final int MIN_KEY_LENGTH = 32;

	public List<String> usableKeys() {
		return serviceKeys == null ? List.of()
				: serviceKeys.stream().map(String::trim).filter(k -> k.length() >= MIN_KEY_LENGTH).toList();
	}
}
