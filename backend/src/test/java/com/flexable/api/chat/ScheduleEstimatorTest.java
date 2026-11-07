package com.flexable.api.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.flexable.api.chat.ChatDtos.Scope;
import com.flexable.api.chat.ScheduleEstimator.Estimate;
import com.flexable.api.chat.ScheduleEstimator.Sample;

/** policies §8 일정 금액 예측: 같은 날(KST) 지출은 한 번으로 합치고 그 중앙값을 100원 단위로 내린다. 시간대는 보지 않는다. */
class ScheduleEstimatorTest {

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static Sample at(String local, long amount) {
		return new Sample(java.time.LocalDateTime.parse(local).atZone(SEOUL).toInstant(), amount);
	}

	@Test
	void medianOfDailyTotalsRoundedDownTo100() {
		Estimate e = ScheduleEstimator.compute(List.of(at("2026-10-20T19:00", 20000), at("2026-10-21T08:00", 27342),
				at("2026-10-22T13:00", 35000), at("2026-10-23T19:00", 48000), at("2026-10-24T19:00", 27000)), SEOUL);
		assertThat(e.amount()).isEqualTo(27300);
		assertThat(e.basis()).isEqualTo(new ChatDtos.Basis(5, Scope.CATEGORY, 90));
	}

	@Test
	void sameDayTransactionsAreOneDayWhateverTheTime() {
		// 아침·점심·저녁 모두 하루 합계 한 번, 자정 넘긴 지출은 그다음 날
		Estimate e = ScheduleEstimator.compute(List.of(at("2026-10-20T08:00", 10000), at("2026-10-20T12:30", 20000),
				at("2026-10-20T21:00", 5000), at("2026-10-21T00:30", 40000), at("2026-10-23T19:00", 50000)), SEOUL);
		assertThat(e.basis().samples()).isEqualTo(3);
		assertThat(e.amount()).isEqualTo(40000); // 35,000 · 40,000 · 50,000의 중앙값
	}

	@Test
	void needsThreeDays() {
		List<Sample> twoDays = List.of(at("2026-10-20T08:00", 10000), at("2026-10-20T19:00", 10000),
				at("2026-10-21T12:00", 20000));
		assertThat(ScheduleEstimator.compute(twoDays, SEOUL)).isEqualTo(new Estimate(null, null));
		assertThat(ScheduleEstimator.compute(List.of(), SEOUL)).isEqualTo(new Estimate(null, null));

		List<Sample> three = List.of(at("2026-10-20T19:00", 10000), at("2026-10-21T12:00", 20000),
				at("2026-10-22T08:00", 30000));
		assertThat(ScheduleEstimator.compute(three, SEOUL).amount()).isEqualTo(20000);
	}

	@Test
	void evenCountUsesMiddleAverageAndTinyAmountsStayPositive() {
		assertThat(ScheduleEstimator.median(List.of(10000L, 20000L, 30000L, 40000L))).isEqualTo(25000);
		assertThat(ScheduleEstimator.round(27342)).isEqualTo(27300);
		assertThat(ScheduleEstimator.round(80)).isEqualTo(80);
	}
}
