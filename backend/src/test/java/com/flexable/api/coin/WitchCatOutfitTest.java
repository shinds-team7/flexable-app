package com.flexable.api.coin;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

/** 운영처럼 비활성 상품을 숨긴 상태에서 마이그레이션부터 구매·적용까지 확인한다. */
@SpringBootTest(properties = "app.outfits.show-inactive=false")
@AutoConfigureMockMvc
class WitchCatOutfitTest {

	@Autowired
	MockMvc mvc;

	@Test
	void witchCatIsForSaleFor200CoinsAndEquippedOnlyAfterPurchase() throws Exception {
		String signup = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"witch-" + UUID.randomUUID()
					+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
			.andExpect(status().isCreated())
			.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
		String bearer = "Bearer " + JsonPath.read(signup, "$.accessToken");
		mvc.perform(post("/api/v1/coins/check-in").header("Authorization", bearer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.wallet.balance").value(200));
		mvc.perform(get("/api/v1/outfits").header("Authorization", bearer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-05')].name").value(contains("고양마녀")))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-05')].price").value(contains(200)))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-05')].unlockLevel").value(contains(nullValue())))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-05')].owned").value(contains(false)));
		mvc.perform(put("/api/v1/outfits/equipped").header("Authorization", bearer)
			.contentType(MediaType.APPLICATION_JSON).content("{\"outfitId\":\"outfit-05\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("OUTFIT_LOCKED"));
		mvc.perform(post("/api/v1/outfits/outfit-05/purchase").header("Authorization", bearer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.balance").value(0))
			.andExpect(jsonPath("$.equippedOutfitId").value(nullValue()))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-05')].owned").value(contains(true)));
		mvc.perform(post("/api/v1/outfits/outfit-05/purchase").header("Authorization", bearer))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("OUTFIT_OWNED"));
		mvc.perform(put("/api/v1/outfits/equipped").header("Authorization", bearer)
			.contentType(MediaType.APPLICATION_JSON).content("{\"outfitId\":\"outfit-05\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.equippedOutfitId").value("outfit-05"))
			.andExpect(jsonPath("$.items[?(@.equipped == true)].id").value(contains("outfit-05")));
		mvc.perform(post("/api/v1/outfits/outfit-04/purchase").header("Authorization", bearer))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("COINS_NOT_ENOUGH"));
		mvc.perform(get("/api/v1/coins").header("Authorization", bearer))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.balance").value(0))
			.andExpect(jsonPath("$.equippedOutfitId").value("outfit-05"));
	}
}
