package com.flexable.api.statement;

/** 지원하는 은행 형식인데 내용을 믿고 저장할 수 없을 때. 메시지는 개발용이고 거래 내용은 넣지 않는다. */
public class UnreadableStatementException extends RuntimeException {

	public UnreadableStatementException(String reason) {
		super(reason);
	}
}
