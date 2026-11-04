package com.flexable.api.coin;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** 구글 키로 서명한 쿼리만 통과하고, 값을 바꾸면 거절한다. */
class GoogleAdSignatureVerifierTest {

	@Test
	void acceptsGoogleSignedQueryAndRejectsTampering() throws Exception {
		KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
		gen.initialize(new ECGenParameterSpec("secp256r1"));
		KeyPair pair = gen.generateKeyPair();

		RestClient.Builder builder = RestClient.builder();
		MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
		String keys = "{\"keys\":[{\"keyId\":777,\"base64\":\""
				+ Base64.getEncoder().encodeToString(pair.getPublic().getEncoded()) + "\"}]}";
		server.expect(requestTo(GoogleAdSignatureVerifier.KEYS_URL))
			.andRespond(withSuccess(keys, MediaType.APPLICATION_JSON));
		GoogleAdSignatureVerifier verifier = new GoogleAdSignatureVerifier(builder.build());

		String message = "ad_network=1&ad_unit=2&reward_amount=1&reward_item=coin&timestamp=3&transaction_id=abc&user_id=9";
		Signature s = Signature.getInstance("SHA256withECDSA");
		s.initSign(pair.getPrivate());
		s.update(message.getBytes(StandardCharsets.UTF_8));
		String sig = Base64.getUrlEncoder().withoutPadding().encodeToString(s.sign());
		String query = message + "&signature=" + sig + "&key_id=777";

		assertThat(verifier.verify(query)).isTrue();
		assertThat(verifier.verify(query.replace("user_id=9", "user_id=10"))).isFalse();
		assertThat(verifier.verify(message + "&signature=" + sig + "&key_id=1")).isFalse();
		assertThat(verifier.verify(message)).isFalse();
	}
}
