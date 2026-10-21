package com.flexable.api.coin;

/** 코인 내역 사유. ref_key로 같은 지급을 한 번만 한다(괄호 안이 ref_key). */
public enum CoinReason {
	/** 업데이트 기념 선물(once) */
	SIGNUP_GIFT,
	/** 어제 예산을 지킴(그 날짜) */
	BUDGET_BONUS,
	/** 시간 적립을 모으기로 받음(날짜#받은 뒤 그날 누적 개수) */
	PASSIVE,
	/** 내가 친구 코드를 등록함(once) */
	REFERRAL_INVITEE,
	/** 친구가 내 코드를 등록함(초대받은 사람 id) */
	REFERRAL_INVITER,
	/** 코스튬 구매, 금액은 음수(코스튬 id) */
	PURCHASE
}
