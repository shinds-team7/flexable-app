package com.flexable.api.chat;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.flexable.api.budget.BudgetDtos.DayWeightsResponse;
import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.budget.BudgetService;
import com.flexable.api.budget.DayWeights.Preset;
import com.flexable.api.category.Category;
import com.flexable.api.category.CategoryRepository;
import com.flexable.api.chat.ChatDtos.Accept;
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

import jakarta.annotation.PreDestroy;

/**
 * AI 메이트 답변. 대화는 저장하지 않는다. 요일별 배분·일정·수입·지출 변경은 제안(action)만 돌려주고 저장은 앱이
 * 확인 뒤 각 API로 한다. 트랜잭션으로 묶지 않는다(모델 호출 동안 DB 연결을 잡지 않게).
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
	/**
	 * 한 요청 전체에 쓸 시간. 앱은 40초 뒤 끊으므로 그보다 짧게 둔다. 첫 호출이 오래 걸렸으면 문장 다듬기를 건너뛴다.
	 */
	private final Duration replyBudget;
	private final ChatModelCalls calls = new ChatModelCalls();
	private final ScheduleProposals schedules;
	private final ExpenseProposals expenses;
	private final IncomeProposals incomes;

	public ChatService(ChatModel model, ChatProperties props, ChatRateLimiter limiter, BudgetService budget,
			TransactionRepository transactions, CategoryRepository categories, ScheduleEstimator estimator, Clock clock,
			AppProperties app, @Value("${app.chat.narrate-timeout:6s}") Duration narrateLimit,
			@Value("${app.chat.reply-budget:30s}") Duration replyBudget) {
		this.model = model;
		this.props = props;
		this.limiter = limiter;
		this.budget = budget;
		this.transactions = transactions;
		this.categories = categories;
		this.clock = clock;
		this.zone = app.zoneId();
		this.replyBudget = replyBudget;
		this.schedules = new ScheduleProposals(model, calls, budget, estimator, zone, narrateLimit, replyBudget);
		this.expenses = new ExpenseProposals(transactions, zone);
		this.incomes = new IncomeProposals(budget, transactions, zone);
	}

	@PreDestroy
	void shutdown() {
		calls.shutdown();
	}

	public ChatResponse reply(long userId, ChatRequest req) {
		if (!props.enabled()) {
			throw new ApiException(ErrorCode.CHAT_UNAVAILABLE);
		}
		if (req.messages().get(req.messages().size() - 1).role() != Role.USER) {
			throw ApiException.invalid("messages", "마지막 메시지는 내가 보낸 메시지여야 해요");
		}
		limiter.acquire(userId);
		long started = System.nanoTime();

		// 카테고리는 한 번만 읽어 종류별로 나눠 쓴다(정렬 순서는 저장소 쿼리와 같다).
		List<Category> all = categories.findAllOrdered(userId);
		List<Category> expense = ofType(all, TxType.EXPENSE);
		List<Category> income = ofType(all, TxType.INCOME);
		ChatPrompt.Context context = context(userId, all);
		// 일정 제안은 앱이 알린 경우에만, 예산이 있고 지출 카테고리가 있을 때만 한다.
		List<Category> scheduleCategories = req.accepts(Accept.SCHEDULE) && context.today() != null ? expense
				: List.of();

		ChatModel.Reply r;
		try {
			// DB에서 필요한 값은 위에서 읽었고, 모델 호출만 기한이 있는 작업으로 돌린다(요청 전체 replyBudget).
			r = calls.within(call(req, context, scheduleCategories, expense, income), replyBudget);
		}
		catch (TimeoutException | RejectedExecutionException e) {
			log.warn("AI 메이트 응답 시간 초과 또는 대기 초과: {}", e.getClass().getSimpleName());
			throw new ApiException(ErrorCode.CHAT_FAILED);
		}
		catch (ChatModel.Failure e) {
			log.warn("AI 메이트 응답 실패: {}", e.getMessage());
			throw new ApiException(ErrorCode.CHAT_FAILED);
		}

		if (req.accepts(Accept.EXPENSE) && r.expense() != null) {
			return expenses.reply(userId, context.date(), r.expense(), expense);
		}
		if (req.accepts(Accept.INCOME) && r.income() != null) {
			return incomes.reply(userId, context.date(), r.income(), income);
		}
		if (r.schedule() != null && !scheduleCategories.isEmpty()) {
			return schedules.reply(userId, req, context, r.schedule(), scheduleCategories, started);
		}
		return presetReply(r, context);
	}

	/** 앱이 받을 수 있다고 알린 제안(accepts)에 맞춰 프롬프트와 도구를 고른다. */
	private Callable<ChatModel.Reply> call(ChatRequest req, ChatPrompt.Context context,
			List<Category> scheduleCategories, List<Category> expense, List<Category> income) {
		List<String> presets = context.proposable().stream().map(Preset::name).toList();
		List<String> scheduleNames = names(scheduleCategories);
		ChatPrompt.Schedule schedule = scheduleCategories.isEmpty() ? null
				: ScheduleProposals.info(req, scheduleCategories);
		if (req.accepts(Accept.EXPENSE)) {
			List<String> incomeNames = req.accepts(Accept.INCOME) ? names(income) : null;
			List<String> expenseNames = names(expense);
			String system = ChatPrompt.system(req.mate(), context, schedule, incomeNames, expenseNames);
			return () -> model.generate(system, req.messages(), presets, scheduleNames, incomeNames != null,
					expenseNames);
		}
		if (req.accepts(Accept.INCOME)) {
			String system = ChatPrompt.system(req.mate(), context, schedule, names(income));
			return () -> model.generate(system, req.messages(), presets, scheduleNames, true);
		}
		if (schedule == null) {
			String system = ChatPrompt.system(req.mate(), context);
			return () -> model.generate(system, req.messages(), presets);
		}
		String system = ChatPrompt.system(req.mate(), context, schedule);
		return () -> model.generate(system, req.messages(), presets, scheduleNames);
	}

	/** 요일별 배분 제안 또는 일반 답변. */
	private static ChatResponse presetReply(ChatModel.Reply r, ChatPrompt.Context context) {
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

	private static List<Category> ofType(List<Category> all, TxType type) {
		return all.stream().filter(c -> c.getType() == type).toList();
	}

	private static List<String> names(List<Category> list) {
		return list.stream().map(Category::getName).toList();
	}

	/**
	 * 모델이 도구를 부르지 않고 말로만 배분을 권한 경우(가벼운 모델에서 자주 생긴다). 바꿀 수 있는 배분 이름이 답에
	 * 딱 하나만 나오면 그것을 제안으로 본다. 저장은 여전히 사용자가 확인해야 한다.
	 */
	static String mentioned(String text, List<Preset> proposable) {
		List<Preset> found = proposable.stream().filter(p -> text.contains(ChatPrompt.label(p))).toList();
		return found.size() == 1 ? found.get(0).name() : null;
	}

	private ChatPrompt.Context context(long userId, List<Category> all) {
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
		Map<Long, String> names = all.stream()
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
