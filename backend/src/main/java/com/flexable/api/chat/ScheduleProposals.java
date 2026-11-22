package com.flexable.api.chat;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.flexable.api.budget.BudgetDtos;
import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.budget.BudgetService;
import com.flexable.api.category.Category;
import com.flexable.api.chat.ChatDtos.ActionType;
import com.flexable.api.chat.ChatDtos.Basis;
import com.flexable.api.chat.ChatDtos.ChatAction;
import com.flexable.api.chat.ChatDtos.ChatRequest;
import com.flexable.api.chat.ChatDtos.ChatResponse;
import com.flexable.api.chat.ChatDtos.Preview;
import com.flexable.api.chat.ChatDtos.ScheduleProposal;

/**
 * 모델이 고른 일정(제목·날짜·카테고리·시간대)을 검증하고, 금액은 서버가 기록으로 예측한다. 모델은 서버 결과를
 * 전하는 문장만 쓴다. 저장은 하지 않고 제안(action)만 돌려준다.
 */
final class ScheduleProposals {

	private static final Logger log = LoggerFactory.getLogger(ScheduleProposals.class);
	private static final int MAX_DAYS = 90;
	private static final long MAX_AMOUNT = 999_999_999_999L;

	private final ChatModel model;
	private final ChatModelCalls calls;
	private final BudgetService budget;
	private final ScheduleEstimator estimator;
	private final ZoneId zone;
	/** 일정 안내 문장(두 번째 모델 호출)에 쓸 최대 시간. 넘으면 서버 기본 문장으로 답한다. */
	private final Duration narrateLimit;
	private final Duration replyBudget;

	ScheduleProposals(ChatModel model, ChatModelCalls calls, BudgetService budget, ScheduleEstimator estimator,
			ZoneId zone, Duration narrateLimit, Duration replyBudget) {
		this.model = model;
		this.calls = calls;
		this.budget = budget;
		this.estimator = estimator;
		this.zone = zone;
		this.narrateLimit = narrateLimit;
		this.replyBudget = replyBudget;
	}

	/** 프롬프트에 넣을 일정 정보. 앱이 보낸 작성 중 일정(pending)은 카테고리가 사용자 것일 때만 쓴다. */
	static ChatPrompt.Schedule info(ChatRequest req, List<Category> expense) {
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

	ChatResponse reply(long userId, ChatRequest req, ChatPrompt.Context context, ChatModel.ScheduleCall call,
			List<Category> expense, long started) {
		LocalDate today = context.date();
		LocalDate date = parseDate(call.date());
		String title = call.title() == null ? "" : call.title().trim();
		if (title.length() > 40) {
			title = title.substring(0, 40);
		}
		String categoryName = call.category() == null ? "" : call.category().trim();
		Category category = expense.stream().filter(c -> c.getName().equals(categoryName)).findFirst().orElse(null);
		if (date == null || !date.isAfter(today) || date.isAfter(today.plusDays(MAX_DAYS)) || title.isEmpty()
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
			Long dayBudget = after.dayPlans()
				.stream()
				.filter(d -> d.date().equals(date))
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
				ChatModel.Reply reply = calls.within(
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
}
