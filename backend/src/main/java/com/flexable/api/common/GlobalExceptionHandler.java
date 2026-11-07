package com.flexable.api.common;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.errorlog.ErrorRecorder;
import com.flexable.api.errorlog.ErrorReport;
import com.flexable.api.errorlog.ErrorReport.Kind;
import com.flexable.api.errorlog.ErrorReport.Source;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
	private static final int STACK_LINES = 30;

	private final ErrorRecorder errors;

	public GlobalExceptionHandler(ErrorRecorder errors) {
		this.errors = errors;
	}

	@ExceptionHandler(ApiException.class)
	ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
		return ResponseEntity.status(e.code().status()).body(ErrorResponses.body(e.code(), e.getMessage(), e.extra()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<Map<String, Object>> handleInvalid(MethodArgumentNotValidException e) {
		Map<String, String> fields = new LinkedHashMap<>();
		for (FieldError fe : e.getBindingResult().getFieldErrors()) {
			fields.putIfAbsent(fe.getField(), fe.getDefaultMessage());
		}
		String message = fields.isEmpty() ? ErrorCode.VALIDATION_FAILED.message() : fields.values().iterator().next();
		return handleApi(new ApiException(ErrorCode.VALIDATION_FAILED, message, Map.of("fields", fields)));
	}

	@ExceptionHandler({ HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
			MethodArgumentTypeMismatchException.class, MissingRequestHeaderException.class })
	ResponseEntity<Map<String, Object>> handleBadRequest(Exception e) {
		return ErrorResponses.of(ErrorCode.VALIDATION_FAILED);
	}

	@ExceptionHandler({ NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class })
	ResponseEntity<Map<String, Object>> handleNotFound(Exception e) {
		return ErrorResponses.of(ErrorCode.NOT_FOUND);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<Map<String, Object>> handleUnknown(Exception e, HttpServletRequest request) {
		log.error("Unhandled error", e);
		errors.fromServer(new ErrorReport(Source.SERVER, Kind.SERVER, currentUserId(), null, null, null, null,
				request.getMethod(), request.getRequestURI(), 500, ErrorCode.INTERNAL_ERROR.name(),
				e.getClass().getSimpleName() + ": " + e.getMessage(), stack(e)));
		return ErrorResponses.of(ErrorCode.INTERNAL_ERROR);
	}

	private static Long currentUserId() {
		var auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
			try {
				return CurrentUser.id(jwt);
			}
			catch (RuntimeException ignored) {
				return null;
			}
		}
		return null;
	}

	private static String stack(Exception e) {
		StringWriter out = new StringWriter();
		e.printStackTrace(new PrintWriter(out));
		return String.join("\n", out.toString().lines().limit(STACK_LINES).toList());
	}
}
