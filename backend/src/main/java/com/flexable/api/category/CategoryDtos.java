package com.flexable.api.category;

import com.flexable.api.common.TxType;
import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class CategoryDtos {

	static final String COLOR = "^#[0-9A-Fa-f]{6}$";
	static final String ICON = "^[a-z0-9-]{1,40}$";

	private CategoryDtos() {
	}

	public record OrderRequest(@NotNull TxType type, @NotNull List<@NotNull Long> ids) { }

	public record CreateRequest(
			@NotNull(message = "카테고리 이름을 입력해 주세요") @Size(min = 1, max = 20, message = "카테고리 이름은 20자 이하로 입력해 주세요") String name,
			@NotNull(message = "지출·수입 중 하나를 골라 주세요") TxType type,
			@Pattern(regexp = COLOR, message = "색상 형식을 확인해 주세요") String color,
			@Pattern(regexp = ICON, message = "아이콘 형식을 확인해 주세요") String icon) {
	}

	public record UpdateRequest(
			@Size(min = 1, max = 20, message = "카테고리 이름은 20자 이하로 입력해 주세요") String name,
			@Pattern(regexp = COLOR, message = "색상 형식을 확인해 주세요") String color,
			@Pattern(regexp = ICON, message = "아이콘 형식을 확인해 주세요") String icon) {
	}

	public record CategoryResponse(Long id, String name, TxType type, String color, String icon, boolean isDefault) {

		public static CategoryResponse of(Category c) {
			return new CategoryResponse(c.getId(), c.getName(), c.getType(), c.getColor(), c.getIcon(), c.isDefault());
		}
	}

	/** 거래 응답 안에 넣는 요약 */
	public record CategoryRef(Long id, String name, String color, String icon) {

		public static CategoryRef of(Category c) {
			return new CategoryRef(c.getId(), c.getName(), c.getColor(), c.getIcon());
		}
	}
}
