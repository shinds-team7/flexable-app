package com.flexable.api.config;

import java.time.ZoneId;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(Jwt jwt, List<String> corsOrigins, String zone) {

	public record Jwt(String secret, int ttlDays) {
	}

	public ZoneId zoneId() {
		return ZoneId.of(zone);
	}
}
