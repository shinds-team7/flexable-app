package com.flexable.api.statement;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import com.flexable.api.common.TxType;

/**
 * 거래 내용으로 기본 카테고리 이름을 추정한다. 앱 스크린샷 가져오기
 * (frontend/src/service/receiptImport/guessCategory.ts)와 같은 규칙이다. 한쪽을 바꾸면 다른 쪽도 맞춘다.
 * 못 맞추면 "기타"·"기타 수입".
 */
final class StatementCategoryGuess {

	static final String EXPENSE_FALLBACK = "기타";
	static final String INCOME_FALLBACK = "기타 수입";

	private static final List<Map.Entry<Pattern, String>> EXPENSE = List.of(
			rule("카페|커피|스타벅스|투썸|이디야|메가|빽다방|컴포즈|베이커리|빵|디저트", "카페·간식"),
			rule("식당|김밥|치킨|피자|버거|맥도날드|배달|요기요|쿠팡이츠|국밥|분식|마라|한식|중식|일식", "식비"),
			rule("택시|버스|지하철|교통|티머니|카카오T|주유|하이패스|KTX|SRT", "교통"),
			rule("CU|GS25|세븐일레븐|이마트|롯데마트|홈플러스|마트|다이소|올리브영", "생활·마트"),
			rule("쿠팡|네이버쇼핑|무신사|지마켓|11번가|옥션|백화점|선물", "쇼핑"),
			rule("영화|CGV|메가박스|넷플릭스|유튜브|게임|노래방|공연", "문화·여가"));

	private static final List<Map.Entry<Pattern, String>> INCOME = List.of(rule("급여|월급|상여", "급여"),
			rule("용돈", "용돈"));

	private StatementCategoryGuess() {
	}

	static String name(String title, TxType type) {
		var rules = type == TxType.EXPENSE ? EXPENSE : INCOME;
		return rules.stream()
			.filter(r -> r.getKey().matcher(title).find())
			.map(Map.Entry::getValue)
			.findFirst()
			.orElse(type == TxType.EXPENSE ? EXPENSE_FALLBACK : INCOME_FALLBACK);
	}

	private static Map.Entry<Pattern, String> rule(String regex, String name) {
		return Map.entry(Pattern.compile(regex), name);
	}
}
