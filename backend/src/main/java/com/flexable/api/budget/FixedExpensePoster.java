package com.flexable.api.budget;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.common.TxType;
import com.flexable.api.config.AppProperties;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;

/**
 * 날짜가 된 고정지출을 지출 거래로 기록한다. 잔액 기준일부터 오늘까지의 날짜만, 날짜·항목마다 한 번만 기록하고 사용자가 그 거래를
 * 지워도 다시 만들지 않는다. 설정에서 항목 이름을 바꿔도 이미 기록한 날짜는 다시 만들지 않는다. 오늘·내역·분석을 조회할 때 먼저 호출한다.
 */
@Service
public class FixedExpensePoster {

	private static final Logger log = LoggerFactory.getLogger(FixedExpensePoster.class);

	static final String MEMO = "고정지출 자동 기록";
	/** 기록 키 앞의 날짜 "yyyy-MM-dd" 길이. 키 = 날짜 + ":" + 항목 해시 */
	private static final int KEY_DATE_LENGTH = 10;
	private static final String CATEGORY = "고정지출";
	private static final String FALLBACK = "기타";

	private final SettingsRepository settings;
	private final FixedExpenseRepository fixed;
	private final FixedExpensePostingRepository postings;
	private final TransactionRepository transactions;
	private final CategoryRepository categories;
	private final TransactionTemplate tx;
	private final Clock clock;
	private final ZoneId zone;

	public FixedExpensePoster(SettingsRepository settings, FixedExpenseRepository fixed,
			FixedExpensePostingRepository postings, TransactionRepository transactions, CategoryRepository categories,
			PlatformTransactionManager txManager, Clock clock, AppProperties props) {
		this.settings = settings;
		this.fixed = fixed;
		this.postings = postings;
		this.transactions = transactions;
		this.categories = categories;
		this.tx = new TransactionTemplate(txManager);
		this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
		this.clock = clock;
		this.zone = props.zoneId();
	}

	/** 내역·분석 조회 전에 따로 커밋한다. 실패해도 조회는 보여주고 다음 조회 때 다시 시도한다. */
	public void postDue(long userId) {
		try {
			tx.executeWithoutResult(status -> post(userId, LocalDate.now(clock.withZone(zone))));
		}
		catch (DataAccessException | TransactionException e) {
			log.warn("Fixed expense posting failed for user {}", userId, e);
		}
	}

	/**
	 * 호출한 트랜잭션 안에서 기록한다. 오늘 쓸 수 있는 돈은 기록과 계산 사이에 설정이 바뀌지 않도록 설정 행 잠금을 쥔 채 이어서 계산한다.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public void postInTransaction(long userId, LocalDate today) {
		post(userId, today);
	}

	private void post(long userId, LocalDate today) {
		// 같은 사용자의 동시 조회가 같은 날짜를 두 번 기록하지 않도록 설정 행을 잠근다.
		BudgetSettings s = settings.findForUpdate(userId).orElse(null);
		if (s == null) {
			return;
		}
		List<FixedExpense> items = fixed.findOrdered(userId);
		if (items.isEmpty()) {
			return;
		}
		Instant now = clock.instant();
		LocalDate from = s.getBalanceAt().atZone(zone).toLocalDate();
		if (s.getFixedPostingSince() != null) {
			LocalDate since = s.getFixedPostingSince().atZone(zone).toLocalDate();
			from = since.isAfter(from) ? since : from;
		}
		// 일자·이름이 같은 항목이 여럿이면 순번으로 구분한다.
		List<String> itemHashes = new ArrayList<>();
		Map<String, Integer> seen = new HashMap<>();
		for (FixedExpense f : items) {
			String item = f.getDay() + ":" + f.getName();
			itemHashes.add(hash(item + ":" + seen.merge(item, 1, Integer::sum)));
		}
		List<FixedExpensePosting> existing = postings.findFrom(userId, from.toString());
		Set<String> posted = new HashSet<>();
		existing.forEach(p -> posted.add(p.getPostingKey()));
		Map<LocalDate, Deque<FixedExpensePosting>> orphans = orphans(existing, new HashSet<>(itemHashes));
		// 이미 어떤 고정지출을 맡은 거래(자동 기록을 다른 카테고리로 옮긴 것 포함)는 다시 쓰지 않는다.
		Set<Long> taken = new HashSet<>(postings.findTransactionIds(userId));
		List<Transaction> manual = new ArrayList<>(transactions
			.findInRange(userId, from.atStartOfDay(zone).toInstant(), today.plusDays(1).atStartOfDay(zone).toInstant())
			.stream()
			.filter(t -> !t.isFromFixed() && !taken.contains(t.getId()))
			.toList());
		Long categoryId = null;
		for (int i = 0; i < items.size(); i++) {
			FixedExpense f = items.get(i);
			String itemHash = itemHashes.get(i);
			for (YearMonth ym = YearMonth.from(from); !ym.isAfter(YearMonth.from(today)); ym = ym.plusMonths(1)) {
				LocalDate d = BudgetCalculator.paydayIn(ym, f.getDay());
				String key = d + ":" + itemHash;
				if (d.isBefore(from) || d.isAfter(today) || !posted.add(key)) {
					continue;
				}
				// 이름을 바꾸는 등으로 설정에서 사라진 항목이 이 날짜를 이미 기록했으면 그 기록을 이어받고 다시 빼지 않는다.
				Deque<FixedExpensePosting> stale = orphans.get(d);
				if (stale != null && !stale.isEmpty()) {
					postings.save(new FixedExpensePosting(userId, key, stale.poll().getTransactionId(), now));
					continue;
				}
				Long manualId = takeManual(manual, d, f);
				if (manualId != null) {
					postings.save(new FixedExpensePosting(userId, key, manualId, now));
					continue;
				}
				if (categoryId == null) {
					categoryId = category(userId);
				}
				// 잔액을 입력한 날의 고정지출은 그 잔액에서 빠지도록 기준 시각 뒤로 둔다.
				Instant start = d.atStartOfDay(zone).toInstant();
				Instant occurredAt = start.isAfter(s.getBalanceAt()) ? start : s.getBalanceAt().plusMillis(1);
				Transaction created = transactions.save(Transaction.fixedExpense(userId, categoryId, f.getAmount(),
						f.getName(), MEMO, occurredAt, now));
				postings.save(new FixedExpensePosting(userId, key, created.getId(), now));
			}
		}
	}

	/**
	 * 지금 항목 어디에도 맞지 않는 기록(이름을 바꾸거나 지운 항목의 것)을 날짜별로 모은다. 그 거래를 지금 항목의 기록이 이미
	 * 맡고 있으면(앞서 이어받은 경우) 빼고, 같은 거래를 가리키는 기록은 한 번만 넣는다.
	 */
	private static Map<LocalDate, Deque<FixedExpensePosting>> orphans(List<FixedExpensePosting> existing,
			Set<String> currentHashes) {
		Set<Long> kept = new HashSet<>();
		List<FixedExpensePosting> stale = new ArrayList<>();
		for (FixedExpensePosting p : existing) {
			if (currentHashes.contains(p.getPostingKey().substring(KEY_DATE_LENGTH + 1))) {
				kept.add(p.getTransactionId());
			}
			else {
				stale.add(p);
			}
		}
		Map<LocalDate, Deque<FixedExpensePosting>> byDate = new HashMap<>();
		Set<Long> seenTx = new HashSet<>();
		for (FixedExpensePosting p : stale) {
			if (kept.contains(p.getTransactionId()) || !seenTx.add(p.getTransactionId())) {
				continue;
			}
			byDate.computeIfAbsent(LocalDate.parse(p.getPostingKey().substring(0, KEY_DATE_LENGTH)),
					k -> new ArrayDeque<>()).add(p);
		}
		return byDate;
	}

	/**
	 * 사용자가 같은 날 같은 이름·금액으로 직접 기록해 둔 지출이 있으면 중복으로 만들지 않는다. 직접 기록 한 건은 고정지출 한 건만 대신한다.
	 */
	private Long takeManual(List<Transaction> manual, LocalDate d, FixedExpense f) {
		for (Iterator<Transaction> it = manual.iterator(); it.hasNext();) {
			Transaction t = it.next();
			if (t.getType() == TxType.EXPENSE && t.getAmount() == f.getAmount() && t.getTitle().equals(f.getName())
					&& t.getOccurredAt().atZone(zone).toLocalDate().equals(d)) {
				it.remove();
				return t.getId();
			}
		}
		return null;
	}

	private static String hash(String s) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest).substring(0, 32);
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	/** 기본 "고정지출" 카테고리. 이름을 바꿨으면 같은 아이콘의 기본 카테고리, 그것도 없으면 "기타". */
	private Long category(long userId) {
		List<Category> defaults = categories.findAllOrdered(userId, TxType.EXPENSE)
			.stream()
			.filter(Category::isDefault)
			.toList();
		return defaults.stream()
			.filter(c -> c.getName().equals(CATEGORY))
			.findFirst()
			.or(() -> defaults.stream().filter(c -> c.getIcon().equals("repeat")).findFirst())
			.or(() -> defaults.stream().filter(c -> c.getName().equals(FALLBACK)).findFirst())
			.or(() -> defaults.stream().findFirst())
			.map(Category::getId)
			.orElseThrow(() -> new IllegalStateException("No default expense category for user " + userId));
	}
}
