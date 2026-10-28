package com.flexable.api.chat;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.chat.ChatDtos.ChatRequest;
import com.flexable.api.chat.ChatDtos.ChatResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {

	private final ChatService service;

	public ChatController(ChatService service) {
		this.service = service;
	}

	@PostMapping("/messages")
	ChatResponse send(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ChatRequest req) {
		return service.reply(CurrentUser.id(jwt), req);
	}
}
