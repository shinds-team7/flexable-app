package com.flexable.api.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.flexable.api.auth.TokenService;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.user.UserRepository;

@Configuration
public class SecurityConfig {

	private static final String UNAUTHORIZED_BODY = "{\"code\":\"UNAUTHORIZED\",\"message\":\""
			+ ErrorCode.UNAUTHORIZED.message() + "\"}";

	@Bean
	SecurityFilterChain filterChain(HttpSecurity http, TokenService tokens, UserRepository users) throws Exception {
		AuthenticationEntryPoint entryPoint = (request, response, ex) -> {
			response.setStatus(ErrorCode.UNAUTHORIZED.status().value());
			response.setContentType("application/json;charset=UTF-8");
			response.getWriter().write(UNAUTHORIZED_BODY);
		};
		http.csrf(csrf -> csrf.disable())
			.cors(Customizer.withDefaults())
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth
				.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/v1/auth/signup", "/api/v1/auth/login").permitAll()
				.requestMatchers("/api/v1/health", "/actuator/health/**", "/error").permitAll()
				.anyRequest().authenticated())
			.oauth2ResourceServer(rs -> rs
				.authenticationEntryPoint(entryPoint)
				.jwt(jwt -> jwt.decoder(tokens.decoder()).jwtAuthenticationConverter(converter(users))))
			.exceptionHandling(e -> e.authenticationEntryPoint(entryPoint));
		return http.build();
	}

	/** 탈퇴한 계정이나 로그아웃(토큰 버전 증가)된 토큰은 거절한다. */
	private Converter<Jwt, AbstractAuthenticationToken> converter(UserRepository users) {
		return jwt -> {
			long userId;
			try {
				userId = Long.parseLong(jwt.getSubject());
			}
			catch (NumberFormatException e) {
				throw new InvalidBearerTokenException("invalid subject");
			}
			Object tv = jwt.getClaims().get(TokenService.TOKEN_VERSION_CLAIM);
			boolean valid = tv instanceof Number n && users.findById(userId)
				.map(u -> u.getTokenVersion() == n.intValue())
				.orElse(false);
			if (!valid) {
				throw new InvalidBearerTokenException("revoked");
			}
			return new JwtAuthenticationToken(jwt, List.of(), jwt.getSubject());
		};
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(props.corsOrigins());
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
		config.setMaxAge(3600L);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", config);
		return source;
	}
}
