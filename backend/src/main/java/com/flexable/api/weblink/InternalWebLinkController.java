package com.flexable.api.weblink;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.weblink.WebLinkDtos.AppProfile;
import com.flexable.api.weblink.WebLinkDtos.LinkCreated;
import com.flexable.api.weblink.WebLinkDtos.LinkRequest;

import jakarta.validation.Valid;

/** 웹 서버 전용. 서비스 키는 SecurityConfig의 internal 체인(ServiceKeyFilter)이 검사한다. */
@RestController
@RequestMapping("/internal/v1/web-links")
public class InternalWebLinkController {

	private final WebLinkService service;

	public InternalWebLinkController(WebLinkService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	LinkCreated link(@Valid @RequestBody LinkRequest req) {
		return service.link(req.code());
	}

	@GetMapping("/{linkId}/profile")
	AppProfile profile(@PathVariable String linkId) {
		return service.profile(linkId);
	}

	@DeleteMapping("/{linkId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void unlink(@PathVariable String linkId) {
		service.unlink(linkId);
	}
}
