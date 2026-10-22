package com.flexable.api.outfit;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.BudgetService;
import com.flexable.api.budget.CharacterScore;
import com.flexable.api.coin.CoinReason;
import com.flexable.api.coin.CoinService;
import com.flexable.api.coin.CoinWallet;
import com.flexable.api.coin.CoinWalletRepository;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.config.OutfitProperties;
import com.flexable.api.outfit.OutfitDtos.OutfitItem;
import com.flexable.api.outfit.OutfitDtos.OutfitList;

/**
 * 코스튬 목록·구매·적용. 레벨 코스튬은 지금까지 도달한 최고 캐릭터 단계로 열리고(코인으로 못 삼),
 * 상점 상품은 코인으로 산다. 사도 바로 적용되지 않는다.
 */
@Service
public class OutfitService {

	/** equippedOutfitId가 null일 때 적용 중으로 보는 기본 캐릭터 */
	public static final String DEFAULT_OUTFIT = "costume-lv1";

	private final OutfitRepository outfits;
	private final UserOutfitRepository userOutfits;
	private final CoinWalletRepository wallets;
	private final CoinService coins;
	private final BudgetService budget;
	private final Clock clock;
	private final boolean showInactive;

	public OutfitService(OutfitRepository outfits, UserOutfitRepository userOutfits, CoinWalletRepository wallets,
			CoinService coins, BudgetService budget, Clock clock, OutfitProperties props) {
		this.outfits = outfits;
		this.userOutfits = userOutfits;
		this.wallets = wallets;
		this.coins = coins;
		this.budget = budget;
		this.clock = clock;
		this.showInactive = props.showInactive();
	}

	@Transactional(readOnly = true)
	public OutfitList list(long userId) {
		Optional<CoinWallet> w = wallets.findById(userId);
		return toList(userId, w.map(CoinWallet::getBalance).orElse(0L), w.map(CoinWallet::getEquippedOutfitId).orElse(null));
	}

	/**
	 * 지갑 행을 잠그고 처리해 동시에 두 번 눌러도 한 번만 뺀다(두 번째는 OUTFIT_OWNED).
	 * 잠금을 가장 먼저 한다. MySQL(REPEATABLE READ)은 첫 일반 조회 때 스냅숏을 잡아서, 잠그기 전에 조회하면 앞 요청이 산 기록을 못 본다.
	 */
	@Transactional
	public OutfitList purchase(long userId, String outfitId) {
		CoinWallet w = coins.lockWallet(userId);
		Outfit o = outfits.findById(outfitId)
			.filter(x -> x.getPrice() != null && (x.isActive() || showInactive))
			.orElseThrow(() -> new ApiException(ErrorCode.OUTFIT_NOT_FOR_SALE));
		if (userOutfits.existsByUserIdAndOutfitId(userId, o.getId())) {
			throw new ApiException(ErrorCode.OUTFIT_OWNED);
		}
		if (w.getBalance() < o.getPrice()) {
			throw new ApiException(ErrorCode.COINS_NOT_ENOUGH);
		}
		if (!coins.post(w, CoinReason.PURCHASE, o.getId(), -o.getPrice(), true)) {
			throw new ApiException(ErrorCode.OUTFIT_OWNED);
		}
		userOutfits.save(new UserOutfit(userId, o.getId(), clock.instant()));
		return toList(userId, w.getBalance(), w.getEquippedOutfitId());
	}

	@Transactional
	public OutfitList equip(long userId, String outfitId) {
		CoinWallet w = coins.lockWallet(userId);
		if (outfitId != null) {
			Outfit o = outfits.findById(outfitId).orElseThrow(() -> new ApiException(ErrorCode.OUTFIT_LOCKED));
			boolean owned = o.getUnlockLevel() != null && o.getUnlockLevel() <= peakLevel(userId)
					|| userOutfits.existsByUserIdAndOutfitId(userId, o.getId());
			if (!owned) {
				throw new ApiException(ErrorCode.OUTFIT_LOCKED);
			}
		}
		w.equip(outfitId);
		return toList(userId, w.getBalance(), outfitId);
	}

	/** 지금까지 도달한 최고 캐릭터 단계. 초기 예산 설정 전(하루 예산 기록 없음)이면 1. */
	private int peakLevel(long userId) {
		return CharacterScore.level(budget.characterScore(userId).peak());
	}

	private OutfitList toList(long userId, long balance, String equippedId) {
		int peakLevel = peakLevel(userId);
		Set<String> bought = userOutfits.findByUserId(userId)
			.stream()
			.map(UserOutfit::getOutfitId)
			.collect(Collectors.toSet());
		String equipped = equippedId == null ? DEFAULT_OUTFIT : equippedId;
		List<OutfitItem> items = outfits.findOrdered()
			.stream()
			.filter(o -> o.isActive() || showInactive || bought.contains(o.getId()))
			.map(o -> new OutfitItem(o.getId(), o.getName(), o.getPrice(), o.getUnlockLevel(),
					o.getUnlockLevel() != null && o.getUnlockLevel() <= peakLevel || bought.contains(o.getId()),
					o.getId().equals(equipped)))
			.toList();
		return new OutfitList(balance, equippedId, peakLevel, items);
	}
}
