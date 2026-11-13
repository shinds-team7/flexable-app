package com.flexable.api.chat;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Callable;
import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.format.TextStyle;
import java.util.Locale;
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
import com.flexable.api.budget.BudgetDtos;
import com.flexable.api.chat.ChatDtos.Accept;
import com.flexable.api.chat.ChatDtos.Basis;
import com.flexable.api.chat.ChatDtos.ChatAction;
import com.flexable.api.chat.ChatDtos.Preview;
import com.flexable.api.chat.ChatDtos.ScheduleProposal;
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
import org.springframework.beans.factory.annotation.Value;
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
	private static final int MAX_SCHEDULE_DAYS = 90;
	private static final long MAX_AMOUNT = 999_999_999_999L;

	private final ChatModel model;
	private final ChatProperties props;
	private final ChatRateLimiter limiter;
	private final BudgetService budget;
	private final TransactionRepository transactions;
	private final CategoryRepository categories;
	private final ScheduleEstimator estimator;
	private final Clock clock;
	private final ZoneId zone;
	/** 일정 안내 문장(두 번째 모델 호출)에 쓸 최대 시간. 넘으면 서버 기본 문장으로 답한다. */
	private final Duration narrateLimit;
	/**
	 * 한 요청 전체에 쓸 시간. 앱은 40초 뒤 끊으므로 그보다 짧게 둔다. 첫 호출이 오래 걸렸으면 문장 다듬기를 건너뛴다.
	 */
	private final Duration replyBudget;
	/**
	 * 모델 호출 전용 스레드. 시간 초과로 버린 호출도 HTTP 읽기 제한까지 스레드를 쥐고 있으므로 수를 제한한다.
	 * 다 차면 첫 호출은 CHAT_FAILED, 안내 문장은 서버 기본 문장으로 답한다.
	 */
	private final ThreadPoolExecutor modelCalls = new ThreadPoolExecutor(MODEL_THREADS, MODEL_THREADS, 30,
			TimeUnit.SECONDS, new ArrayBlockingQueue<>(MODEL_QUEUE), r -> {
				Thread t = new Thread(r, "chat-model");
				t.setDaemon(true);
				return t;
			});
	static final int MODEL_THREADS = 8;
	static final int MODEL_QUEUE = 8;

	@PreDestroy
	void shutdown() {
		modelCalls.shutdownNow();
	}

	/** 기한 안에 모델 답을 받는다. 기한을 넘기면 TimeoutException, 대기열이 차면 RejectedExecutionException. */
	private ChatModel.Reply within(Callable<ChatModel.Reply> call, Duration limit) throws TimeoutException {
		Future<ChatModel.Reply> job = modelCalls.submit(call);
		try {
			return job.get(Math.max(1, limit.toMillis()), TimeUnit.MILLISECONDS);
		}
		catch (TimeoutException e) {
			job.cancel(true);
			throw e;
		}
		catch (InterruptedException e) {
			job.cancel(true);
			Thread.currentThread().interrupt();
			throw new ChatModel.Failure("중단됨");
		}
		catch (ExecutionException e) {
			if (e.getCause() instanceof ChatModel.Failure f) {
				throw f;
			}
			if (e.getCause() instanceof RuntimeException re) {
				throw re;
			}
			throw new ChatModel.Failure("모델 호출 오류: " + e.getCause());
		}
	}

	public ChatService(ChatModel model, ChatProperties props, ChatRateLimiter limiter, BudgetService budget,
			TransactionRepository transactions, CategoryRepository categories, ScheduleEstimator estimator, Clock clock,
			AppProperties app, @Value("${app.chat.narrate-timeout:6s}") Duration narrateLimit,
			@Value("${app.chat.reply-budget:30s}") Duration replyBudget) {
		this.narrateLimit = narrateLimit;
		this.replyBudget = replyBudget;
		this.model = model;
		this.props = props;
		this.limiter = limiter;
		this.budget = budget;
		this.transactions = transactions;
		this.categories = categories;
		this.estimator = estimator;
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
		long started = System.nanoTime();

		ChatPrompt.Context context = context(userId);
		List<String> presets = context.proposable().stream().map(Preset::name).toList();
		// 일정 제안은 앱이 알린 경우에만, 예산이 있고 지출 카테고리가 있을 때만 한다.
		List<Category> expenseCategories = req.accepts(Accept.SCHEDULE) && context.today() != null
				? categories.findAllOrdered(userId, TxType.EXPENSE) : List.of();
		// DB에서 필요한 값은 여기서 읽고, 모델 호출만 기한이 있는 작업으로 돌린다(요청 전체 replyBudget).
		Callable<ChatModel.Reply> call;
            if (req.accepts(Accept.EXPENSE)) {
                List<String> incomeCategories = req.accepts(Accept.INCOME)
                        ? categories.findAllOrdered(userId, TxType.INCOME).stream().map(Category::getName).toList() : null;
                List<String> expenseNames = categories.findAllOrdered(userId, TxType.EXPENSE).stream()
                        .map(Category::getName).toList();
                String system = ChatPrompt.system(req.mate(), context,
                        expenseCategories.isEmpty() ? null : scheduleInfo(req, expenseCategories), incomeCategories,
                        expenseNames);
                call = () -> model.generate(system, req.messages(), presets,
                        expenseCategories.stream().map(Category::getName).toList(), incomeCategories != null, expenseNames);
            }
            else if (req.accepts(Accept.INCOME)) {
                List<String> incomeCategories = categories.findAllOrdered(userId, TxType.INCOME).stream()
                        .map(Category::getName).toList();
                String system = ChatPrompt.system(req.mate(), context,
                        expenseCategories.isEmpty() ? null : scheduleInfo(req, expenseCategories), incomeCategories);
                call = () -> model.generate(system, req.messages(), presets,
                        expenseCategories.stream().map(Category::getName).toList(), true);
            }
            else if (expenseCategories.isEmpty()) {
				call = () -> model.generate(ChatPrompt.system(req.mate(), context), req.messages(), presets);
			}
			else {
				call = () -> model.generate(ChatPrompt.system(req.mate(), context, scheduleInfo(req, expenseCategories)),
						req.messages(), presets, expenseCategories.stream().map(Category::getName).toList());
			}
		ChatModel.Reply r;
		try {
			r = within(call, replyBudget);
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
            return new ExpenseProposals(transactions, categories, zone).reply(userId, context.date(), r.expense());
        }
        if (req.accepts(Accept.INCOME) && r.income() != null) {
            return new IncomeProposals(budget, transactions, categories, zone).reply(userId, context.date(), r.income());
        }
		if (r.schedule() != null && !expenseCategories.isEmpty()) {
			return scheduleReply(userId, req, context, r, expenseCategories, started);
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

	private static ChatPrompt.Schedule scheduleInfo(ChatRequest req, List<Category> expense) {
		ChatPrompt.PendingText pending = null;
		if (req.pending() != null) {
			pending = expense.stream()
				.filter(c -> c.getId().equals(req.pending().categoryId()))
				.findFirst()
				.map(c -> new ChatPrompt.PendingText(req.pending().title(), req.pending().date(), c.getName(),
						req.pending().amount()))
				.orElse(null);
		}
		return new ChatPrompt.Schedule(expense.stream().map(Category::getName).toList(), pending);
	}

	/**
	 * 모델이 고른 일정(제목·날짜·카테고리·시간대)을 검증하고, 금액은 서버가 기록으로 예측한다. 모델은 서버 결과를
	 * 전하는 문장만 쓴다. 저장은 하지 않고 제안(action)만 돌려준다.
	 */
	private ChatResponse scheduleReply(long userId, ChatRequest req, ChatPrompt.Context context, ChatModel.Reply r,
			List<Category> expense, long started) {
		ChatModel.ScheduleCall call = r.schedule();
		LocalDate today = context.date();
		LocalDate date = parseDate(call.date());
		String title = call.title() == null ? "" : call.title().trim();
		if (title.length() > 40) {
			title = title.substring(0, 40);
		}
		String categoryName = call.category() == null ? "" : call.category().trim();
		Category category = expense.stream().filter(c -> c.getName().equals(categoryName)).findFirst().orElse(null);
		if (date == null || !date.isAfter(today) || date.isAfter(today.plusDays(MAX_SCHEDULE_DAYS)) || title.isEmpty()
				|| category == null) {
			log.warn("AI 메이트 일정 제안이 맞지 않아 되물음");
			// 저장 제안이 없으므로 모델 문장("등록했어요" 등) 대신 되묻는 문장만 쓴다.
			return new ChatResponse("일정 날짜를 정확히 모르겠어요. 내일부터 석 달 안의 날짜나 요일로 다시 알려 주세요.", null);
		}

		Long amount = call.amount() != null && call.amount() >= 1 && call.amount() <= MAX_AMOUNT ? call.amount() : null;
		Basis basis = null;
		if (amount == null) {
			ScheduleEstimator.Estimate est = estimator.estimate(userId, category.getId(), today, zone);
			amount = est.amount();
			basis = est.basis();
		}
		Preview preview = null;
		boolean afterPayday = false;
		if (amount != null) {
			TodayResponse after = budget.preview(userId, today, date, amount);
			final LocalDate day = date;
			Long dayBudget = after.dayPlans()
				.stream()
				.filter(d -> d.date().equals(day))
				.findFirst()
				.map(BudgetDtos.DayPlan::budget)
				.orElse(null);
			if (dayBudget == null) {
				afterPayday = true; // 다음 수입일 이후 날짜는 이번 예산에 들어가지 않는다
			}
			else {
				preview = new Preview(dayBudget, context.today().dailyBudget(), after.dailyBudget());
			}
		}

		String reply = narrate(req, started, new ChatPrompt.ScheduleResult(title, date, category.getName(), amount,
				basisText(basis), preview == null ? null : preview.dayBudget(),
				preview == null ? null : preview.dailyBudgetBefore(),
				preview == null ? null : preview.dailyBudgetAfter(), afterPayday));
		return new ChatResponse(reply, new ChatAction(ActionType.SCHEDULE, null, null,
				new ScheduleProposal(title, date, category.getId(), category.getName(), amount, basis, preview)));
	}

	/**
	 * 서버 결과를 모델이 전하게 한다. 실패하거나, 남은 시간 안에 오지 않거나, 서버 금액이 문장에 그대로 없으면
	 * 서버 기본 문장을 쓴다. 문장은 꾸밈일 뿐이라 제안(action)은 늘 서버 값으로 나간다.
	 */
	private String narrate(ChatRequest req, long started, ChatPrompt.ScheduleResult res) {
		String text = "";
		Duration left = replyBudget.minus(Duration.ofNanos(System.nanoTime() - started));
		Duration limit = left.compareTo(narrateLimit) < 0 ? left : narrateLimit;
		if (limit.toMillis() < 1000) {
			log.warn("AI 메이트 일정 안내 문장 건너뜀: 첫 응답이 늦음");
		}
		else {
			try {
				ChatModel.Reply reply = within(
						() -> model.generate(ChatPrompt.narrate(req.mate(), res), req.messages(), List.of()), limit);
				text = reply == null || reply.text() == null ? "" : reply.text();
			}
			catch (TimeoutException | RejectedExecutionException e) {
				log.warn("AI 메이트 일정 안내 문장 {}({}ms), 기본 문장 사용", e.getClass().getSimpleName(), limit.toMillis());
			}
			catch (ChatModel.Failure e) {
				log.warn("AI 메이트 일정 안내 문장 실패, 기본 문장 사용: {}", e.getMessage());
			}
		}
		if (!text.isBlank() && (res.amount() == null || text.contains(String.format("%,d", res.amount())))) {
			return text;
		}
		String when = res.date().getMonthValue() + "/" + res.date().getDayOfMonth() + "("
				+ res.date().getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.KOREAN) + ")";
		if (res.amount() == null) {
			return when + " **" + res.title() + "**에는 비슷한 기록이 적어서 얼마나 쓸지 예상하기 어려워요. 얼마 정도 쓸 것 같으세요?";
		}
		return when + " **" + res.title() + "**에 **" + String.format("%,d원", res.amount())
				+ "** 정도 쓸 것 같아요.\n이 금액으로 예정 지출에 등록할까요?";
	}

	private static String basisText(Basis basis) {
		if (basis == null) {
			return null;
		}
		return "최근 " + basis.days() + "일 이 카테고리 지출이 있던 " + basis.samples() + "일의 하루 합계 가운데 값";
	}

	private static LocalDate parseDate(String s) {
		try {
			return s == null ? null : LocalDate.parse(s.trim());
		}
		catch (DateTimeParseException e) {
			return null;
		}
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
