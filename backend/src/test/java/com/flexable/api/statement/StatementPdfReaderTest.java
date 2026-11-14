package com.flexable.api.statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;

class StatementPdfReaderTest {

	private final StatementPdfReader reader = new StatementPdfReader();

	/** 비밀번호를 건 시험용 PDF(영문 글자만, 한글 글꼴을 저장소에 두지 않으려고). */
	private static byte[] pdf(String password, String... lines) throws Exception {
		try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			PDPage page = new PDPage();
			doc.addPage(page);
			try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
				cs.beginText();
				cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
				cs.newLineAtOffset(40, 740);
				for (String line : lines) {
					cs.showText(line);
					cs.newLineAtOffset(0, -14);
				}
				cs.endText();
			}
			if (password != null) {
				StandardProtectionPolicy policy = new StandardProtectionPolicy("owner-" + password, password,
						new AccessPermission());
				policy.setEncryptionKeyLength(256);
				doc.protect(policy);
			}
			doc.save(out);
			return out.toByteArray();
		}
	}

	@Test
	void 비밀번호가_맞으면_줄을_읽는다() throws Exception {
		byte[] file = pdf("000000", "20261031 09:00:00 A 3,000 0 SHOP 235,500 B", "second line");
		assertThat(reader.lines(file, "000000")).contains("20261031 09:00:00 A 3,000 0 SHOP 235,500 B", "second line");
	}

	@Test
	void 비밀번호가_없는_PDF는_비밀번호_없이_읽는다() throws Exception {
		assertThat(reader.lines(pdf(null, "plain"), null)).contains("plain");
	}

	@Test
	void 비밀번호가_틀리거나_없으면_STATEMENT_PASSWORD() throws Exception {
		byte[] file = pdf("000000", "x");
		assertThatThrownBy(() -> reader.lines(file, "111111")).isInstanceOfSatisfying(ApiException.class,
				e -> assertThat(e.code()).isEqualTo(ErrorCode.STATEMENT_PASSWORD));
		assertThatThrownBy(() -> reader.lines(file, null)).isInstanceOfSatisfying(ApiException.class, e -> {
			assertThat(e.code()).isEqualTo(ErrorCode.STATEMENT_PASSWORD);
			assertThat(e.getMessage()).isEqualTo("PDF 비밀번호를 입력해 주세요");
		});
	}

	@Test
	void PDF가_아니면_STATEMENT_UNSUPPORTED() {
		assertThatThrownBy(() -> reader.lines("not a pdf".getBytes(), null)).isInstanceOfSatisfying(ApiException.class,
				e -> assertThat(e.code()).isEqualTo(ErrorCode.STATEMENT_UNSUPPORTED));
	}

	/**
	 * 실제 거래내역서 확인용. 저장소에는 넣지 않고 로컬에서만 경로와 비밀번호를 환경 변수로 준다.
	 * 결과는 건수만 출력한다(거래 내용은 출력하지 않는다).
	 */
	@Test
	@EnabledIfEnvironmentVariable(named = "STATEMENT_SAMPLE_PDF", matches = ".+")
	void 로컬_실제_거래내역서() throws Exception {
		byte[] file = Files.readAllBytes(Path.of(System.getenv("STATEMENT_SAMPLE_PDF")));
		ParsedStatement p = StatementImportService.parseAny(reader.lines(file, System.getenv("STATEMENT_SAMPLE_PASSWORD")))
			.orElseThrow();
		long expenses = p.rows().stream().filter(r -> r.withdrawal() > 0).count();
		System.out.printf("[statement-sample] %s %s~%s rows=%d expenses=%d incomes=%d%n", p.bank(), p.from(), p.to(),
				p.rows().size(), expenses, p.rows().size() - expenses);
		// 거래내역서 머리의 총 출금·입금액과 맞춰 보도록 합계만 출력한다(거래 내용은 출력하지 않는다).
		System.out.printf("[statement-sample] withdrawal=%d deposit=%d%n",
				p.rows().stream().mapToLong(StatementRow::withdrawal).sum(),
				p.rows().stream().mapToLong(StatementRow::deposit).sum());		assertThat(p.rows()).isNotEmpty();
	}
}
