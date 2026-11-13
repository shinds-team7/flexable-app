package com.flexable.api.config;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class ChatConfig {
	/**
	 * 모델 답변은 몇 초씩 걸리므로 읽기 제한을 OAuth보다 길게 둔다. 다만 앱이 40초에 끊으므로, 일정 안내 문장
	 * (ChatService, 최대 6초)과 재시도 한 번까지 합쳐 그 안에 끝나게 20초로 둔다.
	 */
	@Bean
	RestClient geminiRestClient() {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(Duration.ofSeconds(3));
		factory.setReadTimeout(Duration.ofSeconds(20));
		return RestClient.builder().requestFactory(factory).build();
	}
}
