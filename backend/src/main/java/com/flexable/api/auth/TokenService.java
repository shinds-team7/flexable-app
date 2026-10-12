package com.flexable.api.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import com.flexable.api.config.AppProperties;
import com.flexable.api.user.User;

@Component
public class TokenService {

	public static final String TOKEN_VERSION_CLAIM = "tv";

	private final JwtEncoder encoder;
	private final JwtDecoder decoder;
	private final Duration ttl;
	private final Clock clock;

	public TokenService(AppProperties props, Clock clock) {
		String secret = props.jwt().secret();
		if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
			throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
		}
		SecretKey key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
		this.encoder = NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build();
		this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
		this.ttl = Duration.ofDays(props.jwt().ttlDays());
		this.clock = clock;
	}

	public IssuedToken issue(User user) {
		Instant now = clock.instant();
		Instant expiresAt = now.plus(ttl);
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.subject(String.valueOf(user.getId()))
			.issuedAt(now)
			.expiresAt(expiresAt)
			.claim(TOKEN_VERSION_CLAIM, user.getTokenVersion())
			.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
		return new IssuedToken(value, expiresAt);
	}

	public JwtDecoder decoder() {
		return decoder;
	}

	public record IssuedToken(String value, Instant expiresAt) {
	}
}
