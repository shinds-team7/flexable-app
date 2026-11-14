package com.flexable.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import db.migration.V3__fixed_posting_cutover;

class MigrationUpgradeTest {

	@TempDir
	Path temporary;

	private DriverManagerDataSource database() {
		return new DriverManagerDataSource("jdbc:h2:mem:migration-" + UUID.randomUUID()
			+ ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
	}

	private Flyway current(DriverManagerDataSource database) {
		return Flyway.configure().dataSource(database).locations("classpath:db/migration").load();
	}

	@Test
	void freshDatabaseIncludesWitchCatAndBothUiExtensions() {
		var database = database();
		var flyway = current(database);
		assertThat(flyway.migrate().targetSchemaVersion).isEqualTo("30");
		flyway.validate();
		assertExtensionsAndWitchCat(new JdbcTemplate(database));
	}

	@Test
	void deployedWitchCatV13UpgradesWithoutRepairOrLosingExistingData() throws Exception {
		// 운영에 적용된 V13은 별도 fixture로 고정한다. 최신 V13을 복사하면 체크섬 회귀를 놓친다.
		Path deployed = Files.createDirectory(temporary.resolve("deployed"));
		try (var files = Files.list(Path.of("src/main/resources/db/migration"))) {
			for (Path source : files.filter(path -> path.toString().endsWith(".sql")).toList()) {
				int version = Integer.parseInt(source.getFileName().toString().split("__")[0].substring(1));
				if (version <= 12) Files.copy(source, deployed.resolve(source.getFileName()));
			}
		}
		try (var source = getClass().getResourceAsStream("/deployed-migrations/V13__witch_cat_outfit.sql")) {
			Files.copy(source, deployed.resolve("V13__witch_cat_outfit.sql"));
		}
		var database = database();
		Flyway.configure().dataSource(database).locations("filesystem:" + deployed.toAbsolutePath())
			.javaMigrations(new V3__fixed_posting_cutover()).load().migrate();
		var jdbc = new JdbcTemplate(database);
		Integer deployedChecksum = jdbc.queryForObject(
			"select checksum from flyway_schema_history where version='13'", Integer.class);
		jdbc.update("insert into users(id,email,password_hash,agreed_at,created_at) "
			+ "values(1,'migration@example.com','unused',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
		jdbc.update("insert into categories(id,user_id,type,name,color,icon,is_default,created_at) "
			+ "values(1,1,'EXPENSE','식비','#0046FF','restaurant',true,CURRENT_TIMESTAMP)");
		jdbc.update("insert into transactions(user_id,category_id,type,amount,title,occurred_at,created_at,updated_at) "
			+ "values(1,1,'EXPENSE',12000,'점심',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
		jdbc.update("insert into user_outfits(user_id,outfit_id,acquired_at) values(1,'outfit-05',CURRENT_TIMESTAMP)");
		jdbc.update("insert into coin_wallets(user_id,balance,created_at) values(1,50,CURRENT_TIMESTAMP)");
		// V21: 오래전부터 예산을 지킨 사용자 1은 직장냥이·잭팟을 레벨로 열어 둔 상태, 막 시작한 사용자 2는 아무것도 못 연 상태
		jdbc.update("insert into daily_budgets(user_id,budget_date,daily_budget) values(1,DATE '2026-01-01',30000)");
		jdbc.update("insert into users(id,email,password_hash,agreed_at,created_at) "
			+ "values(2,'new@example.com','unused',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
		jdbc.update("insert into daily_budgets(user_id,budget_date,daily_budget) values(2,CURRENT_DATE - 2,30000)");

		var flyway = current(database);
		assertThat(flyway.migrate().migrationsExecuted).isEqualTo(17);
		flyway.validate();
		assertThat(jdbc.queryForObject("select checksum from flyway_schema_history where version='13'", Integer.class))
			.isEqualTo(deployedChecksum);
		assertThat(jdbc.queryForObject("select sort_order from categories where id=1", Long.class)).isEqualTo(1L);
		assertThat(jdbc.queryForObject("select amount from transactions where category_id=1", Long.class)).isEqualTo(12000L);
		assertThat(jdbc.queryForList("select outfit_id from user_outfits where user_id=1 order by outfit_id", String.class))
			.containsExactly("outfit-01", "outfit-02", "outfit-05");
		assertThat(jdbc.queryForObject("select count(*) from user_outfits where user_id=2", Integer.class)).isZero();
		assertThat(jdbc.queryForList("select day_weights_chosen_at from budget_settings")).isEmpty();
		// V22: 직장냥이·잭팟은 200코인 상품, 새 5단계는 꺼 둔 자리. V24~V26: 그중 Lv.2~6을 켬
		assertThat(jdbc.queryForObject("select price from outfits where id='outfit-02'", Integer.class)).isEqualTo(200);
		assertThat(jdbc.queryForObject("select unlock_level from outfits where id='outfit-01'", Integer.class)).isNull();
		assertThat(jdbc.queryForObject("select name from outfits where id='costume-lv6'", String.class)).isEqualTo("왕족");
		assertThat(jdbc.queryForList("select id from outfits where unlock_level between 2 and 6 and active order by id", String.class))
			.containsExactly("costume-lv2", "costume-lv3", "costume-lv4", "costume-lv5", "costume-lv6");
		assertExtensionsAndWitchCat(jdbc);
		// V19 업데이트 기념 200코인: 지갑이 있던 사용자에게 한 번, 모달로 안내할 내역(notified_at 비움)과 함께
		assertThat(jdbc.queryForObject("select balance from coin_wallets where user_id=1", Long.class)).isEqualTo(250L);
		assertThat(jdbc.queryForObject("select count(*) from coin_ledger where user_id=1 and reason='SIGNUP_GIFT' "
			+ "and ref_key='update-1.6.0' and amount=200 and notified_at is null", Integer.class)).isEqualTo(1);
		assertThat(flyway.migrate().migrationsExecuted).isZero();
	}

	@Test
	void restoresMissingFirstWeekCostumeWithoutChangingPriorRewardsOrIneligibleUsers() {
		var database = database();
		Flyway.configure().dataSource(database).locations("classpath:db/migration").target("27").load().migrate();
		var jdbc = new JdbcTemplate(database);
		for (int user = 1; user <= 4; user++) {
			jdbc.update("insert into users(id,email,password_hash,agreed_at,created_at) "
				+ "values(?,?,'unused',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", user, "attendance" + user + "@example.com");
			jdbc.update("insert into coin_wallets(user_id,balance,created_at) values(?,35,CURRENT_TIMESTAMP)", user);
			int days = user == 2 ? 6 : user == 3 ? 8 : 7;
			for (int day = 1; day <= days; day++) {
				jdbc.update("insert into coin_ledger(user_id,amount,reason,ref_key,created_at) "
					+ "values(?,?,'ATTENDANCE',?,CURRENT_TIMESTAMP)", user, day == 7 ? 0 : 5, "2026-11-0" + day);
			}
		}
		// 옛 출석 보상을 받은 7일 달성자와, 7일 미만인데 낚시 고양이를 산 회원을 구분한다.
		jdbc.update("insert into user_outfits(user_id,outfit_id,acquired_at) values(1,'outfit-07',TIMESTAMP '2026-11-01 00:00:00')");
		jdbc.update("insert into user_outfits(user_id,outfit_id,acquired_at) values(2,'outfit-07',CURRENT_TIMESTAMP)");
		jdbc.update("insert into user_outfits(user_id,outfit_id,acquired_at) values(3,'outfit-06',TIMESTAMP '2026-11-02 00:00:00')");
		// 출석이 아닌 내역을 합쳐 7개가 되어도 출석 조건을 채운 것은 아니다.
		jdbc.update("insert into coin_ledger(user_id,amount,reason,ref_key,created_at) values(2,200,'SIGNUP_GIFT','once',CURRENT_TIMESTAMP)");
		var oldRewards = jdbc.queryForList("select * from coin_ledger order by id");
		var oldWallets = jdbc.queryForList("select * from coin_wallets order by user_id");
		var oldOutfits = jdbc.queryForList("select * from user_outfits order by user_id,outfit_id");
		var flyway = current(database);
		assertThat(flyway.migrate().migrationsExecuted).isEqualTo(3);
		flyway.validate();
		assertThat(jdbc.queryForList("select user_id from user_outfits where outfit_id='outfit-06' order by user_id", Long.class))
			.containsExactly(1L, 3L, 4L);
		assertThat(jdbc.queryForList("select * from user_outfits order by user_id,outfit_id")).containsAll(oldOutfits);
		assertThat(jdbc.queryForList("select * from coin_ledger order by id")).isEqualTo(oldRewards);
		assertThat(jdbc.queryForList("select * from coin_wallets order by user_id")).isEqualTo(oldWallets);
		assertThat(flyway.migrate().migrationsExecuted).isZero();
	}

	@Test
	void categoryRefreshRenamesOldDefaultsAddsMissingAndKeepsRecords() {
		var database = database();
		Flyway.configure().dataSource(database).locations("classpath:db/migration").target("29").load().migrate();
		var jdbc = new JdbcTemplate(database);
		for (int user = 1; user <= 2; user++) {
			jdbc.update("insert into users(id,email,password_hash,agreed_at,created_at) "
				+ "values(?,?,'unused',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", user, "category" + user + "@example.com");
		}
		// 사용자 1: 옛 기본 목록 그대로. 사용자 2: '카페'를 직접 만들어 두었고 '건강'도 있고 '문화·여가'는 지웠다.
		String[][] old = { { "식비", "EXPENSE" }, { "카페·간식", "EXPENSE" }, { "쇼핑", "EXPENSE" }, { "교통", "EXPENSE" },
				{ "문화·여가", "EXPENSE" }, { "생활·마트", "EXPENSE" }, { "고정지출", "EXPENSE" }, { "기타", "EXPENSE" },
				{ "급여", "INCOME" }, { "용돈", "INCOME" }, { "기타 수입", "INCOME" } };
		long id = 1;
		for (int i = 0; i < old.length; i++) {
			jdbc.update("insert into categories(id,user_id,type,name,color,icon,is_default,sort_order,created_at) "
				+ "values(?,1,?,?,'#12B76A','cart',true,?,CURRENT_TIMESTAMP)", id++, old[i][1], old[i][0], i);
		}
		String[] second = { "식비", "카페·간식", "카페", "건강", "생활·마트", "기타" };
		for (int i = 0; i < second.length; i++) {
			jdbc.update("insert into categories(id,user_id,type,name,color,icon,is_default,sort_order,created_at) "
				+ "values(?,2,'EXPENSE',?,'#12B76A','cart',?,?,CURRENT_TIMESTAMP)", id++, second[i], !second[i].equals("카페"), i);
		}
		jdbc.update("insert into transactions(user_id,category_id,type,amount,title,occurred_at,created_at,updated_at) "
			+ "values(1,6,'EXPENSE',3000,'CU 광운',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");

		var flyway = current(database);
		assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);
		flyway.validate();
		String order = "select name from categories where user_id=? and type=? order by sort_order, id";
		assertThat(jdbc.queryForList(order, String.class, 1, "EXPENSE")).containsExactly("식비", "카페", "쇼핑", "교통",
				"여가", "생활", "고정지출", "주거", "통신", "건강", "교육", "구독", "기타");
		assertThat(jdbc.queryForList(order, String.class, 1, "INCOME")).containsExactly("급여", "용돈", "금융수입", "환급",
				"지원금", "기타 수입");
		// 이미 있는 이름은 바꾸지도 더하지도 않는다. 지운 '문화·여가' 대신 '여가'는 새로 생기지 않는다(새 목록에 없던 이름만 더함).
		assertThat(jdbc.queryForList(order, String.class, 2, "EXPENSE")).containsExactly("식비", "카페·간식", "카페", "건강",
				"생활", "주거", "통신", "교육", "구독", "기타");
		assertThat(jdbc.queryForList(order, String.class, 2, "INCOME")).containsExactly("금융수입", "환급", "지원금");
		// 이름만 바뀌고 거래는 같은 카테고리에 남는다
		assertThat(jdbc.queryForObject("select c.name from transactions t join categories c on c.id=t.category_id",
				String.class)).isEqualTo("생활");
		assertThat(flyway.migrate().migrationsExecuted).isZero();
	}

	private void assertExtensionsAndWitchCat(JdbcTemplate jdbc) {
		assertThat(jdbc.queryForObject("select name from outfits where id='outfit-05'", String.class)).isEqualTo("고양마녀");
		assertThat(jdbc.queryForObject("select price from outfits where id='outfit-05'", Integer.class)).isEqualTo(200);
		assertThat(jdbc.queryForObject("select active from outfits where id='outfit-05'", Boolean.class)).isTrue();
		assertThat(jdbc.queryForObject("select name from outfits where id='outfit-07'", String.class)).isEqualTo("달밤 낚시 고양이");
		assertThat(jdbc.queryForObject("select price from outfits where id='outfit-07'", Integer.class)).isEqualTo(200);
		assertThat(jdbc.queryForObject("select active from outfits where id='outfit-07'", Boolean.class)).isTrue();
		assertThat(jdbc.queryForObject("select name from outfits where id='outfit-08'", String.class)).isEqualTo("산타냥이");
		assertThat(jdbc.queryForObject("select price from outfits where id='outfit-08'", Integer.class)).isEqualTo(200);
		assertThat(jdbc.queryForObject("select active from outfits where id='outfit-08'", Boolean.class)).isTrue();
		jdbc.queryForList("select sort_order from categories");
		assertThat(jdbc.queryForObject("select count(*) from scheduled_expenses", Integer.class)).isZero();
	}
}
