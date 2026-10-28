package com.flexable.api.config;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class ChatConfig {
	/** 모델 답변은 몇 초씩 걸리므로 읽기 제한을 OAuth보다 길게 둔다. */
	@Bean
	RestClient geminiRestClient() {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(Duration.ofSeconds(3));
		factory.setReadTimeout(Duration.ofSeconds(30));
		return RestClient.builder().requestFactory(factory).build();
	}
}
