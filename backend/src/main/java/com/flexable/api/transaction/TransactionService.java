package com.flexable.api.transaction;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryDtos.CategoryRef;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.category.CategoryService;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.DateRange;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.TxType;
import com.flexable.api.config.AppProperties;
import com.flexable.api.transaction.TransactionDtos.CreateRequest;
import com.flexable.api.transaction.TransactionDtos.TransactionResponse;
import com.flexable.api.transaction.TransactionDtos.UpdateRequest;

@Service
public class TransactionService {

	private final TransactionRepository transactions;
	private final CategoryRepository categoryRepository;
	private final CategoryService categories;
	private final TransactionTemplate tx;
	private final Clock clock;
	private final ZoneId zone;

	public TransactionService(TransactionRepository transactions, CategoryRepository categoryRepository,
			CategoryService categories, PlatformTransactionManager txManager, Clock clock, AppProperties props) {
		this.transactions = transactions;
		this.categoryRepository = categoryRepository;
		this.categories = categories;
		this.tx = new TransactionTemplate(txManager);
		this.clock = clock;
		this.zone = props.zoneId();
	}

	public record Created(TransactionResponse body, boolean replayed) {
	}

	public Created create(long userId, CreateRequest req, String idempotencyKey) {
		String key = normalizeKey(idempotencyKey);
		try {
			return tx.execute(status -> createOnce(userId, req, key));
		}
		catch (DataIntegrityViolationException e) {
			// 같은 키로 동시에 들어온 요청은 unique 제약으로 하나만 저장된다. 진 쪽은 롤백된 뒤 새 트랜잭션에서 먼저 저장된 거래를 돌려준다.
			Created replayed = key == null ? null : tx.execute(status -> replay(userId, key));
			if (replayed == null) {
				throw e;
			}
			return replayed;
		}
	}

	private Created createOnce(long userId, CreateRequest req, String key) {
		if (key != null) {
			Created replayed = replay(userId, key);
			if (replayed != null) {
				return replayed;
			}
		}
		Category category = categories.requireForType(userId, req.categoryId(), req.type());
		Instant now = clock.instant();
		Instant occurredAt = req.occurredAt() == null ? now : req.occurredAt().toInstant();
		Transaction saved = transactions.save(new Transaction(userId, category.getId(), req.type(), req.amount(),
				cleanTitle(req.title()), cleanMemo(req.memo()), occurredAt, key, now));
		return new Created(TransactionResponse.of(saved, CategoryRef.of(category), zone), false);
	}

	private Created replay(long userId, String key) {
		return transactions.findByUserIdAndIdempotencyKey(userId, key)
			.map(t -> new Created(toResponse(t), true))
			.orElse(null);
	}

	@Transactional(readOnly = true)
	public List<TransactionResponse> list(long userId, LocalDate from, LocalDate to, TxType type, Long categoryId) {
		DateRange range = DateRange.of(from, to);
		Map<Long, Category> byId = categoryMap(userId);
		return transactions.findInRange(userId, range.startInstant(zone), range.endInstantExclusive(zone))
			.stream()
			.filter(t -> type == null || t.getType() == type)
			.filter(t -> categoryId == null || t.getCategoryId().equals(categoryId))
			.map(t -> TransactionResponse.of(t, ref(byId.get(t.getCategoryId())), zone))
			.toList();
	}

	@Transactional(readOnly = true)
	public TransactionResponse get(long userId, long id) {
		return toResponse(find(userId, id));
	}

	@Transactional
	public TransactionResponse update(long userId, long id, UpdateRequest req) {
		Transaction t = find(userId, id);
		TxType type = req.type != null ? req.type : t.getType();
		Long categoryId = req.categoryId != null ? req.categoryId : t.getCategoryId();
		if (req.type != null || req.categoryId != null) {
			// 종류만 바꾸고 카테고리를 그대로 두면 종류가 어긋나므로 함께 검사한다.
			categories.requireForType(userId, categoryId, type);
		}
		t.update(req.type, req.categoryId, req.amount, req.title == null ? null : cleanTitle(req.title),
				cleanMemo(req.memo), req.memoSet, req.occurredAt == null ? null : req.occurredAt.toInstant(),
				clock.instant());
		return toResponse(t);
	}

	@Transactional
	public void delete(long userId, long id) {
		transactions.delete(find(userId, id));
	}

	private Transaction find(long userId, long id) {
		return transactions.findByIdAndUserId(id, userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
	}

	private TransactionResponse toResponse(Transaction t) {
		Category c = categoryRepository.findById(t.getCategoryId()).orElse(null);
		return TransactionResponse.of(t, ref(c), zone);
	}

	private Map<Long, Category> categoryMap(long userId) {
		return categoryRepository.findAllOrdered(userId)
			.stream()
			.collect(Collectors.toMap(Category::getId, Function.identity()));
	}

	private static CategoryRef ref(Category c) {
		return c == null ? null : CategoryRef.of(c);
	}

	private static String cleanTitle(String title) {
		String trimmed = title.trim();
		if (trimmed.isEmpty()) {
			throw ApiException.invalid("title", "내용을 입력해 주세요");
		}
		return trimmed;
	}

	private static String cleanMemo(String memo) {
		if (memo == null) {
			return null;
		}
		String trimmed = memo.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private static String normalizeKey(String key) {
		if (key == null || key.isBlank()) {
			return null;
		}
		String trimmed = key.trim();
		if (trimmed.length() > 64) {
			throw ApiException.invalid("Idempotency-Key", "요청 키가 너무 길어요");
		}
		return trimmed;
	}
}
