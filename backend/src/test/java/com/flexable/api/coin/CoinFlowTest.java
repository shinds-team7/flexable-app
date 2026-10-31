package com.flexable.api.coin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;
import com.flexable.api.outfit.OutfitRepository;

/** 코인·코스튬·추천 코드. 규칙은 docs/coin-plan.md §1. 적립·보너스가 날짜와 시각에 달려 있어 시계를 고정한다. */
@SpringBootTest
@AutoConfigureMockMvc
class CoinFlowTest {

	static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	static class MutableClock extends Clock {
		volatile Instant now = Instant.parse("2026-10-21T03:00:00Z");

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}

		@Override
		public Instant instant() {
			return now;
		}

		/** 서울 시각으로 옮긴다. 예: "2026-10-21T09:00" */
		void seoul(String dateTime) {
			now = LocalDateTime.parse(dateTime).atZone(SEOUL).toInstant();
		}
	}

	@TestConfiguration
	static class ClockConfig {
		@Bean
		@Primary
		MutableClock testClock() {
			return new MutableClock();
		}
	}

	@Autowired
	MockMvc mvc;

	@Autowired
	MutableClock clock;

	@Autowired
	OutfitRepository outfits;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	DataSource dataSource;

	private static final String SETTINGS = "{\"balance\":1000000,\"payday\":26,\"incomeAmount\":2000000,"
			+ "\"cardUnpaid\":50000,\"fixedExpenses\":[],\"protectedItems\":[]}";

	private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder b, String token, String body) {
		b.header("Authorization", "Bearer " + token);
		return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private Object read(ResultActions r, String path) throws Exception {
		return JsonPath.read(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), path);
	}

	/** 토큰 만료는 실제 시각으로 검사하므로, 가입(토큰 발급)만 지금 시각에 하고 고정한 시각으로 돌아온다. */
	private String signup() throws Exception {
		Instant fixed = clock.now;
		clock.now = Instant.now();
		try {
			ResultActions r = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"coin-" + UUID.randomUUID()
						+ "@example.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":true}"))
				.andExpect(status().isCreated());
			return (String) read(r, "$.accessToken");
		}
		finally {
			clock.now = fixed;
		}
	}

	private ResultActions checkIn(String token) throws Exception {
		return mvc.perform(auth(post("/api/v1/coins/check-in"), token, null)).andExpect(status().isOk());
	}

	private void ackAll(String token) throws Exception {
		List<Integer> ids = (List<Integer>) read(checkIn(token), "$.rewards[*].id");
		mvc.perform(auth(post("/api/v1/coins/rewards/ack"), token, "{\"ids\":" + ids + "}"))
			.andExpect(status().isNoContent());
	}

	private ResultActions wallet(String token) throws Exception {
		return mvc.perform(auth(get("/api/v1/coins"), token, null)).andExpect(status().isOk());
	}

	/** 초기 예산을 설정하고 오늘 하루 예산을 기록한다. 하루 예산을 돌려준다. */
	private long setUpBudget(String token) throws Exception {
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());
		return recordToday(token);
	}

	private long recordToday(String token) throws Exception {
		return ((Number) read(mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(status().isOk()),
				"$.dailyBudget")).longValue();
	}

	/** 지금 시각에 지출을 기록한다. */
	private void spend(String token, long amount) throws Exception {
		List<Integer> expense = (List<Integer>) read(mvc.perform(auth(get("/api/v1/categories"), token, null)),
				"$[?(@.type == 'EXPENSE')].id");
		mvc.perform(auth(post("/api/v1/transactions"), token, "{\"type\":\"EXPENSE\",\"amount\":" + amount
				+ ",\"categoryId\":" + expense.get(0) + ",\"title\":\"지출\"}"))
			.andExpect(status().isCreated());
	}

	// ---- 가입 선물 ----

	@Test
	void signupGiftOnlyOnceAndRewardsRepeatUntilAck() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		// 초기 예산 설정 전이어도 check-in은 된다(어제 보너스만 건너뜀).
		Object giftId = read(checkIn(token)
			.andExpect(jsonPath("$.wallet.balance").value(200))
			.andExpect(jsonPath("$.rewards", hasSize(1)))
			.andExpect(jsonPath("$.rewards[0].reason").value("SIGNUP_GIFT"))
			.andExpect(jsonPath("$.rewards[0].amount").value(200))
			.andExpect(jsonPath("$.rewards[0].refDate").value(nullValue())), "$.rewards[0].id");

		// ack 전에 다시 오면 같은 보상이 또 오지만 지급은 한 번
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(200))
			.andExpect(jsonPath("$.rewards", hasSize(1)))
			.andExpect(jsonPath("$.rewards[0].id").value(giftId));
		ackAll(token);
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(200)).andExpect(jsonPath("$.rewards", hasSize(0)));

		clock.seoul("2026-10-22T09:00");
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(200)).andExpect(jsonPath("$.rewards", hasSize(0)));
	}

	@Test
	void ackIgnoresOtherUsersRewards() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String a = signup();
		String b = signup();
		Object giftId = read(checkIn(a), "$.rewards[0].id");
		mvc.perform(auth(post("/api/v1/coins/rewards/ack"), b, "{\"ids\":[" + giftId + "]}"))
			.andExpect(status().isNoContent());
		checkIn(a).andExpect(jsonPath("$.rewards", hasSize(1))).andExpect(jsonPath("$.rewards[0].id").value(giftId));
	}

	// ---- 출석 ----

	private ResultActions attend(String token) throws Exception {
		return mvc.perform(auth(post("/api/v1/coins/attendance"), token, null)).andExpect(status().isOk());
	}

	private ResultActions attendance(String token) throws Exception {
		return mvc.perform(auth(get("/api/v1/coins/attendance"), token, null)).andExpect(status().isOk());
	}

	@Test
	void attendancePaysOncePerDayWithoutRewardModal() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		attendance(token).andExpect(jsonPath("$.today").value("2026-10-21"))
			.andExpect(jsonPath("$.total").value(0))
			.andExpect(jsonPath("$.checkedToday").value(false))
			.andExpect(jsonPath("$.todayReward").value(5))
			.andExpect(jsonPath("$.todayOutfitId").doesNotExist());

		attend(token).andExpect(jsonPath("$.rewarded").value(5))
			.andExpect(jsonPath("$.outfitId").doesNotExist())
			.andExpect(jsonPath("$.wallet.balance").value(5))
			.andExpect(jsonPath("$.attendance.total").value(1))
			.andExpect(jsonPath("$.attendance.checkedToday").value(true));
		clock.seoul("2026-10-21T23:59");
		attend(token).andExpect(jsonPath("$.rewarded").value(0)).andExpect(jsonPath("$.wallet.balance").value(5));

		mvc.perform(auth(get("/api/v1/coins/ledger"), token, null))
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].reason").value("ATTENDANCE"))
			.andExpect(jsonPath("$.items[0].amount").value(5));
		// 출석 코인은 출석 모달에서 바로 보여 주므로 check-in 모달에는 가입 선물만 온다
		checkIn(token).andExpect(jsonPath("$.rewards", hasSize(1)))
			.andExpect(jsonPath("$.rewards[0].reason").value("SIGNUP_GIFT"));
	}

	@Test
	void thirdDayPays50AndTheSeventhGivesTheCostumeOnceEvenAfterMissingDays() throws Exception {
		clock.seoul("2026-10-01T09:00");
		String token = signup();
		attend(token).andExpect(jsonPath("$.rewarded").value(5));
		clock.seoul("2026-10-02T09:00");
		attend(token).andExpect(jsonPath("$.rewarded").value(5));
		clock.seoul("2026-10-03T09:00");
		attendance(token).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.todayReward").value(50));
		attend(token).andExpect(jsonPath("$.rewarded").value(50)).andExpect(jsonPath("$.wallet.balance").value(60));
		// 빠진 날이 있어도 누적이라 초기화하지 않는다: 10-04~10-08 건너뛰고 4~6번째 출석
		for (String day : new String[] { "09", "10", "11" }) {
			clock.seoul("2026-10-" + day + "T09:00");
			attend(token).andExpect(jsonPath("$.rewarded").value(5)).andExpect(jsonPath("$.outfitId").doesNotExist());
		}
		clock.seoul("2026-10-12T09:00");
		attendance(token).andExpect(jsonPath("$.total").value(6))
			.andExpect(jsonPath("$.todayReward").value(5))
			.andExpect(jsonPath("$.todayOutfitId").value("outfit-06"));
		attend(token).andExpect(jsonPath("$.rewarded").value(5))
			.andExpect(jsonPath("$.outfitId").value("outfit-06"))
			.andExpect(jsonPath("$.attendance.total").value(7));
		// 받은 코스튬은 상점 목록에 보이고, 다시 눌러도 또 주지 않는다
		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(jsonPath("$.items[?(@.id=='outfit-06')].owned").value(true));
		attend(token).andExpect(jsonPath("$.rewarded").value(0)).andExpect(jsonPath("$.outfitId").doesNotExist());
	}

	@Test
	void afterTheFirstSevenDaysEveryThirdAndSeventhDayPays50() throws Exception {
		clock.seoul("2026-10-01T09:00");
		String token = signup();
		int[] expected = { 5, 5, 50, 5, 5, 5, 5, /* 8일째부터 */ 5, 5, 50, 5, 5, 5, 50, 5 };
		for (int i = 0; i < expected.length; i++) {
			clock.seoul(String.format("2026-10-%02dT09:00", i + 1));
			attend(token).andExpect(jsonPath("$.rewarded").value(expected[i]))
				.andExpect(jsonPath("$.attendance.total").value(i + 1));
			if (i + 1 > 7) {
				// 코스튬은 첫 7일에만
				attend(token).andExpect(jsonPath("$.outfitId").doesNotExist());
			}
		}
	}

	// ---- 내역 ----

	@Test
	void ledgerListsMyEntriesNewestFirstAndPages() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		checkIn(token);
		clock.seoul("2026-10-21T12:00");
		mvc.perform(auth(post("/api/v1/outfits/outfit-03/purchase"), token, null)).andExpect(status().isOk());

		// 모달로 보여 주기 전(ack 전)의 가입 선물도 내역에는 있다
		Object purchaseId = read(mvc.perform(auth(get("/api/v1/coins/ledger"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].reason").value("PURCHASE"))
			.andExpect(jsonPath("$.items[0].amount").value(-200))
			.andExpect(jsonPath("$.items[0].outfitId").value("outfit-03"))
			.andExpect(jsonPath("$.items[1].reason").value("SIGNUP_GIFT"))
			.andExpect(jsonPath("$.items[1].amount").value(200))
			.andExpect(jsonPath("$.items[1].outfitId").value(nullValue()))
			.andExpect(jsonPath("$.nextBefore").value(nullValue())), "$.items[0].id");

		mvc.perform(auth(get("/api/v1/coins/ledger?limit=1"), token, null))
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].reason").value("PURCHASE"))
			.andExpect(jsonPath("$.nextBefore").value(purchaseId));
		mvc.perform(auth(get("/api/v1/coins/ledger?limit=1&before=" + purchaseId), token, null))
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].reason").value("SIGNUP_GIFT"))
			.andExpect(jsonPath("$.nextBefore").value(nullValue()));

		mvc.perform(auth(get("/api/v1/coins/ledger?limit=0"), token, null))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
		mvc.perform(auth(get("/api/v1/coins/ledger?limit=101"), token, null)).andExpect(status().isBadRequest());

		// 남의 내역은 보이지 않는다
		String other = signup();
		mvc.perform(auth(get("/api/v1/coins/ledger"), other, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)));
	}

	// ---- 시간 적립 ----

	@Test
	void passiveStartsAtFirstCheckInOnePerHourUpToTen() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		// check-in 전에는 쌓이지 않는다.
		wallet(token).andExpect(jsonPath("$.balance").value(0))
			.andExpect(jsonPath("$.passive.collectable").value(0))
			.andExpect(jsonPath("$.passive.dailyLimit").value(10))
			.andExpect(jsonPath("$.passive.nextAt").value(nullValue()));
		mvc.perform(auth(post("/api/v1/coins/collect"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.collected").value(0));

		clock.seoul("2026-10-21T09:10");
		checkIn(token);
		clock.seoul("2026-10-21T10:09");
		wallet(token).andExpect(jsonPath("$.passive.collectable").value(0))
			.andExpect(jsonPath("$.passive.nextAt").value("2026-10-21T10:10:00+09:00"));

		// 1시간에 1개
		clock.seoul("2026-10-21T10:10");
		wallet(token).andExpect(jsonPath("$.passive.collectable").value(1))
			.andExpect(jsonPath("$.passive.nextAt").value("2026-10-21T11:10:00+09:00"));
		mvc.perform(auth(post("/api/v1/coins/collect"), token, null))
			.andExpect(jsonPath("$.collected").value(1))
			.andExpect(jsonPath("$.wallet.balance").value(201))
			.andExpect(jsonPath("$.wallet.passive.collectable").value(0))
			.andExpect(jsonPath("$.wallet.passive.collectedToday").value(1));

		// 오늘 다시 check-in해도 시작 시각은 그대로
		clock.seoul("2026-10-21T12:30");
		checkIn(token).andExpect(jsonPath("$.wallet.passive.collectable").value(2));

		// 하루 최대 10개(13시간 지났어도 10개, 이미 받은 1개 제외 9개)
		clock.seoul("2026-10-21T22:30");
		wallet(token).andExpect(jsonPath("$.passive.collectable").value(9))
			.andExpect(jsonPath("$.passive.nextAt").value(nullValue()));
		mvc.perform(auth(post("/api/v1/coins/collect"), token, null))
			.andExpect(jsonPath("$.collected").value(9))
			.andExpect(jsonPath("$.wallet.balance").value(210))
			.andExpect(jsonPath("$.wallet.passive.collectedToday").value(10));
		mvc.perform(auth(post("/api/v1/coins/collect"), token, null))
			.andExpect(jsonPath("$.collected").value(0))
			.andExpect(jsonPath("$.wallet.balance").value(210));
	}

	@Test
	void uncollectedPassiveDisappearsAtMidnight() throws Exception {
		clock.seoul("2026-10-21T08:00");
		String token = signup();
		checkIn(token);
		clock.seoul("2026-10-21T23:30");
		wallet(token).andExpect(jsonPath("$.passive.collectable").value(10));

		// 자정이 지나면 받지 않은 코인은 사라지고, 그날 check-in 전까지 쌓이지 않는다.
		clock.seoul("2026-10-22T00:30");
		wallet(token).andExpect(jsonPath("$.passive.collectable").value(0))
			.andExpect(jsonPath("$.passive.collectedToday").value(0))
			.andExpect(jsonPath("$.passive.nextAt").value(nullValue()));
		mvc.perform(auth(post("/api/v1/coins/collect"), token, null)).andExpect(jsonPath("$.collected").value(0));
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(200))
			.andExpect(jsonPath("$.wallet.passive.collectable").value(0))
			.andExpect(jsonPath("$.wallet.passive.nextAt").value("2026-10-22T01:30:00+09:00"));
	}

	@Test
	void passiveNextAtIsNullWhenItWouldPassMidnight() throws Exception {
		clock.seoul("2026-10-21T23:10");
		String token = signup();
		checkIn(token).andExpect(jsonPath("$.wallet.passive.nextAt").value(nullValue()));
	}

	// ---- 어제 예산 보너스 ----

	@Test
	void budgetBonusForKeptYesterdayOnly() throws Exception {
		clock.seoul("2026-10-21T12:00");
		String token = signup();
		setUpBudget(token);
		ackAll(token);

		// 어제(10/21) 0원 = 지킨 날
		clock.seoul("2026-10-22T12:00");
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(205))
			.andExpect(jsonPath("$.rewards", hasSize(1)))
			.andExpect(jsonPath("$.rewards[0].reason").value("BUDGET_BONUS"))
			.andExpect(jsonPath("$.rewards[0].amount").value(5))
			.andExpect(jsonPath("$.rewards[0].refDate").value("2026-10-21"));
		ackAll(token);
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(205)).andExpect(jsonPath("$.rewards", hasSize(0)));

		// 10/22 예산을 넘김 → 10/23에는 보너스 없음
		long budget = recordToday(token);
		spend(token, budget + 1);
		clock.seoul("2026-10-23T12:00");
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(205)).andExpect(jsonPath("$.rewards", hasSize(0)));

		// 10/23 지킴, 10/24 넘김, 10/24엔 앱을 안 열고 10/25에 열면 어제(10/24) 하루치만 본다 → 이틀 전(10/23)은 안 줌
		clock.seoul("2026-10-24T12:00");
		spend(token, 500_000);
		clock.seoul("2026-10-25T12:00");
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(205)).andExpect(jsonPath("$.rewards", hasSize(0)));

		// 10/25 지킴(지출 없음) → 10/26 +5
		clock.seoul("2026-10-26T09:00");
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(210))
			.andExpect(jsonPath("$.rewards[0].refDate").value("2026-10-25"));
	}

	@Test
	void noBudgetBonusWithoutDailyBudgetRecord() throws Exception {
		clock.seoul("2026-10-21T12:00");
		String token = signup();
		// 설정만 하고 하루 예산은 한 번도 계산하지 않음
		mvc.perform(auth(put("/api/v1/budget/settings"), token, SETTINGS)).andExpect(status().isOk());
		ackAll(token);
		clock.seoul("2026-10-22T12:00");
		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(200)).andExpect(jsonPath("$.rewards", hasSize(0)));
	}

	// ---- 코스튬 ----

	@Test
	void concurrentPurchaseChargesOnce() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		checkIn(token); // 200

		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Integer>> results = new ArrayList<>();
		for (int i = 0; i < 2; i++) {
			Callable<Integer> buy = () -> {
				start.await();
				return mvc.perform(auth(post("/api/v1/outfits/outfit-03/purchase"), token, null))
					.andReturn()
					.getResponse()
					.getStatus();
			};
			results.add(pool.submit(buy));
		}
		start.countDown();
		List<Integer> statuses = new ArrayList<>();
		for (Future<Integer> f : results) {
			statuses.add(f.get());
		}
		pool.shutdown();
		assertThat(statuses).containsExactlyInAnyOrder(200, 409);

		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.balance").value(0))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-03')].owned").value(true))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-03')].equipped").value(false));
		wallet(token).andExpect(jsonPath("$.balance").value(0));
		mvc.perform(auth(post("/api/v1/outfits/outfit-03/purchase"), token, null))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("OUTFIT_OWNED"));
		mvc.perform(auth(post("/api/v1/outfits/outfit-04/purchase"), token, null))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("COINS_NOT_ENOUGH"));
	}

	@Test
	void salaryCatAndJackpotAreLevelTwoAndThreeCostumes() throws Exception {
		assertThat(outfits.findById("outfit-02").orElseThrow().isActive()).isTrue();
		assertThat(outfits.findById("outfit-01").orElseThrow().isActive()).isTrue();
		String token = signup();
		checkIn(token);
		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(jsonPath("$.items[1].id").value("outfit-02"))
			.andExpect(jsonPath("$.items[1].name").value("직장냥이"))
			.andExpect(jsonPath("$.items[1].unlockLevel").value(2))
			.andExpect(jsonPath("$.items[1].price").value(nullValue()))
			.andExpect(jsonPath("$.items[1].owned").value(false))
			.andExpect(jsonPath("$.items[2].id").value("outfit-01"))
			.andExpect(jsonPath("$.items[2].unlockLevel").value(3))
			.andExpect(jsonPath("$.items[2].price").value(nullValue()));
		for (String id : List.of("outfit-01", "outfit-02")) {
			mvc.perform(auth(post("/api/v1/outfits/" + id + "/purchase"), token, null))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("OUTFIT_NOT_FOR_SALE"));
			mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":\"" + id + "\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("OUTFIT_LOCKED"));
		}
		wallet(token).andExpect(jsonPath("$.balance").value(200));
	}

	/** V10 전에 잭팟을 산 사람: 레벨이 낮아도 계속 보유하고, 낸 코인을 한 번 돌려받아 모달로 안내받는다. */
	@Test
	void buyersOfLevelCostumesKeepThemAndGetTheirCoinsBack() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		ackAll(token); // 200
		long userId = jdbc.queryForObject("select max(id) from users",
				Long.class);
		// V10 전 두 벌을 산 상황. 구매 전 400코인을 모았고 직장냥이를 적용했다.
		Timestamp bought = Timestamp.from(clock.instant());
		jdbc.update("update coin_wallets set balance = 400 where user_id = ?", userId);
		for (String id : List.of("outfit-01", "outfit-02")) {
			jdbc.update("insert into coin_ledger (user_id, amount, reason, ref_key, notified_at, created_at)"
					+ " values (?, -200, 'PURCHASE', ?, ?, ?)", userId, id, bought, bought);
			jdbc.update("insert into user_outfits (user_id, outfit_id, acquired_at) values (?, ?, ?)", userId, id,
					bought);
			jdbc.update("update coin_wallets set balance = balance - 200 where user_id = ?", userId);
		}
		jdbc.update("update coin_wallets set equipped_outfit_id = 'outfit-02' where user_id = ?", userId);
		wallet(token).andExpect(jsonPath("$.balance").value(0));

		new ResourceDatabasePopulator(new ClassPathResource("db/migration/V10__level_costumes.sql")).execute(dataSource);

		checkIn(token).andExpect(jsonPath("$.wallet.balance").value(400))
			.andExpect(jsonPath("$.wallet.equippedOutfitId").value("outfit-02"))
			.andExpect(jsonPath("$.rewards", hasSize(2)))
			.andExpect(jsonPath("$.rewards[0].reason").value("REFUND"))
			.andExpect(jsonPath("$.rewards[0].amount").value(200))
			.andExpect(jsonPath("$.rewards[1].reason").value("REFUND"))
			.andExpect(jsonPath("$.rewards[1].amount").value(200));
		ackAll(token);
		checkIn(token).andExpect(jsonPath("$.rewards", hasSize(0)));
		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(jsonPath("$.peakLevel").value(1))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-01')].unlockLevel").value(contains(3)))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-01')].owned").value(contains(true)));
		mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":\"outfit-01\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.equippedOutfitId").value("outfit-01"));
	}

	@Test
	void levelCostumesCannotBeBoughtAndEquipNeedsOwnership() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String token = signup();
		checkIn(token);

		// 초기 예산 설정 전: 최고 레벨 1, 기본 캐릭터(costume-lv1) 적용 중
		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(jsonPath("$.balance").value(200))
			.andExpect(jsonPath("$.equippedOutfitId").value(nullValue()))
			.andExpect(jsonPath("$.peakLevel").value(1))
			.andExpect(jsonPath("$.items", hasSize(15)))
			.andExpect(jsonPath("$.items[0].id").value("costume-lv1"))
			.andExpect(jsonPath("$.items[0].price").value(nullValue()))
			.andExpect(jsonPath("$.items[0].owned").value(true))
			.andExpect(jsonPath("$.items[0].equipped").value(true))
			.andExpect(jsonPath("$.items[1].owned").value(false))
			.andExpect(jsonPath("$.items[7].id").value("outfit-03"))
			.andExpect(jsonPath("$.items[7].price").value(200));

		for (String id : List.of("costume-lv1", "costume-lv2", "costume-lv5", "outfit-01", "no-such-outfit")) {
			mvc.perform(auth(post("/api/v1/outfits/" + id + "/purchase"), token, null))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("OUTFIT_NOT_FOR_SALE"));
		}
		wallet(token).andExpect(jsonPath("$.balance").value(200));

		for (String id : List.of("costume-lv2", "outfit-01", "no-such-outfit")) {
			mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":\"" + id + "\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("OUTFIT_LOCKED"));
		}

		// 사도 바로 적용되지 않고, 적용하면 하나만 equipped
		mvc.perform(auth(post("/api/v1/outfits/outfit-03/purchase"), token, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.balance").value(0))
			.andExpect(jsonPath("$.equippedOutfitId").value(nullValue()));
		mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":\"outfit-03\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.equippedOutfitId").value("outfit-03"))
			.andExpect(jsonPath("$.items[?(@.equipped == true)].id").value(contains("outfit-03")));
		wallet(token).andExpect(jsonPath("$.equippedOutfitId").value("outfit-03"));
		mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":null}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.equippedOutfitId").value(nullValue()))
			.andExpect(jsonPath("$.items[?(@.equipped == true)].id").value(contains("costume-lv1")));
	}

	@Test
	void peakLevelStaysAfterLevelDrops() throws Exception {
		clock.seoul("2026-10-01T12:00");
		String token = signup();
		setUpBudget(token);

		// 10/1~10/7 7일 지킴 → 105점(Lv.2)
		clock.seoul("2026-10-08T12:00");
		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(jsonPath("$.peakLevel").value(2))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-02')].owned").value(true))
			.andExpect(jsonPath("$.items[?(@.id == 'costume-lv3')].owned").value(false));
		mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":\"outfit-02\"}"))
			.andExpect(status().isOk());

		// 10/8·10/9 넘김 → 5점(Lv.1)으로 내려가도 Lv.2 코스튬은 그대로
		spend(token, 500_000);
		clock.seoul("2026-10-09T12:00");
		spend(token, 300_000);
		clock.seoul("2026-10-10T12:00");
		mvc.perform(auth(get("/api/v1/budget/today"), token, null)).andExpect(jsonPath("$.characterPoints").value(5));
		mvc.perform(auth(get("/api/v1/outfits"), token, null))
			.andExpect(jsonPath("$.peakLevel").value(2))
			.andExpect(jsonPath("$.equippedOutfitId").value("outfit-02"))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-02')].owned").value(true))
			.andExpect(jsonPath("$.items[?(@.id == 'outfit-02')].equipped").value(true));
		mvc.perform(auth(put("/api/v1/outfits/equipped"), token, "{\"outfitId\":\"outfit-02\"}"))
			.andExpect(status().isOk());
	}

	// ---- 추천 코드 ----

	@Test
	void referralRewardsBothOnceAndRejectsOwnCode() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String a = signup();
		String b = signup();
		String c = signup();
		String codeA = (String) read(mvc.perform(auth(get("/api/v1/referrals/me"), a, null))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.code").value(matchesPattern("[A-HJKMNP-Z2-9]{8}")))
			.andExpect(jsonPath("$.invitedCount").value(0))
			.andExpect(jsonPath("$.registered").value(false))
			.andExpect(jsonPath("$.rewardAmount").value(100)), "$.code");
		mvc.perform(auth(get("/api/v1/referrals/me"), a, null)).andExpect(jsonPath("$.code").value(codeA));
		String codeC = (String) read(mvc.perform(auth(get("/api/v1/referrals/me"), c, null)), "$.code");

		// 내 코드·없는 코드·빈 코드는 400
		for (String code : List.of(codeA, "  " + codeA.toLowerCase() + " ", "", "AAAA")) {
			mvc.perform(auth(post("/api/v1/referrals"), a, "{\"code\":\"" + code + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("REFERRAL_CODE_INVALID"));
		}

		// 대소문자·앞뒤 공백 무시. 등록한 사람은 응답으로 바로 받는다(ack 불필요).
		mvc.perform(auth(post("/api/v1/referrals"), b, "{\"code\":\"  " + codeA.toLowerCase() + " \"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.amount").value(100))
			.andExpect(jsonPath("$.wallet.balance").value(100));
		mvc.perform(auth(post("/api/v1/referrals"), b, "{\"code\":\"" + codeC + "\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("REFERRAL_ALREADY"));
		mvc.perform(auth(get("/api/v1/referrals/me"), b, null)).andExpect(jsonPath("$.registered").value(true));
		checkIn(b).andExpect(jsonPath("$.wallet.balance").value(300))
			.andExpect(jsonPath("$.rewards[*].reason").value(contains("SIGNUP_GIFT")));

		// 코드 주인은 다음 check-in에서 모달(오래된 순: 추천 보상이 가입 선물보다 먼저 생김)
		mvc.perform(auth(get("/api/v1/referrals/me"), a, null)).andExpect(jsonPath("$.invitedCount").value(1));
		checkIn(a).andExpect(jsonPath("$.wallet.balance").value(300))
			.andExpect(jsonPath("$.rewards[*].reason").value(contains("REFERRAL_INVITER", "SIGNUP_GIFT")))
			.andExpect(jsonPath("$.rewards[0].amount").value(100));

		// 기간·인원 제한 없음
		mvc.perform(auth(post("/api/v1/referrals"), c, "{\"code\":\"" + codeA + "\"}")).andExpect(status().isOk());
		mvc.perform(auth(get("/api/v1/referrals/me"), a, null)).andExpect(jsonPath("$.invitedCount").value(2));
	}

	@Test
	void referralAfterInviterDeletesAccount() throws Exception {
		clock.seoul("2026-10-21T09:00");
		String a = signup();
		String b = signup();
		String c = signup();
		String codeA = (String) read(mvc.perform(auth(get("/api/v1/referrals/me"), a, null)), "$.code");
		String codeC = (String) read(mvc.perform(auth(get("/api/v1/referrals/me"), c, null)), "$.code");
		mvc.perform(auth(post("/api/v1/referrals"), b, "{\"code\":\"" + codeA + "\"}")).andExpect(status().isOk());
		checkIn(a);

		mvc.perform(auth(delete("/api/v1/me"), a, "{\"password\":\"abcd1234\"}")).andExpect(status().isNoContent());

		// 초대한 사람이 탈퇴해도 등록한 사람의 기록·코인은 남고, 다시 등록할 수 없다.
		mvc.perform(auth(get("/api/v1/referrals/me"), b, null)).andExpect(jsonPath("$.registered").value(true));
		wallet(b).andExpect(jsonPath("$.balance").value(100));
		mvc.perform(auth(post("/api/v1/referrals"), b, "{\"code\":\"" + codeC + "\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("REFERRAL_ALREADY"));
		// 탈퇴한 사람의 코드는 없는 코드
		mvc.perform(auth(post("/api/v1/referrals"), c, "{\"code\":\"" + codeA + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("REFERRAL_CODE_INVALID"));
	}
}
