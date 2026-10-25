package com.flexable.api.budget;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import com.flexable.api.budget.BudgetDtos.TodayResponse;
import com.flexable.api.common.TxType;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** docs/policies.md §1·§2 예시 표 = tests/policy/budget.json. 표를 고치면 이 테스트가 코드와 맞는지 확인한다. */
class BudgetPolicyTest {

	private static JsonNode root() throws Exception {
		return JsonMapper.builder().build().readTree(Files.readString(Path.of("..", "tests", "policy", "budget.json")));
	}

	private static LocalDate date(JsonNode n) {
		return LocalDate.parse(n.asString());
	}

	@TestFactory
	Stream<DynamicTest> payday() throws Exception {
		return root().get("payday").valueStream().map(c -> DynamicTest.dynamicTest(c.get("name").asString(), () -> {
			LocalDate today = date(c.get("today"));
			int payday = c.get("payday").asInt();
			JsonNode ex = c.get("expected");
			assertThat(BudgetCalculator.nextPayday(today, payday)).isEqualTo(date(ex.get("nextPayday")));
			assertThat(BudgetCalculator.previousPayday(today, payday)).isEqualTo(date(ex.get("cycleStart")));
		}));
	}

	@TestFactory
	Stream<DynamicTest> today() throws Exception {
		JsonNode root = root();
		ZoneId zone = ZoneId.of(root.get("zone").asString());
		return root.get("today").valueStream().map(c -> DynamicTest.dynamicTest(c.get("name").asString(), () -> {
			JsonNode in = c.get("input");
			List<BudgetCalculator.Tx> txs = in.get("transactions").valueStream()
				.map(t -> new BudgetCalculator.Tx(TxType.valueOf(t.get("type").asString()), t.get("amount").asLong(),
						at(t.get("at"), zone), t.has("fixed") && t.get("fixed").asBoolean()))
				.toList();
			var input = new BudgetCalculator.Input(in.get("balance").asLong(), at(in.get("balanceAt"), zone),
					in.get("payday").asInt(), in.get("cardUnpaid").asLong(),
					in.get("fixed").valueStream().map(f -> f.get("day").asInt()).toList(),
					in.get("fixed").valueStream().map(f -> f.get("amount").asLong()).toList(),
					in.get("protectedTotal").asLong(), txs, !txs.isEmpty(), in.get("savedSinceBalance").asLong());
			TodayResponse r = BudgetCalculator.compute(input, date(in.get("today")), zone);
			JsonNode ex = c.get("expected");
			assertThat(r.nextPayday()).isEqualTo(date(ex.get("nextPayday")));
			assertThat(r.daysLeft()).isEqualTo(ex.get("daysLeft").asInt());
			assertThat(r.cycleStart()).isEqualTo(date(ex.get("cycleStart")));
			assertThat(r.estimatedBalance()).isEqualTo(ex.get("estimatedBalance").asLong());
			assertThat(r.reservedFixed()).isEqualTo(ex.get("reservedFixed").asLong());
			assertThat(r.remaining()).isEqualTo(ex.get("remaining").asLong());
			assertThat(r.todaySpent()).isEqualTo(ex.get("todaySpent").asLong());
			assertThat(r.dailyBudget()).isEqualTo(ex.get("dailyBudget").asLong());
			assertThat(r.todayAvailable()).isEqualTo(ex.get("todayAvailable").asLong());
			assertThat(r.shortage()).isEqualTo(ex.get("shortage").asLong());
			assertThat(r.weekSpent()).isEqualTo(ex.get("weekSpent").asLong());
			assertThat(r.weekDaysLeft()).isEqualTo(ex.get("weekDaysLeft").asInt());
			assertThat(r.weekAvailable()).isEqualTo(ex.get("weekAvailable").asLong());
		}));
	}

	private static Instant at(JsonNode n, ZoneId zone) {
		return LocalDateTime.parse(n.asString()).atZone(zone).toInstant();
	}
}
