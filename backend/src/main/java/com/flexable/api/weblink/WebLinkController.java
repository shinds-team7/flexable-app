package com.flexable.api.weblink;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.weblink.WebLinkDtos.LinkCodeResponse;
import com.flexable.api.weblink.WebLinkDtos.LinkItem;

/** 앱 사용자가 웹 연동 코드를 받고, 연동 목록을 보고 해제하는 API. */
@RestController
@RequestMapping("/api/v1/me")
public class WebLinkController {

	private final WebLinkService service;

	public WebLinkController(WebLinkService service) {
		this.service = service;
	}

	@PostMapping("/web-link-codes")
	@ResponseStatus(HttpStatus.CREATED)
	LinkCodeResponse issueCode(@AuthenticationPrincipal Jwt jwt) {
		return service.issueCode(CurrentUser.id(jwt));
	}

	@GetMapping("/web-links")
	List<LinkItem> list(@AuthenticationPrincipal Jwt jwt) {
		return service.list(CurrentUser.id(jwt));
	}

	@DeleteMapping("/web-links/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void unlink(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
		service.unlinkByUser(CurrentUser.id(jwt), id);
	}
}
