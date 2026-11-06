package com.flexable.api.chat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
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
 * 해당 카테고리의 최근 90일 지출을 "같은 날 같은 시간대" 단위로 합쳐 한 번의 자리로 보고 그 중앙값을 쓴다.
 */
@Component
public class ScheduleEstimator {

	static final int DAYS = 90;
	static final int MIN_SAMPLES = 3;

	/** 아침 06–11, 낮 11–17, 저녁·밤 17–06(새벽은 전날 저녁에 붙인다). */
	public enum Slot {
		MORNING, DAYTIME, EVENING;

		public static Slot of(int hour) {
			if (hour >= 6 && hour < 11) {
				return MORNING;
			}
			if (hour >= 11 && hour < 17) {
				return DAYTIME;
			}
			return EVENING;
		}

		public String label() {
			return switch (this) {
				case MORNING -> "아침";
				case DAYTIME -> "낮";
				case EVENING -> "저녁";
			};
		}
	}

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

	public Estimate estimate(long userId, long categoryId, Slot slot, LocalDate today, ZoneId zone) {
		DateRange range = DateRange.of(today.minusDays(DAYS), today.minusDays(1));
		List<Sample> samples = new ArrayList<>();
		for (Transaction t : transactions.findInRange(userId, range.startInstant(zone), range.endInstantExclusive(zone))) {
			if (t.getType() == TxType.EXPENSE && !t.isFromFixed() && t.getCategoryId() == categoryId) {
				samples.add(new Sample(t.getOccurredAt(), t.getAmount()));
			}
		}
		return compute(samples, slot, zone);
	}

	static Estimate compute(List<Sample> samples, Slot slot, ZoneId zone) {
		Map<String, long[]> bySlot = new HashMap<>();
		Map<String, Slot> slotOf = new HashMap<>();
		for (Sample s : samples) {
			ZonedDateTime z = s.at().atZone(zone);
			Slot sl = Slot.of(z.getHour());
			LocalDate day = z.getHour() < 6 ? z.toLocalDate().minusDays(1) : z.toLocalDate();
			String key = day + "/" + sl;
			bySlot.computeIfAbsent(key, k -> new long[1])[0] += s.amount();
			slotOf.put(key, sl);
		}
		List<Long> same = new ArrayList<>();
		List<Long> all = new ArrayList<>();
		bySlot.forEach((key, sum) -> {
			all.add(sum[0]);
			if (slotOf.get(key) == slot) {
				same.add(sum[0]);
			}
		});
		if (same.size() >= MIN_SAMPLES) {
			return new Estimate(round(median(same)), new Basis(same.size(), Scope.SLOT, DAYS));
		}
		if (all.size() >= MIN_SAMPLES) {
			return new Estimate(round(median(all)), new Basis(all.size(), Scope.CATEGORY, DAYS));
		}
		return new Estimate(null, null);
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
