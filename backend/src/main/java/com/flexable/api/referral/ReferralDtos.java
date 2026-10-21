package com.flexable.api.referral;

import com.flexable.api.coin.CoinDtos.Wallet;

public final class ReferralDtos {

	private ReferralDtos() {
	}

	/** registered: 내가 다른 사람 코드를 등록했는지 */
	public record ReferralMe(String code, long invitedCount, boolean registered, int rewardAmount) {
	}

	public record RegisterRequest(String code) {
	}

	public record Registered(int amount, Wallet wallet) {
	}
}
