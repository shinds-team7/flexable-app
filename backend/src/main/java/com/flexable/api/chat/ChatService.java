package com.flexable.api.chat;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.flexable.api.budget.BudgetDtos.DayWeightsResponse;
import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.budget.BudgetService;
import com.flexable.api.budget.DayWeights.Preset;
import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.chat.ChatDtos.ActionType;
import com.flexable.api.chat.ChatDtos.ChatAction;
import com.flexable.api.chat.ChatDtos.ChatRequest;
import com.flexable.api.chat.ChatDtos.ChatResponse;
import com.flexable.api.chat.ChatDtos.Role;
import com.flexable.api.chat.ChatPrompt.CategoryTotal;
import com.flexable.api.chat.ChatPrompt.Spending;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.DateRange;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.TxType;
import com.flexable.api.config.AppProperties;
import com.flexable.api.config.ChatProperties;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;

/**
 * AI 메이트 답변. 대화는 저장하지 않는다. 요일별 배분 변경은 제안(action)만 돌려주고 저장은 앱이 확인 뒤
 * PUT /budget/day-weights로 한다. 트랜잭션으로 묶지 않는다(모델 호출 동안 DB 연결을 잡지 않게).
 */
@Service
public class ChatService {

	private static final Logger log = LoggerFactory.getLogger(ChatService.class);
	private static final List<Preset> PROPOSABLE = List.of(Preset.EVEN, Preset.RECORD, Preset.WEEKEND, Preset.WEEKDAY);
	private static final int MAX_CATEGORIES = 8;

	private final ChatModel model;
	private final ChatProperties props;
	private final ChatRateLimiter limiter;
	private final BudgetService budget;
	private final TransactionRepository transactions;
	private final CategoryRepository categories;
	private final Clock clock;
	private final ZoneId zone;

	public ChatService(ChatModel model, ChatProperties props, ChatRateLimiter limiter, BudgetService budget,
			TransactionRepository transactions, CategoryRepository categories, Clock clock, AppProperties app) {
		this.model = model;
		this.props = props;
		this.limiter = limiter;
		this.budget = budget;
		this.transactions = transactions;
		this.categories = categories;
		this.clock = clock;
		this.zone = app.zoneId();
	}

	public ChatResponse reply(long userId, ChatRequest req) {
		if (!props.enabled()) {
			throw new ApiException(ErrorCode.CHAT_UNAVAILABLE);
		}
		if (req.messages().get(req.messages().size() - 1).role() != Role.USER) {
			throw ApiException.invalid("messages", "마지막 메시지는 내가 보낸 메시지여야 해요");
		}
		limiter.acquire(userId);

		ChatPrompt.Context context = context(userId);
		ChatModel.Reply r;
		try {
			r = model.generate(ChatPrompt.system(req.mate(), context), req.messages(),
					context.proposable().stream().map(Preset::name).toList());
		}
		catch (ChatModel.Failure e) {
			log.warn("AI 메이트 응답 실패: {}", e.getMessage());
			throw new ApiException(ErrorCode.CHAT_FAILED);
		}

		String proposed = r.proposedPreset() != null ? r.proposedPreset() : mentioned(r.text(), context.proposable());
		ChatAction action = context.proposable()
			.stream()
			.filter(p -> p.name().equals(proposed))
			.findFirst()
			.map(p -> new ChatAction(ActionType.DAY_PRESET, p, ChatPrompt.label(p)))
			.orElse(null);
		String reply = r.text();
		if (action != null) {
			String ask = "요일별 배분을 **" + action.label() + "**" + ChatPrompt.ro(action.label())
					+ " 바꿀까요?\n확인을 누르면 오늘 하루 예산부터 바뀌어요.";
			reply = reply.isEmpty() ? ask : reply + "\n\n" + ask;
		}
		if (reply.isEmpty()) {
			// 쓸 수 없는 프리셋만 제안하고 말은 없던 경우
			log.warn("AI 메이트가 쓸 수 없는 배분만 제안함");
			throw new ApiException(ErrorCode.CHAT_FAILED);
		}
		return new ChatResponse(reply, action);
	}

	/**
	 * 모델이 도구를 부르지 않고 말로만 배분을 권한 경우(가벼운 모델에서 자주 생긴다). 바꿀 수 있는 배분 이름이 답에
	 * 딱 하나만 나오면 그것을 제안으로 본다. 저장은 여전히 사용자가 확인해야 한다.
	 */
	static String mentioned(String text, List<Preset> proposable) {
		List<Preset> found = proposable.stream().filter(p -> text.contains(ChatPrompt.label(p))).toList();
		return found.size() == 1 ? found.get(0).name() : null;
	}

	private ChatPrompt.Context context(long userId) {
		LocalDate today = LocalDate.now(clock.withZone(zone));
		TodayResponse t;
		try {
			// 홈과 같은 계산(날짜가 된 고정지출 자동 기록 포함). 예산이 없어도 대화는 한다.
			t = budget.today(userId);
		}
		catch (ApiException e) {
			if (e.code() != ErrorCode.BUDGET_NOT_SET) {
				throw e;
			}
			t = null;
		}

		Preset preset = null;
		boolean recordReady = false;
		List<Preset> proposable = List.of();
		if (t != null) {
			DayWeightsResponse w = budget.dayWeights(userId);
			preset = w.preset();
			recordReady = w.presets().stream().anyMatch(p -> p.id() == Preset.RECORD && p.weights() != null);
			Preset current = preset;
			boolean ready = recordReady;
			proposable = PROPOSABLE.stream().filter(p -> p != current && (p != Preset.RECORD || ready)).toList();
		}

		// 이번 기간은 수입 주기 시작(예산이 없으면 이번 달 1일)부터 오늘까지, 직전 기간은 그 바로 앞 같은 일수.
		LocalDate from = t != null ? t.cycleStart() : today.withDayOfMonth(1);
		if (from.isAfter(today)) {
			from = today;
		}
		long days = Math.min(ChronoUnit.DAYS.between(from, today) + 1, DateRange.MAX_DAYS);
		Map<Long, String> names = categories.findAllOrdered(userId)
			.stream()
			.collect(Collectors.toMap(Category::getId, Category::getName, (a, b) -> a));
		Spending current = spending(userId, from, today, names);
		Spending previous = spending(userId, from.minusDays(days), from.minusDays(1), names);
		return new ChatPrompt.Context(today, t, preset, proposable, recordReady, current, previous);
	}

	/** 지출만, 고정지출 자동 기록 포함(분석 화면과 같은 기준). 많이 쓴 순으로 8개, 나머지는 '그 외'. */
	private Spending spending(long userId, LocalDate from, LocalDate to, Map<Long, String> names) {
		DateRange range = DateRange.of(from, to);
		Map<String, long[]> perCategory = new LinkedHashMap<>();
		long total = 0;
		for (Transaction tx : transactions.findInRange(userId, range.startInstant(zone),
				range.endInstantExclusive(zone))) {
			if (tx.getType() != TxType.EXPENSE) {
				continue;
			}
			total += tx.getAmount();
			long[] c = perCategory.computeIfAbsent(names.getOrDefault(tx.getCategoryId(), "기타"), k -> new long[2]);
			c[0] += tx.getAmount();
			c[1]++;
		}
		List<CategoryTotal> sorted = perCategory.entrySet()
			.stream()
			.map(e -> new CategoryTotal(e.getKey(), e.getValue()[0], (int) e.getValue()[1]))
			.sorted(Comparator.comparingLong(CategoryTotal::amount).reversed())
			.collect(Collectors.toCollection(ArrayList::new));
		if (sorted.size() > MAX_CATEGORIES) {
			List<CategoryTotal> rest = sorted.subList(MAX_CATEGORIES, sorted.size());
			CategoryTotal others = new CategoryTotal("그 외", rest.stream().mapToLong(CategoryTotal::amount).sum(),
					rest.stream().mapToInt(CategoryTotal::count).sum());
			rest.clear();
			sorted.add(others);
		}
		return new Spending(from, to, total, sorted);
	}
}
