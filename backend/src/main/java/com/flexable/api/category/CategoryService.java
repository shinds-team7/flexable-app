package com.flexable.api.category;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.category.CategoryDtos.CategoryResponse;
import com.flexable.api.category.CategoryDtos.CreateRequest;
import com.flexable.api.category.CategoryDtos.UpdateRequest;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.TxType;
import com.flexable.api.transaction.TransactionRepository;

@Service
public class CategoryService {

	static final String DEFAULT_COLOR = "#98A2B3";
	static final String DEFAULT_ICON = "pricetag";
	static final String EXPENSE_FALLBACK = "기타";
	static final String INCOME_FALLBACK = "기타 수입";

	private record Preset(String name, TxType type, String color, String icon) {
	}

	/** 가입 시 만드는 기본 카테고리. 순서가 화면 표시 순서다. */
	private static final List<Preset> DEFAULTS = List.of(
			new Preset("식비", TxType.EXPENSE, "#12B76A", "restaurant"),
			new Preset("카페·간식", TxType.EXPENSE, "#F79009", "cafe"),
			new Preset("쇼핑", TxType.EXPENSE, "#7A5AF8", "bag-handle"),
			new Preset("교통", TxType.EXPENSE, "#2E90FA", "bus"),
			new Preset("문화·여가", TxType.EXPENSE, "#EE46BC", "film"),
			new Preset("생활·마트", TxType.EXPENSE, "#15B79E", "cart"),
			new Preset("고정지출", TxType.EXPENSE, "#667085", "repeat"),
			new Preset(EXPENSE_FALLBACK, TxType.EXPENSE, DEFAULT_COLOR, "ellipsis-horizontal"),
			new Preset("급여", TxType.INCOME, "#2E90FA", "cash"),
			new Preset("용돈", TxType.INCOME, "#12B76A", "gift"),
			new Preset(INCOME_FALLBACK, TxType.INCOME, DEFAULT_COLOR, "add-circle"));

	private final CategoryRepository categories;
	private final TransactionRepository transactions;
	private final Clock clock;

	public CategoryService(CategoryRepository categories, TransactionRepository transactions, Clock clock) {
		this.categories = categories;
		this.transactions = transactions;
		this.clock = clock;
	}

	@Transactional
	public void createDefaults(long userId) {
		Instant now = clock.instant();
		categories.saveAll(DEFAULTS.stream()
			.map(p -> new Category(userId, p.name(), p.type(), p.color(), p.icon(), true, now))
			.toList());
	}

	@Transactional(readOnly = true)
	public List<CategoryResponse> list(long userId, TxType type) {
		List<Category> found = type == null ? categories.findAllOrdered(userId) : categories.findAllOrdered(userId, type);
		return found.stream().map(CategoryResponse::of).toList();
	}

	@Transactional
	public CategoryResponse create(long userId, CreateRequest req) {
		String name = clean(req.name());
		if (categories.existsByUserIdAndTypeAndName(userId, req.type(), name)) {
			throw new ApiException(ErrorCode.CATEGORY_DUPLICATE);
		}
		Category saved = categories.save(new Category(userId, name, req.type(),
				req.color() == null ? DEFAULT_COLOR : req.color().toUpperCase(),
				req.icon() == null ? DEFAULT_ICON : req.icon(), false, clock.instant()));
		return CategoryResponse.of(saved);
	}

	@Transactional
	public CategoryResponse update(long userId, long id, UpdateRequest req) {
		Category c = get(userId, id);
		if (req.name() != null) {
			String name = clean(req.name());
			if (!name.equals(c.getName()) && categories.existsByUserIdAndTypeAndName(userId, c.getType(), name)) {
				throw new ApiException(ErrorCode.CATEGORY_DUPLICATE);
			}
			c.rename(name);
		}
		c.restyle(req.color() == null ? null : req.color().toUpperCase(), req.icon());
		return CategoryResponse.of(c);
	}

	@Transactional
	public void delete(long userId, long id) {
		Category c = get(userId, id);
		if (c.isDefault()) {
			throw new ApiException(ErrorCode.CATEGORY_DEFAULT);
		}
		String fallbackName = c.getType() == TxType.EXPENSE ? EXPENSE_FALLBACK : INCOME_FALLBACK;
		Category fallback = categories.findByUserIdAndTypeAndNameAndIsDefaultTrue(userId, c.getType(), fallbackName)
			.or(() -> categories.findAllOrdered(userId, c.getType()).stream().filter(Category::isDefault).findFirst())
			.orElseThrow(() -> new IllegalStateException("No default category for user " + userId));
		transactions.moveCategory(userId, c.getId(), fallback.getId());
		categories.delete(c);
	}

	/** 본인 소유이고 종류가 맞는 카테고리인지 확인한다. */
	@Transactional(readOnly = true)
	public Category requireForType(long userId, long id, TxType type) {
		Category c = categories.findByIdAndUserId(id, userId)
			.orElseThrow(() -> ApiException.invalid("categoryId", "카테고리를 다시 골라 주세요"));
		if (c.getType() != type) {
			throw ApiException.invalid("categoryId", "지출·수입에 맞는 카테고리를 골라 주세요");
		}
		return c;
	}

	private Category get(long userId, long id) {
		return categories.findByIdAndUserId(id, userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
	}

	private static String clean(String name) {
		String trimmed = name.trim();
		if (trimmed.isEmpty()) {
			throw ApiException.invalid("name", "카테고리 이름을 입력해 주세요");
		}
		return trimmed;
	}
}
