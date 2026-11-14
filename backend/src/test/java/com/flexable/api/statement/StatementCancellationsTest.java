package com.flexable.api.statement;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

/** 가짜 값. 결제 취소 쌍 빼기(policies §9). */
class StatementCancellationsTest {

	private static StatementRow out(String at, long amount, String content) {
		return new StatementRow(LocalDateTime.parse(at), "체크카드", amount, 0, content, 0);
	}

	private static StatementRow in(String at, long amount, String content) {
		return new StatementRow(LocalDateTime.parse(at), "체크카드", 0, amount, content, 0);
	}

	@Test
	void 가승인과_취소_쌍은_둘_다_빼고_실제_결제는_남긴다() {
		StatementRow real = out("2026-11-03T00:52:43", 31200, "가상택시(법");
		StatementRow cancel = in("2026-11-03T00:19:51", 29500, "가상택시_가승인");
		StatementRow hold = out("2026-11-03T00:19:47", 29500, "가상택시_가승인");
		// 최신순 내역서 그대로 넣어도 원래 순서로 남는다
		assertThat(StatementCancellations.withoutPairs(List.of(real, cancel, hold))).containsExactly(real);
	}

	@Test
	void 내용_금액_적요가_다르거나_입금이_먼저거나_31일이_지나면_빼지_않는다() {
		List<StatementRow> rows = List.of(out("2026-10-01T10:00:00", 5000, "가상가게"),
				in("2026-10-02T10:00:00", 5000, "다른가게"), in("2026-10-02T11:00:00", 4000, "가상가게"),
				new StatementRow(LocalDateTime.parse("2026-10-02T12:00:00"), "전자금융", 0, 5000, "가상가게", 0));
		assertThat(StatementCancellations.withoutPairs(rows)).isEqualTo(rows);
		List<StatementRow> refundFirst = List.of(in("2026-10-01T10:00:00", 5000, "가상가게"),
				out("2026-10-02T10:00:00", 5000, "가상가게"));
		assertThat(StatementCancellations.withoutPairs(refundFirst)).isEqualTo(refundFirst);
		List<StatementRow> late = List.of(out("2026-09-01T10:00:00", 5000, "가상가게"),
				in("2026-10-02T10:00:01", 5000, "가상가게"));
		assertThat(StatementCancellations.withoutPairs(late)).isEqualTo(late);
		List<StatementRow> within = List.of(out("2026-09-01T10:00:00", 5000, "가상가게"),
				in("2026-10-02T10:00:00", 5000, "가상가게"));
		assertThat(StatementCancellations.withoutPairs(within)).isEmpty();
	}

	@Test
	void 같은_결제_두_번에_취소_한_번이면_가장_가까운_결제_하나만_뺀다() {
		StatementRow first = out("2026-10-01T10:00:00", 5000, "가상가게");
		StatementRow second = out("2026-10-01T12:00:00", 5000, "가상가게");
		StatementRow cancel = in("2026-10-01T12:05:00", 5000, "가상가게");
		assertThat(StatementCancellations.withoutPairs(List.of(first, second, cancel))).containsExactly(first);
	}
}
