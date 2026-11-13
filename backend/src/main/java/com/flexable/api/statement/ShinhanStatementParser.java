package com.flexable.api.statement;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 신한은행 "거래내역조회" PDF에서 뽑은 글자 줄을 거래로 바꾼다.
 * 표 머리: 거래일자 거래시간 적요 출금(원) 입금(원) 내용 잔액(원) 거래점.
 * 잘못 읽은 줄이 하나라도 있거나 잔액이 이어지지 않으면 전체를 거절한다(일부만 저장하지 않는다).
 */
public final class ShinhanStatementParser {

	public static final String BANK = "SHINHAN";

	private static final Pattern TITLE = Pattern.compile("거래내역조회");
	private static final Pattern ACCOUNT = Pattern.compile("계좌번호\\s*\\[신한\\]");
	private static final Pattern PERIOD = Pattern
		.compile("조회기간\\s*(\\d{4})\\.(\\d{2})\\.(\\d{2})\\s*~\\s*(\\d{4})\\.(\\d{2})\\.(\\d{2})");
	/** 거래 줄은 8자리 날짜로 시작한다. 이렇게 시작하는데 아래 형식이 아니면 읽지 못한 것으로 본다. */
	private static final Pattern ROW_START = Pattern.compile("^\\d{8}\\b");
	private static final Pattern ROW = Pattern.compile(
			"^(\\d{8}) (\\d{2}:\\d{2}:\\d{2}) (\\S+) ([\\d,]+) ([\\d,]+) (?:(.*?) )?(-?[\\d,]+) (\\S+)$");
	private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd HH:mm:ss");

	private ShinhanStatementParser() {
	}

	/** 신한은행 거래내역조회가 아니면 빈 값. 맞는데 읽을 수 없으면 {@link UnreadableStatementException}. */
	public static Optional<ParsedStatement> parse(List<String> rawLines) {
		List<String> lines = rawLines.stream().map(ShinhanStatementParser::normalize).filter(s -> !s.isEmpty()).toList();
		String head = String.join("\n", lines.subList(0, Math.min(lines.size(), 15)));
		if (!TITLE.matcher(head).find() || !ACCOUNT.matcher(head).find()) {
			return Optional.empty();
		}
		Matcher period = PERIOD.matcher(head);
		if (!period.find()) {
			throw new UnreadableStatementException("조회기간 없음");
		}
		LocalDate from = date(period.group(1), period.group(2), period.group(3));
		LocalDate to = date(period.group(4), period.group(5), period.group(6));

		List<StatementRow> rows = new ArrayList<>();
		for (String line : lines) {
			if (!ROW_START.matcher(line).find()) {
				continue;
			}
			Matcher m = ROW.matcher(line);
			if (!m.matches()) {
				throw new UnreadableStatementException("거래 줄 형식이 다름 (" + rows.size() + "번째 다음)");
			}
			rows.add(row(m));
		}
		checkBalances(rows);
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
		long withdrawal = amount(m.group(4));
		long deposit = amount(m.group(5));
		if ((withdrawal > 0) == (deposit > 0)) {
			throw new UnreadableStatementException("출금·입금 중 하나만 있어야 함");
		}
		String content = m.group(6) == null ? "" : m.group(6).trim();
		return new StatementRow(at, m.group(3), withdrawal, deposit, content, amount(m.group(7)));
	}

	/**
	 * 잔액이 이어지는지 본다. 최신순(신한 기본)과 오래된 순 둘 다 받는다.
	 * 최신순이면 이전(아래) 줄 잔액 − 이번 출금 + 이번 입금 = 이번 잔액이다.
	 */
	private static void checkBalances(List<StatementRow> rows) {
		if (rows.size() < 2) {
			return;
		}
		if (!chained(rows, true) && !chained(rows, false)) {
			throw new UnreadableStatementException("잔액이 이어지지 않음");
		}
	}

	private static boolean chained(List<StatementRow> rows, boolean newestFirst) {
		for (int i = 0; i + 1 < rows.size(); i++) {
			StatementRow newer = newestFirst ? rows.get(i) : rows.get(i + 1);
			StatementRow older = newestFirst ? rows.get(i + 1) : rows.get(i);
			if (older.balance() - newer.withdrawal() + newer.deposit() != newer.balance()) {
				return false;
			}
		}
		return true;
	}

	private static long amount(String text) {
		try {
			return Long.parseLong(text.replace(",", ""));
		}
		catch (NumberFormatException e) {
			throw new UnreadableStatementException("금액을 읽지 못함");
		}
	}

	private static LocalDate date(String y, String m, String d) {
		try {
			return LocalDate.of(Integer.parseInt(y), Integer.parseInt(m), Integer.parseInt(d));
		}
		catch (RuntimeException e) {
			throw new UnreadableStatementException("조회기간을 읽지 못함");
		}
	}

	private static String normalize(String line) {
		return line.replace(' ', ' ').replaceAll("[\\t ]+", " ").trim();
	}
}
