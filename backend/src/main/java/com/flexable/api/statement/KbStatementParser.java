package com.flexable.api.statement;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * KB국민은행 "계좌 거래내역 조회" PDF에서 뽑은 글자 줄을 거래로 바꾼다.
 * 표 머리: 거래일시 적요 보낸분/받는분 출금액 입금액 잔액 송금메모 거래점(쪽마다 조회기간·표 머리가 다시 나온다).
 * 신한과 같이 잘못 읽은 줄이 하나라도 있거나 잔액이 이어지지 않으면 전체를 거절한다.
 */
public final class KbStatementParser {

	public static final String BANK = "KB";

	private static final Pattern TITLE = Pattern.compile("계좌 ?거래내역 ?조회");
	private static final Pattern BANK_NAME = Pattern.compile("KB국민은행|kbstar\\.com");
	private static final Pattern PERIOD = Pattern
		.compile("조회기간\\s*:?\\s*(\\d{4})\\.(\\d{2})\\.(\\d{2})\\s*~\\s*(\\d{4})\\.(\\d{2})\\.(\\d{2})");
	private static final Pattern COLUMNS = Pattern.compile("^거래일시 적요 보낸분/받는분 출금액 입금액 잔액");
	/** 표 구간에서 거래가 아니어도 되는 줄: 안내(*로 시작)와 그 이어지는 줄, 쪽 번호, 쪽마다 다시 나오는 조회기간 */
	private static final Pattern FOOTER = Pattern.compile("^\\*.*|^\\d+ ?/ ?\\d+$|^문의하실 수 있습니다\\.?$|^조회기간\\s*:.*");
	/**
	 * 날짜 시각 (적요 보낸분/받는분) 출금액 입금액 잔액 송금메모 거래점.
	 * 적요·보낸분은 띄어쓰기를 포함할 수 있어 금액 세 칸이 처음 나오는 곳까지로 본다.
	 */
	private static final Pattern ROW = Pattern.compile(
			"^(\\d{4}\\.\\d{2}\\.\\d{2}) (\\d{2}:\\d{2}:\\d{2}) (.+?) ([\\d,]+) ([\\d,]+) (-?[\\d,]+) (.+) (\\S+)$");
	/** 앞 거래 줄에서 넘어온 글자: 숫자가 없고 20자 이하 */
	private static final Pattern WRAPPED = Pattern.compile("^[^\\d]{1,20}$");
	/** 띄어 쓴 두 낱말 적요(예: "FBS 출금"). 나머지는 첫 낱말이 적요다. */
	private static final Pattern TWO_WORD_SUMMARY = Pattern.compile("^(FBS|CMS) (출금|입금|공동)(?= |$)");
	private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("uuuu.MM.dd HH:mm:ss")
		.withResolverStyle(ResolverStyle.STRICT);

	private KbStatementParser() {
	}

	/** KB국민은행 계좌 거래내역 조회가 아니면 빈 값. 맞는데 읽을 수 없으면 {@link UnreadableStatementException}. */
	public static Optional<ParsedStatement> parse(List<String> rawLines) {
		List<String> lines = rawLines.stream().map(ShinhanStatementParser::normalize).filter(s -> !s.isEmpty()).toList();
		List<String> headLines = lines.subList(0, Math.min(lines.size(), 15));
		String head = String.join("\n", headLines);
		if (!TITLE.matcher(head).find() || headLines.stream().noneMatch(l -> COLUMNS.matcher(l).find())
				|| lines.stream().noneMatch(l -> BANK_NAME.matcher(l).find())) {
			return Optional.empty();
		}
		Matcher period = PERIOD.matcher(head);
		if (!period.find()) {
			throw new UnreadableStatementException("조회기간 없음");
		}
		LocalDate from = ShinhanStatementParser.date(period.group(1), period.group(2), period.group(3));
		LocalDate to = ShinhanStatementParser.date(period.group(4), period.group(5), period.group(6));

		int start = -1;
		for (int i = 0; i < lines.size() && start < 0; i++) {
			if (COLUMNS.matcher(lines.get(i)).find()) {
				start = i + 1;
			}
		}
		List<StatementRow> rows = new ArrayList<>();
		boolean afterRow = false;
		for (String line : lines.subList(start, lines.size())) {
			Matcher m = ROW.matcher(line);
			if (m.matches()) {
				rows.add(row(m));
				afterRow = true;
				continue;
			}
			// 칸이 좁아 거래점·보낸분 글자가 다음 줄로 넘어간 경우. 숫자가 없는 짧은 줄만 바로 앞 거래의 일부로 본다.
			boolean wrapped = afterRow && WRAPPED.matcher(line).matches();
			afterRow = false;
			if (wrapped) {
				continue;
			}
			if (!COLUMNS.matcher(line).find() && !FOOTER.matcher(line).matches()) {
				throw new UnreadableStatementException("읽지 못한 줄 (" + rows.size() + "번째 거래 다음)");
			}
		}
		ShinhanStatementParser.checkBalances(rows);
		return Optional.of(new ParsedStatement(BANK, from, to, rows));
	}

	private static StatementRow row(Matcher m) {
		LocalDateTime at;
		try {
			at = LocalDateTime.parse(m.group(1) + " " + m.group(2), DATE_TIME);
		}
		catch (DateTimeParseException e) {
			throw new UnreadableStatementException("날짜를 읽지 못함");
		}
		long withdrawal = ShinhanStatementParser.amount(m.group(4));
		long deposit = ShinhanStatementParser.amount(m.group(5));
		if ((withdrawal > 0) == (deposit > 0)) {
			throw new UnreadableStatementException("출금·입금 중 하나만 있어야 함");
		}
		String description = m.group(3);
		Matcher two = TWO_WORD_SUMMARY.matcher(description);
		int cut = two.find() ? two.end() : description.indexOf(' ');
		String summary = cut < 0 ? description : description.substring(0, cut);
		String content = cut < 0 ? "" : description.substring(cut).trim();
		if (summary.contains("이자")) {
			// "결산이자 이자세금:0원"처럼 이자 줄의 보낸분 칸은 세금 표시라 제목으로 쓰지 않는다(제목은 적요).
			content = "";
		}
		return new StatementRow(at, summary, withdrawal, deposit, content, ShinhanStatementParser.amount(m.group(6)));
	}
}
