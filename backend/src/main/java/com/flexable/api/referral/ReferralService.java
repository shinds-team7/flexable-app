package com.flexable.api.referral;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.coin.CoinReason;
import com.flexable.api.coin.CoinService;
import com.flexable.api.coin.CoinWallet;
import com.flexable.api.coin.CoinWalletRepository;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.referral.ReferralDtos.ReferralMe;
import com.flexable.api.referral.ReferralDtos.Registered;

/**
 * 추천 코드. 코드를 등록한 사람과 코드 주인에게 각각 100코인. 한 사람은 한 번만, 자기 코드는 안 된다. 기간·인원 제한 없음.
 * 코드 주인 보상은 다음 check-in에서 모달로, 등록한 사람 보상은 응답으로 바로 보여 준다.
 */
@Service
public class ReferralService {

	public static final int REWARD = 100;
	static final int CODE_LENGTH = 8;
	/** 헷갈리는 글자(숫자 0·1, 영문 I·L·O)를 뺀 31자 */
	static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

	private final SecureRandom random = new SecureRandom();
	private final ReferralRepository referrals;
	private final CoinWalletRepository wallets;
	private final CoinService coins;
	private final Clock clock;

	public ReferralService(ReferralRepository referrals, CoinWalletRepository wallets, CoinService coins, Clock clock) {
		this.referrals = referrals;
		this.wallets = wallets;
		this.coins = coins;
		this.clock = clock;
	}

	/** 내 코드는 처음 부를 때 만든다. */
	@Transactional
	public ReferralMe me(long userId) {
		CoinWallet w = coins.lockWallet(userId);
		if (w.getReferralCode() == null) {
			String code;
			do {
				code = newCode();
			} while (wallets.existsByReferralCode(code));
			w.assignReferralCode(code);
		}
		return new ReferralMe(w.getReferralCode(), referrals.countByInviterId(userId), referrals.existsById(userId),
				REWARD);
	}

	@Transactional
	public Registered register(long userId, String rawCode) {
		// 내 지갑을 먼저 잠근다(같은 사람이 두 번 눌러도 하나씩, 뒤 요청은 앞 요청의 등록을 본다).
		CoinWallet me = coins.lockWallet(userId);
		String code = rawCode == null ? "" : rawCode.trim().toUpperCase(Locale.ROOT);
		long inviterId = code.isEmpty() ? userId : wallets.findUserIdByReferralCode(code).orElse(userId);
		if (inviterId == userId) {
			throw new ApiException(ErrorCode.REFERRAL_CODE_INVALID);
		}
		if (referrals.existsById(userId)) {
			throw new ApiException(ErrorCode.REFERRAL_ALREADY);
		}
		CoinWallet inviter = coins.lockWallet(inviterId);
		referrals.save(new Referral(userId, inviterId, clock.instant()));
		coins.post(me, CoinReason.REFERRAL_INVITEE, CoinService.ONCE, REWARD, true);
		coins.post(inviter, CoinReason.REFERRAL_INVITER, String.valueOf(userId), REWARD, false);
		return new Registered(REWARD, coins.view(me));
	}

	private String newCode() {
		StringBuilder code = new StringBuilder(CODE_LENGTH);
		for (int i = 0; i < CODE_LENGTH; i++) {
			code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
		}
		return code.toString();
	}
}
