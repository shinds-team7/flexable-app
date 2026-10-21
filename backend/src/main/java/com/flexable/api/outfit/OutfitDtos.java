package com.flexable.api.outfit;

import java.util.List;

public final class OutfitDtos {

	private OutfitDtos() {
	}

	/** 레벨 코스튬은 price가 null, 상점 상품은 unlockLevel이 null */
	public record OutfitItem(String id, String name, Integer price, Integer unlockLevel, boolean owned,
			boolean equipped) {
	}

	/** equippedOutfitId가 null이면 기본 캐릭터(costume-lv1). peakLevel은 지금까지 도달한 최고 캐릭터 단계(1~5). */
	public record OutfitList(long balance, String equippedOutfitId, int peakLevel, List<OutfitItem> items) {
	}

	/** outfitId가 null이면 기본 캐릭터 */
	public record EquipRequest(String outfitId) {
	}
}
