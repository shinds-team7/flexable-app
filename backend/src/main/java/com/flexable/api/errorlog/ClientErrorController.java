package com.flexable.api.errorlog;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.errorlog.ErrorReport.Kind;
import com.flexable.api.errorlog.ErrorReport.Source;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 앱이 겪은 오류를 받는다. 로그인 없이도 보낼 수 있고, 토큰이 있으면 회원 번호를 함께 남긴다.
 * 받으면(한도를 넘어 버려도) 204. 앱은 결과를 기다리지 않는다.
 */
@RestController
@RequestMapping("/api/v1/client-errors")
public class ClientErrorController {

	private final ErrorRecorder recorder;

	public ClientErrorController(ErrorRecorder recorder) {
		this.recorder = recorder;
	}

	public record ClientErrorRequest(
			@NotNull(message = "오류 종류를 확인해 주세요") ClientKind kind,
			@NotBlank(message = "오류 내용을 확인해 주세요") @Size(max = 2000, message = "오류 내용이 너무 길어요") String message,
			@Size(max = 8000, message = "오류 위치가 너무 길어요") String stack,
			@Size(max = 100, message = "화면 이름이 너무 길어요") String screen,
			@Pattern(regexp = "GET|POST|PUT|PATCH|DELETE", message = "요청 방식을 확인해 주세요") String method,
			@Size(max = 300, message = "요청 경로가 너무 길어요") String path,
			@Min(value = 0, message = "상태 코드를 확인해 주세요") @Max(value = 599, message = "상태 코드를 확인해 주세요") Integer status,
			@Size(max = 40, message = "오류 코드가 너무 길어요") String code,
			@Size(max = 20, message = "앱 버전이 너무 길어요") String appVersion,
			@Size(max = 64, message = "업데이트 id가 너무 길어요") String updateId,
			@Pattern(regexp = "android|ios|web", message = "플랫폼을 확인해 주세요") String platform) {
	}

	/** 앱 쪽 종류. SERVER는 서버만 쓴다. */
	public enum ClientKind {
		API, CRASH, JS
	}

	@PostMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void report(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ClientErrorRequest req) {
		recorder.fromApp(new ErrorReport(Source.APP, Kind.valueOf(req.kind().name()), jwt == null ? null : CurrentUser.id(jwt),
				req.appVersion(), req.updateId(), req.platform(), req.screen(), req.method(), req.path(), req.status(),
				req.code(), req.message(), req.stack()));
	}
}
