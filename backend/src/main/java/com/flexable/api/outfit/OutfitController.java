package com.flexable.api.outfit;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.outfit.OutfitDtos.EquipRequest;
import com.flexable.api.outfit.OutfitDtos.OutfitList;

@RestController
@RequestMapping("/api/v1/outfits")
public class OutfitController {

	private final OutfitService service;

	public OutfitController(OutfitService service) {
		this.service = service;
	}

	@GetMapping
	OutfitList list(@AuthenticationPrincipal Jwt jwt) {
		return service.list(CurrentUser.id(jwt));
	}

	@PostMapping("/{id}/purchase")
	OutfitList purchase(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
		return service.purchase(CurrentUser.id(jwt), id);
	}

	@PutMapping("/equipped")
	OutfitList equip(@AuthenticationPrincipal Jwt jwt, @RequestBody EquipRequest req) {
		return service.equip(CurrentUser.id(jwt), req.outfitId());
	}
}
