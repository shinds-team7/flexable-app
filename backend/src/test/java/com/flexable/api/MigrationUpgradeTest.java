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
		assertThat(flyway.migrate().targetSchemaVersion).isEqualTo("25");
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
		assertThat(flyway.migrate().migrationsExecuted).isEqualTo(12);
		flyway.validate();
		assertThat(jdbc.queryForObject("select checksum from flyway_schema_history where version='13'", Integer.class))
			.isEqualTo(deployedChecksum);
		assertThat(jdbc.queryForObject("select sort_order from categories where id=1", Long.class)).isEqualTo(1L);
		assertThat(jdbc.queryForObject("select amount from transactions where category_id=1", Long.class)).isEqualTo(12000L);
		assertThat(jdbc.queryForList("select outfit_id from user_outfits where user_id=1 order by outfit_id", String.class))
			.containsExactly("outfit-01", "outfit-02", "outfit-05");
		assertThat(jdbc.queryForObject("select count(*) from user_outfits where user_id=2", Integer.class)).isZero();
		// V22: 직장냥이·잭팟은 200코인 상품, 새 5단계는 꺼 둔 자리. V24·V25: 그중 Lv.2~4만 켬
		assertThat(jdbc.queryForObject("select price from outfits where id='outfit-02'", Integer.class)).isEqualTo(200);
		assertThat(jdbc.queryForObject("select unlock_level from outfits where id='outfit-01'", Integer.class)).isNull();
		assertThat(jdbc.queryForObject("select name from outfits where id='costume-lv6'", String.class)).isEqualTo("왕족");
		assertThat(jdbc.queryForObject("select count(*) from outfits where unlock_level >= 5 and active", Integer.class)).isZero();
		assertThat(jdbc.queryForList("select id from outfits where unlock_level between 2 and 4 and active order by id", String.class))
			.containsExactly("costume-lv2", "costume-lv3", "costume-lv4");
		assertExtensionsAndWitchCat(jdbc);
		// V19 업데이트 기념 200코인: 지갑이 있던 사용자에게 한 번, 모달로 안내할 내역(notified_at 비움)과 함께
		assertThat(jdbc.queryForObject("select balance from coin_wallets where user_id=1", Long.class)).isEqualTo(250L);
		assertThat(jdbc.queryForObject("select count(*) from coin_ledger where user_id=1 and reason='SIGNUP_GIFT' "
			+ "and ref_key='update-1.6.0' and amount=200 and notified_at is null", Integer.class)).isEqualTo(1);
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
