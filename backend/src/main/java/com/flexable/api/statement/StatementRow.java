package com.flexable.api.statement;

import java.time.LocalDateTime;

/** 거래내역서 한 줄. 시각은 은행이 적은 현지(서울) 시각이다. 출금·입금 중 하나만 0보다 크다. */
public record StatementRow(LocalDateTime at, String summary, long withdrawal, long deposit, String content,
		long balance) {
}
