package com.flexable.api.statement;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.BudgetSettings;
import com.flexable.api.budget.SettingsRepository;
import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryService;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.TxType;
import com.flexable.api.config.AppProperties;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;
import com.flexable.api.user.UserRepository;

/**
 * 거래내역서 PDF를 읽어 거래로 저장한다(policies §9). 검토 화면 없이 모두 저장하되
 * 이미 있는 같은 거래(종류·금액·시각·내용)와 잔액 기준 시각 이후 거래는 건너뛴다.
 */
@Service
public class StatementImportService {

	static final int TITLE_MAX = 40;
	static final int MAX_ROWS = 5000;

	public record Result(String bank, LocalDate from, LocalDate to, int imported, int duplicates, int afterBalance) {
	}

	private record Key(TxType type, long amount, Instant at, String title) {
	}

	private record Candidate(Key key, StatementRow row) {
	}

	private final StatementPdfReader reader;
	private final TransactionRepository transactions;
	private final SettingsRepository settings;
	private final CategoryService categories;
	private final UserRepository users;
	private final Clock clock;
	private final ZoneId zone;

	public StatementImportService(StatementPdfReader reader, TransactionRepository transactions,
			SettingsRepository settings, CategoryService categories, UserRepository users, Clock clock,
			AppProperties props) {
		this.reader = reader;
		this.transactions = transactions;
		this.settings = settings;
		this.categories = categories;
		this.users = users;
		this.clock = clock;
		this.zone = props.zoneId();
	}

	public ParsedStatement read(byte[] pdf, String password) {
		List<String> lines = reader.lines(pdf, password);
		try {
			ParsedStatement parsed = parseAny(lines)
				.orElseThrow(() -> new ApiException(ErrorCode.STATEMENT_UNSUPPORTED));
			if (parsed.rows().size() > MAX_ROWS) {
				throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED, "거래가 너무 많아요. 기간을 나눠서 올려 주세요");
			}
			return parsed;
		}
		catch (UnreadableStatementException e) {
			throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED);
		}
	}

	/** 지원하는 은행 형식(신한은행·KB국민은행) 중 맞는 것으로 읽는다. 어느 것도 아니면 빈 값. */
	static Optional<ParsedStatement> parseAny(List<String> lines) {
		return ShinhanStatementParser.parse(lines).or(() -> KbStatementParser.parse(lines));
	}

	/** PDF는 {@link #read}로 트랜잭션 밖에서 먼저 읽는다. */
	@Transactional
	public Result save(long userId, ParsedStatement parsed) {
		// 같은 사용자가 두 번 눌러 동시에 올려도 중복 저장하지 않게 한 사람씩 처리한다.
		users.findWithLockById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
		Instant now = clock.instant();
		Instant cutoff = settings.findById(userId).map(BudgetSettings::getBalanceAt).orElse(null);
		if (cutoff == null || cutoff.isAfter(now)) {
			cutoff = now;
		}

		List<Candidate> candidates = new ArrayList<>();
		int afterBalance = 0;
		for (StatementRow row : parsed.rows()) {
			Instant at = row.at().atZone(zone).toInstant();
			if (!at.isBefore(cutoff)) {
				afterBalance++;
				continue;
			}
			TxType type = row.withdrawal() > 0 ? TxType.EXPENSE : TxType.INCOME;
			long amount = type == TxType.EXPENSE ? row.withdrawal() : row.deposit();
			candidates.add(new Candidate(new Key(type, amount, at, title(row)), row));
		}
		if (candidates.isEmpty()) {
			return new Result(parsed.bank(), parsed.from(), parsed.to(), 0, 0, afterBalance);
		}

		Instant min = candidates.stream().map(c -> c.key().at()).min(Instant::compareTo).orElseThrow();
		Instant max = candidates.stream().map(c -> c.key().at()).max(Instant::compareTo).orElseThrow();
		Map<Key, Integer> existing = new HashMap<>();
		for (Transaction t : transactions.findInRange(userId, min, max.plusSeconds(1))) {
			// 직접 기록한 거래는 소수 초가 있을 수 있다. 거래내역서는 초까지라 초 단위로 맞춰 비교한다.
			existing.merge(new Key(t.getType(), t.getAmount(), t.getOccurredAt().truncatedTo(ChronoUnit.SECONDS),
					t.getTitle()), 1, Integer::sum);
		}

		Map<String, Category> categoryByName = new HashMap<>();
		int imported = 0;
		int duplicates = 0;
		for (Candidate c : candidates) {
			// 이미 있는 같은 거래 수만큼은 건너뛴다(같은 거래내역서를 다시 올린 경우). 내역서 안의 같은 줄은 각각 저장한다.
			Integer left = existing.get(c.key());
			if (left != null && left > 0) {
				existing.put(c.key(), left - 1);
				duplicates++;
				continue;
			}
			String name = StatementCategoryGuess.name(c.key().title(), c.key().type());
			Category category = categoryByName.computeIfAbsent(c.key().type() + ":" + name,
					k -> categories.byNameOrFallback(userId, c.key().type(), name));
			transactions.save(new Transaction(userId, category.getId(), c.key().type(), c.key().amount(),
					c.key().title(), null, c.key().at(), null, now));
			imported++;
		}
		return new Result(parsed.bank(), parsed.from(), parsed.to(), imported, duplicates, afterBalance);
	}

	/** 내용을 제목으로 쓴다. 내용이 비었거나 이자처럼 내용이 기간 표시면 적요를 쓴다. 40자에서 자른다. */
	static String title(StatementRow row) {
		String text = row.content().isBlank() || "이자".equals(row.summary()) ? row.summary() : row.content();
		text = text.trim();
		return text.length() > TITLE_MAX ? text.substring(0, TITLE_MAX) : text;
	}
}
