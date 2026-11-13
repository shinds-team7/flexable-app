package com.flexable.api.statement;

import java.io.IOException;
import java.io.StringWriter;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

import jakarta.annotation.PreDestroy;

/**
 * PDF에서 글자 줄을 뽑는다. 파일과 비밀번호는 메모리에서만 쓰고 저장·로그하지 않는다.
 * 비밀번호 오류는 STATEMENT_PASSWORD, 열 수 없거나 너무 크거나 오래 걸리는 파일은 STATEMENT_UNSUPPORTED,
 * 동시에 너무 많이 올리면 TOO_MANY_ATTEMPTS다.
 * 압축이 큰 PDF가 API 서버 전체를 붙잡지 않도록 따로 정한 스레드 2개에서만 읽고, 시간과 뽑는 글자 수를 제한한다.
 */
@Component
public class StatementPdfReader {

	static final int MAX_PAGES = 100;
	/** 신한 거래내역 5,000건이 한 줄 100자 안팎이라 넉넉히 잡은 상한 */
	static final int MAX_CHARS = 2_000_000;
	static final long TIMEOUT_SECONDS = 30;

	private final ThreadPoolExecutor executor = new ThreadPoolExecutor(2, 2, 0, TimeUnit.MILLISECONDS,
			new ArrayBlockingQueue<>(4), r -> {
				Thread t = new Thread(r, "statement-pdf");
				t.setDaemon(true);
				return t;
			});

	@PreDestroy
	void shutdown() {
		executor.shutdownNow();
	}

	public List<String> lines(byte[] pdf, String password) {
		String pw = password == null ? "" : password;
		Future<List<String>> job;
		try {
			job = executor.submit(() -> extract(pdf, pw));
		}
		catch (RejectedExecutionException e) {
			throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "거래내역서를 읽는 사람이 많아요. 잠시 후 다시 올려 주세요");
		}
		try {
			return job.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
		}
		catch (TimeoutException e) {
			job.cancel(true);
			throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED, "거래내역서를 읽는 데 너무 오래 걸려요. 기간을 나눠서 올려 주세요");
		}
		catch (InterruptedException e) {
			job.cancel(true);
			Thread.currentThread().interrupt();
			throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED);
		}
		catch (ExecutionException e) {
			if (e.getCause() instanceof ApiException api) {
				throw api;
			}
			// PDF 라이브러리 오류 메시지에는 파일 내용이 섞일 수 있어 남기지 않는다.
			throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED);
		}
	}

	private static List<String> extract(byte[] pdf, String pw) throws IOException {
		try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(pdf), pw)) {
			if (doc.getNumberOfPages() > MAX_PAGES) {
				throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED, "거래내역서는 " + MAX_PAGES + "쪽까지 올릴 수 있어요");
			}
			PDFTextStripper stripper = new PDFTextStripper();
			stripper.setSortByPosition(true);
			LimitedWriter out = new LimitedWriter();
			// 쪽마다 끊어 뽑아 글자 수와 취소(시간 초과)를 쪽 단위로 확인한다.
			for (int page = 1; page <= doc.getNumberOfPages(); page++) {
				if (Thread.currentThread().isInterrupted()) {
					throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED);
				}
				stripper.setStartPage(page);
				stripper.setEndPage(page);
				stripper.writeText(doc, out);
			}
			return out.toString().lines().toList();
		}
		catch (InvalidPasswordException e) {
			throw new ApiException(ErrorCode.STATEMENT_PASSWORD,
					pw.isEmpty() ? "PDF 비밀번호를 입력해 주세요" : ErrorCode.STATEMENT_PASSWORD.message());
		}
	}

	/** 상한을 넘으면 더 쓰지 않고 거절한다. */
	private static final class LimitedWriter extends StringWriter {

		@Override
		public void write(String str) {
			write(str, 0, str.length());
		}

		@Override
		public void write(String str, int off, int len) {
			check(len);
			super.write(str, off, len);
		}

		@Override
		public void write(char[] cbuf, int off, int len) {
			check(len);
			super.write(cbuf, off, len);
		}

		@Override
		public void write(int c) {
			check(1);
			super.write(c);
		}

		private void check(int more) {
			if (getBuffer().length() + more > MAX_CHARS) {
				throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED, "거래내역서가 너무 커요. 기간을 나눠서 올려 주세요");
			}
		}
	}
}
