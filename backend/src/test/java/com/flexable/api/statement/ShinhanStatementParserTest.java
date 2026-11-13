package com.flexable.api.statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/** 가짜 값으로 만든 신한은행 거래내역조회 글자 줄. 실제 거래내역서와 그 내용은 저장소에 두지 않는다. */
class ShinhanStatementParserTest {

	private static final List<String> HEAD = List.of("거래내역조회", "계좌번호 [신한]110-***-*00000 성명 홍*동",
			"조회기간 2026.10.01~2026.10.31 대출한도", "거래일자 거래시간 적요 출금(원) 입금(원) 내용 잔액(원) 거래점");

	private static List<String> statement(String... rows) {
		List<String> lines = new ArrayList<>(HEAD);
		lines.addAll(List.of(rows));
		lines.add("*이 문서는 시험용입니다.");
		return lines;
	}

	@Test
	void 최신순_거래를_읽는다() {
		ParsedStatement p = ShinhanStatementParser.parse(statement(
				"20261031 09:00:00 신한체 3,000 0 CU 테스트점 235,500 원신한",
				"20261010 08:30:00 타행MB 0 200,000 가나다 238,500 (토스)",
				"20261003 12:00:00 이자 0 500 09.01~09.30 38,500 영업부"))
			.orElseThrow();
		assertThat(p.bank()).isEqualTo("SHINHAN");
		assertThat(p.from()).isEqualTo(LocalDate.of(2026, 10, 1));
		assertThat(p.to()).isEqualTo(LocalDate.of(2026, 10, 31));
		assertThat(p.rows()).containsExactly(
				new StatementRow(LocalDateTime.of(2026, 10, 31, 9, 0), "신한체", 3000, 0, "CU 테스트점", 235500),
				new StatementRow(LocalDateTime.of(2026, 10, 10, 8, 30), "타행MB", 0, 200000, "가나다", 238500),
				new StatementRow(LocalDateTime.of(2026, 10, 3, 12, 0), "이자", 0, 500, "09.01~09.30", 38500));
	}

	@Test
	void 오래된_순도_받고_칸_사이_공백이_여러_개여도_읽는다() {
		ParsedStatement p = ShinhanStatementParser.parse(statement(
				"20261003  12:00:00\t이자 0 500 09.01~09.30 38,500 영업부",
				"20261010 08:30:00 타행MB 0   200,000 가나다 238,500 (토스)"))
			.orElseThrow();
		assertThat(p.rows()).hasSize(2);
	}

	@Test
	void 내용이_비어_있어도_읽는다() {
		ParsedStatement p = ShinhanStatementParser.parse(statement("20261003 12:00:00 이자 0 500 38,500 영업부"))
			.orElseThrow();
		assertThat(p.rows().get(0).content()).isEmpty();
		assertThat(p.rows().get(0).balance()).isEqualTo(38500);
	}

	@Test
	void 신한은행_거래내역조회가_아니면_빈_값() {
		assertThat(ShinhanStatementParser.parse(List.of("거래내역조회", "계좌번호 [국민]123", "조회기간 2026.10.01~2026.10.31")))
			.isEmpty();
		assertThat(ShinhanStatementParser.parse(List.of("hello"))).isEmpty();
	}

	@Test
	void 잔액이_이어지지_않으면_거절() {
		assertThatThrownBy(() -> ShinhanStatementParser.parse(statement(
				"20261031 09:00:00 신한체 3,000 0 편의점 235,000 원신한",
				"20261010 08:30:00 타행MB 0 200,000 가나다 238,500 (토스)")))
			.isInstanceOf(UnreadableStatementException.class);
	}

	@Test
	void 날짜로_시작하는데_형식이_다른_줄이_있으면_거절() {
		assertThatThrownBy(() -> ShinhanStatementParser.parse(statement("20261031 09:00:00 신한체 3,000 원신한")))
			.isInstanceOf(UnreadableStatementException.class);
	}

	@Test
	void 출금과_입금이_둘_다_있거나_둘_다_없으면_거절() {
		assertThatThrownBy(() -> ShinhanStatementParser.parse(statement("20261031 09:00:00 신한체 3,000 1,000 편의점 235,000 원신한")))
			.isInstanceOf(UnreadableStatementException.class);
		assertThatThrownBy(() -> ShinhanStatementParser.parse(statement("20261031 09:00:00 신한체 0 0 편의점 235,000 원신한")))
			.isInstanceOf(UnreadableStatementException.class);
	}

	@Test
	void 제목은_내용이고_이자나_빈_내용은_적요() {
		assertThat(StatementImportService.title(new StatementRow(LocalDateTime.now(), "신한체", 1, 0, "편의점", 0)))
			.isEqualTo("편의점");
		assertThat(StatementImportService.title(new StatementRow(LocalDateTime.now(), "이자", 0, 1, "09.01~09.30", 0)))
			.isEqualTo("이자");
		assertThat(StatementImportService.title(new StatementRow(LocalDateTime.now(), "FB이체", 1, 0, "", 0)))
			.isEqualTo("FB이체");
		assertThat(StatementImportService.title(new StatementRow(LocalDateTime.now(), "신한체", 1, 0, "가".repeat(50), 0)))
			.hasSize(40);
	}
}
