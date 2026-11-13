package com.flexable.api.statement;

import java.io.IOException;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

/**
 * PDF에서 글자 줄을 뽑는다. 파일과 비밀번호는 메모리에서만 쓰고 저장·로그하지 않는다.
 * 비밀번호 오류는 STATEMENT_PASSWORD, 열 수 없거나 너무 큰 파일은 STATEMENT_UNSUPPORTED다.
 */
@Component
public class StatementPdfReader {

	static final int MAX_PAGES = 100;

	public List<String> lines(byte[] pdf, String password) {
		String pw = password == null ? "" : password;
		try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(pdf), pw)) {
			if (doc.getNumberOfPages() > MAX_PAGES) {
				throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED, "거래내역서는 " + MAX_PAGES + "쪽까지 올릴 수 있어요");
			}
			PDFTextStripper stripper = new PDFTextStripper();
			stripper.setSortByPosition(true);
			return stripper.getText(doc).lines().toList();
		}
		catch (InvalidPasswordException e) {
			throw new ApiException(ErrorCode.STATEMENT_PASSWORD,
					pw.isEmpty() ? "PDF 비밀번호를 입력해 주세요" : ErrorCode.STATEMENT_PASSWORD.message());
		}
		catch (IOException | RuntimeException e) {
			if (e instanceof ApiException api) {
				throw api;
			}
			// PDF 라이브러리 오류 메시지에는 파일 내용이 섞일 수 있어 남기지 않는다.
			throw new ApiException(ErrorCode.STATEMENT_UNSUPPORTED);
		}
	}
}
