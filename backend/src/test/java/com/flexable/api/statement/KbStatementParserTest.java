package com.flexable.api.statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * 가짜 값으로 만든 KB국민은행 계좌 거래내역 조회 글자 줄(실제 PDF에서 뽑은 줄의 모양만 따름).
 * 실제 거래내역서와 그 내용은 저장소에 두지 않는다.
 */
class KbStatementParserTest {

	private static final List<String> HEAD = List.of("계좌 거래내역 조회", "조회기준일시: 2026년 10월 31일 14:44:06",
			" 계좌명 테스트통장", " 계좌번호 000000-00-000000  예금주 홍길동", " 총 잔액 100,000원  출금가능금액 100,000원",
			"조회기간: 2026.10.01 ~2026.10.31", "거래일시 적요 보낸분/받는분 출금액 입금액 잔액 송금메모 거래점");
	private static final List<String> PAGE_FOOTER = List.of("1/2",
			"* 위 거래내역 조회는 고객 편의를 위해 제공하는 것으로 참고용으로만 사용하실 수 있습니다.",
			"* 관련 문의사항이 있는 경우 KB국민은행 홈페이지(www.kbstar.com) 또는 고객상담센터(대표번호: 1588-9999)에",
			"   문의하실 수 있습니다.");

	private static List<String> statement(String... rows) {
		List<String> lines = new ArrayList<>(HEAD);
		lines.addAll(List.of(rows));
		lines.addAll(PAGE_FOOTER);
		return lines;
	}

	@Test
	void 최신순_거래를_적요와_보낸분으로_나눠_읽는다() {
		ParsedStatement p = KbStatementParser.parse(statement(
				"2026.10.31 01:31:14 결산이자 이자세금:0원 0 68 100,000 - 테스트점",
				"2026.10.30 00:30:12 체크카드 가상편의점(CU)테스트 1,900 0 99,932 - KB카드",
				"2026.10.29 13:43:49 FBS 출금 토스페이 1,900 0 101,832 - ERP사",
				"2026.10.28 16:31:04 오픈뱅킹출금 토스 홍길동 480,000 0 103,732 - 스타뱅",
				"2026.10.27 15:00:58 전자금융 홍길동 0 583,732 583,732 메모 있음 신한은행"))
			.orElseThrow();
		assertThat(p.bank()).isEqualTo("KB");
		assertThat(p.from()).isEqualTo(LocalDate.of(2026, 10, 1));
		assertThat(p.to()).isEqualTo(LocalDate.of(2026, 10, 31));
		assertThat(p.rows()).containsExactly(
				// 이자 줄의 보낸분 칸(세금 표시)은 제목으로 쓰지 않는다
				new StatementRow(LocalDateTime.of(2026, 10, 31, 1, 31, 14), "결산이자", 0, 68, "", 100000),
				new StatementRow(LocalDateTime.of(2026, 10, 30, 0, 30, 12), "체크카드", 1900, 0, "가상편의점(CU)테스트",
						99932),
				new StatementRow(LocalDateTime.of(2026, 10, 29, 13, 43, 49), "FBS 출금", 1900, 0, "토스페이", 101832),
				new StatementRow(LocalDateTime.of(2026, 10, 28, 16, 31, 4), "오픈뱅킹출금", 480000, 0, "토스 홍길동", 103732),
				new StatementRow(LocalDateTime.of(2026, 10, 27, 15, 0, 58), "전자금융", 0, 583732, "홍길동", 583732));
		assertThat(StatementImportService.title(p.rows().get(0))).isEqualTo("결산이자");
		assertThat(StatementImportService.title(p.rows().get(1))).isEqualTo("가상편의점(CU)테스트");
	}

	@Test
	void 쪽마다_다시_나오는_조회기간_표머리와_넘어간_거래점_글자는_건너뛴다() {
		List<String> lines = statement("2026.10.30 00:30:12 체크카드 가상식당 1,000 0 9,000 - 가상역",
				"계역점");
		lines.addAll(List.of("조회기간: 2026.10.01 ~2026.10.31", "거래일시 적요 보낸분/받는분 출금액 입금액 잔액 송금메모 거래점",
				"2026.10.29 12:00:00 전자금융 홍길동 0 10,000 10,000 - 하나은행", "2/2"));
		ParsedStatement p = KbStatementParser.parse(lines).orElseThrow();
		assertThat(p.rows()).hasSize(2);
	}

	@Test
	void 가승인과_취소처럼_같은_금액의_출금_입금도_각각_읽는다() {
		ParsedStatement p = KbStatementParser.parse(statement(
				"2026.10.03 00:19:51 체크카드 가상택시_가승인 0 29,500 54,885 - KB카드",
				"2026.10.03 00:19:47 체크카드 가상택시_가승인 29,500 0 25,385 - KB카드"))
			.orElseThrow();
		assertThat(p.rows()).hasSize(2);
	}

	@Test
	void KB국민은행_거래내역이_아니면_빈_값() {
		assertThat(KbStatementParser.parse(List.of("거래내역조회", "계좌번호 [신한]110"))).isEmpty();
		List<String> noBank = new ArrayList<>(HEAD);
		noBank.add("2026.10.30 00:30:12 체크카드 가상식당 1,000 0 9,000 - 가상역");
		assertThat(KbStatementParser.parse(noBank)).isEmpty();
		// 신한 형식은 신한으로, KB 형식은 KB로 읽는다
		assertThat(StatementImportService
			.parseAny(statement("2026.10.30 00:30:12 체크카드 가상식당 1,000 0 9,000 - 가상역"))
			.orElseThrow()
			.bank()).isEqualTo("KB");
	}

	@Test
	void 읽지_못한_줄이나_이어지지_않는_잔액이_있으면_전체를_거절한다() {
		assertThatThrownBy(() -> KbStatementParser.parse(statement(
				"2026.10.30 00:30:12 체크카드 가상식당 1,000 0 9,000 - 가상역", "2026.10.29 깨진 줄 5,000")))
			.isInstanceOf(UnreadableStatementException.class);
		assertThatThrownBy(() -> KbStatementParser.parse(statement(
				"2026.10.30 00:30:12 체크카드 가상식당 1,000 0 9,000 - 가상역",
				"2026.10.29 12:00:00 전자금융 홍길동 0 10,000 12,000 - 하나은행")))
			.isInstanceOf(UnreadableStatementException.class);
		assertThatThrownBy(() -> KbStatementParser.parse(statement(
				"2026.02.30 00:30:12 체크카드 가상식당 1,000 0 9,000 - 가상역")))
			.isInstanceOf(UnreadableStatementException.class);
		assertThatThrownBy(() -> KbStatementParser.parse(statement(
				"2026.10.30 00:30:12 체크카드 가상식당 1,000 1,000 9,000 - 가상역")))
			.isInstanceOf(UnreadableStatementException.class);
	}
}
