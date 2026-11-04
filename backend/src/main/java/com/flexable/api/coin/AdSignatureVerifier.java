package com.flexable.api.coin;

/** AdMob 보상형 광고 서버 검증(SSV) 콜백의 서명을 확인한다. 테스트에서는 가짜 구현으로 바꾼다. */
public interface AdSignatureVerifier {

	/** queryString: 구글이 보낸 원본 쿼리(디코딩 전). 서명이 올바르면 true */
	boolean verify(String queryString);
}
