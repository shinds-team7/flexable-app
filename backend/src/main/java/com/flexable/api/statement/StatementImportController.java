package com.flexable.api.statement;

import java.io.IOException;

import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.common.ApiException;

@RestController
public class StatementImportController {

	/** application.yml의 multipart 한도와 같게 둔다. */
	static final long MAX_BYTES = 10L * 1024 * 1024;

	private final StatementImportService service;

	public StatementImportController(StatementImportService service) {
		this.service = service;
	}

	@PostMapping(path = "/api/v1/transactions/statement-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	StatementImportService.Result importStatement(@AuthenticationPrincipal Jwt jwt,
			@RequestPart("file") MultipartFile file, @RequestParam(name = "password", required = false) String password)
			throws IOException {
		if (file.isEmpty()) {
			throw ApiException.invalid("file", "PDF 파일을 골라 주세요");
		}
		if (file.getSize() > MAX_BYTES) {
			throw ApiException.invalid("file", "10MB 이하 PDF만 올릴 수 있어요");
		}
		if (password != null && password.length() > 64) {
			throw ApiException.invalid("password", "비밀번호가 너무 길어요");
		}
		ParsedStatement parsed = service.read(file.getBytes(), password);
		return service.save(CurrentUser.id(jwt), parsed);
	}
}
