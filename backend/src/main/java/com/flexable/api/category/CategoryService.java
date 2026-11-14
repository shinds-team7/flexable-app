package com.flexable.api.category;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.HashSet;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.category.CategoryDtos.CategoryResponse;
import com.flexable.api.category.CategoryDtos.CreateRequest;
import com.flexable.api.category.CategoryDtos.UpdateRequest;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.TxType;
import com.flexable.api.transaction.TransactionRepository;
import com.flexable.api.scheduled.ScheduledExpenseRepository;
import com.flexable.api.category.CategoryDtos.OrderRequest;

@Service
public class CategoryService {

	static final String DEFAULT_COLOR = "#98A2B3";
	static final String DEFAULT_ICON = "pricetag";
	static final String EXPENSE_FALLBACK = CategoryGuess.EXPENSE_FALLBACK;
	static final String INCOME_FALLBACK = CategoryGuess.INCOME_FALLBACK;

	private record Preset(String name, TxType type, String color, String icon) {
	}

	/**
	 * 가입 시 만드는 기본 카테고리. 순서가 화면 표시 순서다(2026-11-14 지출 12개·수입 6개, policies §10).
	 * 이름은 CategoryGuess 키워드 표의 카테고리 이름과 같아야 한다. 기존 사용자는 V30이 같은 목록으로 맞춘다.
	 */
	private static final List<Preset> DEFAULTS = List.of(
			new Preset("식비", TxType.EXPENSE, "#12B76A", "restaurant"),
			new Preset("카페", TxType.EXPENSE, "#F79009", "cafe"),
			new Preset("생활", TxType.EXPENSE, "#15B79E", "cart"),
			new Preset("교통", TxType.EXPENSE, "#2E90FA", "bus"),
			new Preset("주거", TxType.EXPENSE, "#6172F3", "home"),
			new Preset("통신", TxType.EXPENSE, "#0BA5EC", "phone-portrait"),
			new Preset("쇼핑", TxType.EXPENSE, "#7A5AF8", "bag-handle"),
			new Preset("여가", TxType.EXPENSE, "#EE46BC", "film"),
			new Preset("건강", TxType.EXPENSE, "#F04438", "medkit"),
			new Preset("교육", TxType.EXPENSE, "#444CE7", "school"),
			new Preset("구독", TxType.EXPENSE, "#DD2590", "play-circle"),
			new Preset(EXPENSE_FALLBACK, TxType.EXPENSE, DEFAULT_COLOR, "ellipsis-horizontal"),
			new Preset("급여", TxType.INCOME, "#2E90FA", "cash"),
			new Preset("용돈", TxType.INCOME, "#12B76A", "gift"),
			new Preset("금융수입", TxType.INCOME, "#F79009", "trending-up"),
			new Preset("환급", TxType.INCOME, "#15B79E", "receipt"),
			new Preset("지원금", TxType.INCOME, "#7A5AF8", "ribbon"),
			new Preset(INCOME_FALLBACK, TxType.INCOME, DEFAULT_COLOR, "add-circle"));

	private final CategoryRepository categories;
	private final TransactionRepository transactions;
	private final Clock clock;
	private final ScheduledExpenseRepository scheduled;

	public CategoryService(CategoryRepository categories, TransactionRepository transactions, Clock clock, ScheduledExpenseRepository scheduled) {
		this.categories = categories;
		this.transactions = transactions;
		this.clock = clock;
		this.scheduled = scheduled;
	}

	@Transactional
	public void createDefaults(long userId) {
		Instant now = clock.instant();
		for (int i=0; i<DEFAULTS.size(); i++) {
			Preset p=DEFAULTS.get(i);
			Category c=new Category(userId,p.name(),p.type(),p.color(),p.icon(),true,now);
			c.reorder(i);
			categories.save(c);
		}
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
		Category created = new Category(userId, name, req.type(),
				req.color() == null ? DEFAULT_COLOR : req.color().toUpperCase(),
				req.icon() == null ? DEFAULT_ICON : req.icon(), false, clock.instant());
		created.reorder(categories.findAllOrdered(userId,req.type()).stream().mapToLong(Category::getSortOrder).max().orElse(-1)+1);
		Category saved=categories.save(created);
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
		if (!transactions.existsByUserIdAndCategoryId(userId,id) && !scheduled.existsByUserIdAndCategoryId(userId,id)) {
			categories.delete(c);
			return;
		}
		String fallbackName = c.getType() == TxType.EXPENSE ? EXPENSE_FALLBACK : INCOME_FALLBACK;
		List<Category> remaining=categories.findAllOrdered(userId,c.getType()).stream().filter(x->!x.getId().equals(id)).toList();
		Category fallback=remaining.stream().filter(x->x.getName().equals(fallbackName)).findFirst()
			.orElse(remaining.isEmpty()?null:remaining.get(0));
		if (fallback==null) {
			// 마지막 '기타' 자체를 지울 때도 이름 유니크 제약을 지키면서 새 ID로 기록을 옮긴다.
			c.rename("_"+id);
			categories.flush();
			fallback=categories.save(new Category(userId,fallbackName,c.getType(),DEFAULT_COLOR,DEFAULT_ICON,false,clock.instant()));
		}
		transactions.moveCategory(userId, c.getId(), fallback.getId());
		scheduled.moveCategory(userId,c.getId(),fallback.getId());
		categories.delete(c);
	}

	@Transactional
	public List<CategoryResponse> reorder(long userId, OrderRequest req) {
		List<Category> current=categories.findAllOrdered(userId,req.type());
		var expected=new HashSet<>(current.stream().map(Category::getId).toList());
		if (req.ids().size()!=current.size() || new HashSet<>(req.ids()).size()!=req.ids().size() || !expected.equals(new HashSet<>(req.ids())))
			throw ApiException.invalid("ids","현재 카테고리 전체를 중복 없이 보내 주세요. 목록을 새로고침해 주세요");
		var byId=current.stream().collect(java.util.stream.Collectors.toMap(Category::getId,x->x));
		for (int i=0;i<req.ids().size();i++) byId.get(req.ids().get(i)).reorder(i);
		return req.ids().stream().map(id->CategoryResponse.of(byId.get(id))).toList();
	}

	/**
	 * 이름이 같은 내 카테고리, 없으면 '기타'·'기타 수입', 그것도 없으면 그 종류의 첫 카테고리.
	 * 그 종류를 모두 지웠으면 '기타'·'기타 수입'을 새로 만든다(거래내역서 가져오기).
	 */
	@Transactional
	public Category byNameOrFallback(long userId, TxType type, String name) {
		List<Category> list = categories.findAllOrdered(userId, type);
		String fallbackName = type == TxType.EXPENSE ? EXPENSE_FALLBACK : INCOME_FALLBACK;
		return list.stream()
			.filter(c -> c.getName().equals(name))
			.findFirst()
			.or(() -> list.stream().filter(c -> c.getName().equals(fallbackName)).findFirst())
			.or(() -> list.stream().findFirst())
			.orElseGet(() -> {
				Category created = new Category(userId, fallbackName, type, DEFAULT_COLOR, DEFAULT_ICON, false,
						clock.instant());
				created.reorder(0);
				return categories.save(created);
			});
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
