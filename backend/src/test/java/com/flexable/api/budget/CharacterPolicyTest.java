package com.flexable.api.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** docs/policies.md §4 예시 표 = tests/policy/character.json. 표를 고치면 이 테스트가 코드와 맞는지 확인한다. */
class CharacterPolicyTest {

	@TestFactory
	Stream<DynamicTest> characterPolicyCases() throws Exception {
		JsonNode root = JsonMapper.builder().build().readTree(Files.readString(Path.of("..", "tests", "policy", "character.json")));
		return root.get("cases").valueStream().map(c -> DynamicTest.dynamicTest(c.get("name").asString(), () -> {
			NavigableMap<LocalDate, Long> budgets = new TreeMap<>(byDate(c.get("budgets")));
			var r = CharacterScore.compute(budgets, byDate(c.get("spent")), LocalDate.parse(c.get("today").asString()));
			JsonNode ex = c.get("expected");
			assertThat(r.points()).isEqualTo(ex.get("points").asInt());
			assertThat(r.delta()).isEqualTo(ex.get("delta").asInt());
			assertThat(r.peak()).isEqualTo(ex.get("peak").asInt());
			assertThat(CharacterScore.level(r.points())).isEqualTo(ex.get("level").asInt());
			assertThat(CharacterScore.level(r.peak())).isEqualTo(ex.get("peakLevel").asInt());
		}));
	}

	private static Map<LocalDate, Long> byDate(JsonNode n) {
		Map<LocalDate, Long> map = new HashMap<>();
		n.properties().forEach(e -> map.put(LocalDate.parse(e.getKey()), e.getValue().asLong()));
		return map;
	}
}
