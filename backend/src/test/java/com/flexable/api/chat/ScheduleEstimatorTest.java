package com.flexable.api.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.flexable.api.chat.ChatDtos.Scope;
import com.flexable.api.chat.ScheduleEstimator.Estimate;
import com.flexable.api.chat.ScheduleEstimator.Sample;
import com.flexable.api.chat.ScheduleEstimator.Slot;

/** policies §8 일정 금액 예측: 같은 날 같은 시간대는 한 번으로 합치고 중앙값을 100원 단위로 내린다. */
class ScheduleEstimatorTest {

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static Sample at(String local, long amount) {
		return new Sample(java.time.LocalDateTime.parse(local).atZone(SEOUL).toInstant(), amount);
	}

	@Test
	void medianOfSameSlotRoundedDownTo100() {
		Estimate e = ScheduleEstimator.compute(List.of(at("2026-10-20T19:00", 20000), at("2026-10-21T19:00", 27342),
				at("2026-10-22T19:00", 35000), at("2026-10-23T19:00", 48000), at("2026-10-24T19:00", 27000)),
				Slot.EVENING, SEOUL);
		assertThat(e.amount()).isEqualTo(27300);
		assertThat(e.basis()).isEqualTo(new ChatDtos.Basis(5, Scope.SLOT, 90));
	}

	@Test
	void sameEveningTransactionsAreOneOccasion() {
		// 1차+2차, 자정 넘긴 3차(전날 저녁)는 하루 저녁의 합계 한 번
		Estimate e = ScheduleEstimator.compute(List.of(at("2026-10-20T19:00", 10000), at("2026-10-20T21:30", 20000),
				at("2026-10-21T00:30", 5000), at("2026-10-22T19:00", 40000), at("2026-10-23T19:00", 50000)),
				Slot.EVENING, SEOUL);
		assertThat(e.basis().samples()).isEqualTo(3);
		assertThat(e.amount()).isEqualTo(40000); // 35,000 · 40,000 · 50,000의 중앙값
	}

	@Test
	void fallsBackToWholeCategoryThenGivesUp() {
		List<Sample> two = List.of(at("2026-10-20T19:00", 10000), at("2026-10-21T12:00", 20000));
		assertThat(ScheduleEstimator.compute(two, Slot.EVENING, SEOUL)).isEqualTo(new Estimate(null, null));

		List<Sample> three = List.of(at("2026-10-20T19:00", 10000), at("2026-10-21T12:00", 20000),
				at("2026-10-22T08:00", 30000));
		Estimate e = ScheduleEstimator.compute(three, Slot.EVENING, SEOUL);
		assertThat(e.amount()).isEqualTo(20000);
		assertThat(e.basis().scope()).isEqualTo(Scope.CATEGORY);
		assertThat(ScheduleEstimator.compute(List.of(), null, SEOUL)).isEqualTo(new Estimate(null, null));
	}

	@Test
	void evenCountUsesMiddleAverageAndTinyAmountsStayPositive() {
		assertThat(ScheduleEstimator.median(List.of(10000L, 20000L, 30000L, 40000L))).isEqualTo(25000);
		assertThat(ScheduleEstimator.round(27342)).isEqualTo(27300);
		assertThat(ScheduleEstimator.round(80)).isEqualTo(80);
		assertThat(Instant.EPOCH).isNotNull();
	}
}
