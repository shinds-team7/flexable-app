package com.flexable.api.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import com.flexable.api.common.TxType;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * docs/policies.md §10 = tests/policy/category-guess.json. 키워드 표가 정책 파일과 같고(앱 guessCategory.ts도 같은 파일로
 * 검사한다) 모든 사례가 맞는지 본다.
 */
class CategoryGuessPolicyTest {

	private static JsonNode policy() throws Exception {
		return JsonMapper.builder().build()
			.readTree(Files.readString(Path.of("../tests/policy/category-guess.json")));
	}

	private static List<List<Object>> table(List<Map.Entry<String, List<String>>> rules) {
		return rules.stream().map(r -> List.<Object>of(r.getKey(), r.getValue())).toList();
	}

	private static List<List<Object>> table(JsonNode rules) {
		List<List<Object>> out = new ArrayList<>();
		for (JsonNode rule : rules) {
			List<String> keywords = new ArrayList<>();
			rule.get(1).forEach(k -> keywords.add(k.asString()));
			out.add(List.of(rule.get(0).asString(), keywords));
		}
		return out;
	}

	@Test
	void keywordTablesMatchPolicyFile() throws Exception {
		JsonNode rules = policy().get("rules");
		assertThat(table(CategoryGuess.EXPENSE)).isEqualTo(table(rules.get("EXPENSE")));
		assertThat(table(CategoryGuess.INCOME)).isEqualTo(table(rules.get("INCOME")));
	}

	@TestFactory
	Stream<DynamicTest> cases() throws Exception {
		List<DynamicTest> tests = new ArrayList<>();
		for (JsonNode c : policy().get("cases")) {
			String title = c.get("title").asString();
			TxType type = TxType.valueOf(c.get("type").asString());
			String expected = c.get("expected").asString();
			tests.add(DynamicTest.dynamicTest(title + " → " + expected,
					() -> assertThat(CategoryGuess.name(title, type)).isEqualTo(expected)));
		}
		return tests.stream();
	}
}
