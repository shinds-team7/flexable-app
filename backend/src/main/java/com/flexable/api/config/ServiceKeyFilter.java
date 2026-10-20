package com.flexable.api.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

import org.springframework.web.filter.OncePerRequestFilter;

import com.flexable.api.common.ErrorCode;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * /internal/** 서버 간 API의 서비스 키 검사. 키 교체 중에는 두 키를 함께 허용한다.
 * 빈으로 등록하지 않는다(등록하면 모든 경로의 서블릿 필터로도 붙는다). SecurityConfig의 internal 체인에서만 쓴다.
 */
final class ServiceKeyFilter extends OncePerRequestFilter {

	static final String HEADER = "X-Service-Key";

	private static final String UNAUTHORIZED_BODY = "{\"code\":\"UNAUTHORIZED\",\"message\":\""
			+ ErrorCode.UNAUTHORIZED.message() + "\"}";

	private final List<byte[]> keys;

	ServiceKeyFilter(List<String> keys) {
		this.keys = keys.stream().map(k -> k.getBytes(StandardCharsets.UTF_8)).toList();
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String given = request.getHeader(HEADER);
		if (given != null && matches(given.getBytes(StandardCharsets.UTF_8))) {
			chain.doFilter(request, response);
			return;
		}
		response.setStatus(ErrorCode.UNAUTHORIZED.status().value());
		response.setContentType("application/json;charset=UTF-8");
		response.getWriter().write(UNAUTHORIZED_BODY);
	}

	private boolean matches(byte[] given) {
		boolean ok = false;
		for (byte[] key : keys) {
			ok |= MessageDigest.isEqual(key, given);
		}
		return ok;
	}
}
