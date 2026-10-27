package com.flexable.api.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** docs/policies.md §5 내 기록 기준 예시 표 = tests/policy/day-weights.json. */
class DayWeightsPolicyTest {

	private static LocalDate date(JsonNode n) {
		return LocalDate.parse(n.asString());
	}

	@TestFactory
	Stream<DynamicTest> record() throws Exception {
		JsonNode root = JsonMapper.builder().build()
			.readTree(Files.readString(Path.of("..", "tests", "policy", "day-weights.json")));
		return root.get("record").valueStream().map(c -> DynamicTest.dynamicTest(c.get("name").asString(), () -> {
			Map<LocalDate, Long> spent = new HashMap<>();
			// {date, amount}는 하루, {from, to, byWeekday}는 기간 안 요일마다 같은 금액(0은 기록 없음)
			for (JsonNode r : c.get("records")) {
				if (r.has("date")) {
					spent.merge(date(r.get("date")), r.get("amount").asLong(), Long::sum);
					continue;
				}
				for (LocalDate d = date(r.get("from")); !d.isAfter(date(r.get("to"))); d = d.plusDays(1)) {
					long amount = r.get("byWeekday").get(DayWeights.index(d)).asLong();
					if (amount > 0) {
						spent.merge(d, amount, Long::sum);
					}
				}
			}
			DayWeights.Record r = DayWeights.fromRecords(spent, date(c.get("today")));
			JsonNode ex = c.get("expected");
			assertThat(r.from()).isEqualTo(date(ex.get("from")));
			assertThat(r.to()).isEqualTo(date(ex.get("to")));
			assertThat(r.days()).isEqualTo(ex.get("days").asInt());
			assertThat(r.weekdays()).isEqualTo(ex.get("weekdays").asInt());
			if (ex.get("weights").isNull()) {
				assertThat(r.weights()).isNull();
			} else {
				assertThat(r.weights()).isEqualTo(ex.get("weights").valueStream().map(JsonNode::asInt).toList());
			}
		}));
	}
}
