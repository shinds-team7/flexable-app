package com.flexable.api.analysis;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.flexable.api.auth.CurrentUser;
import com.flexable.api.budget.FixedExpensePoster;
import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.common.DateRange;
import com.flexable.api.common.TxType;
import com.flexable.api.config.AppProperties;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;

@RestController
@RequestMapping("/api/v1/analysis")
public class AnalysisController {

	public record CategoryShare(Long categoryId, String name, String color, String icon, long amount, int count,
			double ratio) {
	}

	public record DailyTotal(LocalDate date, long expense, long income) {
	}

	public record SummaryResponse(LocalDate from, LocalDate to, long expenseTotal, long incomeTotal, int expenseCount,
			List<CategoryShare> byCategory, List<DailyTotal> daily) {
	}

	private final TransactionRepository transactions;
	private final CategoryRepository categories;
	private final FixedExpensePoster fixedPoster;
	private final ZoneId zone;

	public AnalysisController(TransactionRepository transactions, CategoryRepository categories,
			FixedExpensePoster fixedPoster, AppProperties props) {
		this.transactions = transactions;
		this.categories = categories;
		this.fixedPoster = fixedPoster;
		this.zone = props.zoneId();
	}

	// 고정지출 자동 기록을 먼저 커밋해야 조회에 보이므로 메서드 전체를 트랜잭션으로 묶지 않는다.
	@GetMapping("/summary")
	public SummaryResponse summary(@AuthenticationPrincipal Jwt jwt,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
		long userId = CurrentUser.id(jwt);
		fixedPoster.postDue(userId);
		DateRange range = DateRange.of(from, to);
		List<Transaction> txs = transactions.findInRange(userId, range.startInstant(zone),
				range.endInstantExclusive(zone));
		Map<Long, Category> byId = categories.findAllOrdered(userId)
			.stream()
			.collect(Collectors.toMap(Category::getId, Function.identity()));

		Map<LocalDate, long[]> daily = new LinkedHashMap<>();
		for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
			daily.put(d, new long[2]);
		}
		Map<Long, long[]> perCategory = new LinkedHashMap<>();
		long expenseTotal = 0;
		long incomeTotal = 0;
		int expenseCount = 0;
		for (Transaction t : txs) {
			long[] day = daily.get(t.getOccurredAt().atZone(zone).toLocalDate());
			if (t.getType() == TxType.EXPENSE) {
				expenseTotal += t.getAmount();
				expenseCount++;
				long[] c = perCategory.computeIfAbsent(t.getCategoryId(), k -> new long[2]);
				c[0] += t.getAmount();
				c[1]++;
				if (day != null) {
					day[0] += t.getAmount();
				}
			}
			else {
				incomeTotal += t.getAmount();
				if (day != null) {
					day[1] += t.getAmount();
				}
			}
		}

		List<CategoryShare> shares = new ArrayList<>();
		for (Map.Entry<Long, long[]> e : perCategory.entrySet()) {
			Category c = byId.get(e.getKey());
			double ratio = expenseTotal == 0 ? 0
					: BigDecimal.valueOf(e.getValue()[0])
						.divide(BigDecimal.valueOf(expenseTotal), 3, RoundingMode.HALF_UP)
						.doubleValue();
			shares.add(new CategoryShare(e.getKey(), c == null ? "기타" : c.getName(),
					c == null ? "#98A2B3" : c.getColor(), c == null ? "pricetag" : c.getIcon(), e.getValue()[0],
					(int) e.getValue()[1], ratio));
		}
		shares.sort(Comparator.comparingLong(CategoryShare::amount).reversed());

		List<DailyTotal> dailyList = daily.entrySet()
			.stream()
			.map(e -> new DailyTotal(e.getKey(), e.getValue()[0], e.getValue()[1]))
			.toList();
		return new SummaryResponse(from, to, expenseTotal, incomeTotal, expenseCount, shares, dailyList);
	}
}
