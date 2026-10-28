package com.flexable.api.coin;

/** 코인 내역 사유. ref_key로 같은 지급을 한 번만 한다(괄호 안이 ref_key). */
public enum CoinReason {
	/** 가입 선물(once). 1.4.0 전에 가입한 사용자도 첫 check-in에 받으므로 모달 문구는 '업데이트 기념'이다(docs/coin-plan.md) */
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
	PURCHASE,
	/** 산 코스튬이 레벨 코스튬으로 바뀌어 돌려준 코인(코스튬 id). V10에서만 생긴다 */
	REFUND,
	/** 홈 출석 달력에서 출석함(그 날짜). 연속 7일째마다 금액이 커진다 */
	ATTENDANCE
}
