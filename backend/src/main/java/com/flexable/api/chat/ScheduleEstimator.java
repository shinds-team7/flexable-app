package com.flexable.api.chat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.flexable.api.chat.ChatDtos.Basis;
import com.flexable.api.chat.ChatDtos.Scope;
import com.flexable.api.common.DateRange;
import com.flexable.api.common.TxType;
import com.flexable.api.transaction.Transaction;
import com.flexable.api.transaction.TransactionRepository;

/**
 * 일정에 쓸 금액 예측(policies §8). 모델은 금액을 만들지 않고 이 계산 결과만 전한다.
 * 해당 카테고리의 최근 90일 지출을 날짜(KST)별로 합쳐 하루 한 번으로 보고 그 중앙값을 쓴다. 시간대는 보지 않는다(11-06 결정).
 */
@Component
public class ScheduleEstimator {

	static final int DAYS = 90;
	static final int MIN_SAMPLES = 3;

	/** 지출 한 건. */
	public record Sample(Instant at, long amount) {
	}

	/** amount·basis가 null이면 기록이 적어 예측하지 못한 것이다. */
	public record Estimate(Long amount, Basis basis) {
	}

	private final TransactionRepository transactions;

	public ScheduleEstimator(TransactionRepository transactions) {
		this.transactions = transactions;
	}

	public Estimate estimate(long userId, long categoryId, LocalDate today, ZoneId zone) {
		DateRange range = DateRange.of(today.minusDays(DAYS), today.minusDays(1));
		List<Sample> samples = new ArrayList<>();
		for (Transaction t : transactions.findInRange(userId, range.startInstant(zone), range.endInstantExclusive(zone))) {
			if (t.getType() == TxType.EXPENSE && !t.isFromFixed() && t.getCategoryId() == categoryId) {
				samples.add(new Sample(t.getOccurredAt(), t.getAmount()));
			}
		}
		return compute(samples, zone);
	}

	static Estimate compute(List<Sample> samples, ZoneId zone) {
		Map<LocalDate, Long> byDay = new HashMap<>();
		for (Sample s : samples) {
			byDay.merge(s.at().atZone(zone).toLocalDate(), s.amount(), Long::sum);
		}
		if (byDay.size() < MIN_SAMPLES) {
			return new Estimate(null, null);
		}
		return new Estimate(round(median(new ArrayList<>(byDay.values()))),
				new Basis(byDay.size(), Scope.CATEGORY, DAYS));
	}

	static long median(List<Long> values) {
		List<Long> sorted = values.stream().sorted().toList();
		int n = sorted.size();
		return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
	}

	/** 100원 단위 내림. 100원보다 작으면 그대로 둔다(0원 예정은 만들 수 없다). */
	static long round(long amount) {
		long r = amount / 100 * 100;
		return r > 0 ? r : amount;
	}
}
