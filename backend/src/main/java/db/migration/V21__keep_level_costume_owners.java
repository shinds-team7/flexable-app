package db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * 직장냥이(outfit-02)·잭팟(outfit-01)을 레벨 코스튬(Lv.2·Lv.3)에서 200코인 상품으로 바꾸기 전(V22),
 * 이미 레벨로 열어 둔 사용자에게 보유 기록(user_outfits)을 넣어 계속 무료로 쓰게 한다(docs/coin-plan.md).
 * 최고 점수 100점 이상이면 직장냥이, 200점 이상이면 잭팟이다. 점수 규칙은 CharacterScore와 같고 상한만 다르다:
 * 상한이 200에서 500으로 늘어도 100점·200점에 처음 닿는 날은 같아서 이 판정은 예전 규칙과 같은 사람을 고른다.
 * 점수는 어제까지 반영한다(오늘은 내일 반영). 이미 산 사람은 user_outfits에 있어 건드리지 않는다.
 */
public class V21__keep_level_costume_owners extends BaseJavaMigration {

	private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
	private static final int UP = 20;
	private static final int ATTEND = 10;
	private static final int DOWN = 50;
	private static final int CAP = 500;

	@Override
	public void migrate(Context context) throws Exception {
		Connection c = context.getConnection();
		LocalDate today = LocalDate.now(ZONE);
		List<Long> users = new ArrayList<>();
		try (PreparedStatement ps = c.prepareStatement("SELECT DISTINCT user_id FROM daily_budgets");
				ResultSet rs = ps.executeQuery()) {
			while (rs.next()) {
				users.add(rs.getLong(1));
			}
		}
		Timestamp now = Timestamp.from(Instant.now());
		for (long userId : users) {
			int peak = peak(c, userId, today);
			if (peak >= 100) {
				grant(c, userId, "outfit-02", now);
			}
			if (peak >= 200) {
				grant(c, userId, "outfit-01", now);
			}
		}
	}

	private static void grant(Connection c, long userId, String outfitId, Timestamp now) throws Exception {
		try (PreparedStatement ps = c.prepareStatement(
				"INSERT INTO user_outfits (user_id, outfit_id, acquired_at) SELECT ?, ?, ? FROM (SELECT 1) x"
						+ " WHERE NOT EXISTS (SELECT 1 FROM user_outfits WHERE user_id = ? AND outfit_id = ?)")) {
			ps.setLong(1, userId);
			ps.setString(2, outfitId);
			ps.setTimestamp(3, now);
			ps.setLong(4, userId);
			ps.setString(5, outfitId);
			ps.executeUpdate();
		}
	}

	/** CharacterScore.compute와 같은 규칙으로 지금까지의 최고 점수를 낸다. */
	private static int peak(Connection c, long userId, LocalDate today) throws Exception {
		NavigableMap<LocalDate, Long> budgets = new TreeMap<>();
		try (PreparedStatement ps = c.prepareStatement(
				"SELECT budget_date, daily_budget FROM daily_budgets WHERE user_id = ?")) {
			ps.setLong(1, userId);
			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					budgets.put(rs.getDate(1).toLocalDate(), rs.getLong(2));
				}
			}
		}
		if (budgets.isEmpty()) {
			return 0;
		}
		Map<LocalDate, Long> spent = new HashMap<>();
		try (PreparedStatement ps = c.prepareStatement(
				"SELECT occurred_at, amount FROM transactions WHERE user_id = ? AND type = 'EXPENSE'"
						+ " AND from_fixed = FALSE AND occurred_at >= ?")) {
			ps.setLong(1, userId);
			// occurred_at은 UTC로 저장한다(hibernate.jdbc.time_zone)
			ps.setObject(2, budgets.firstKey().atStartOfDay(ZONE).toInstant().atZone(ZoneId.of("UTC")).toLocalDateTime());
			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					LocalDate day = rs.getObject(1, java.time.LocalDateTime.class)
						.atZone(ZoneId.of("UTC"))
						.withZoneSameInstant(ZONE)
						.toLocalDate();
					spent.merge(day, rs.getLong(2), Long::sum);
				}
			}
		}
		Set<LocalDate> attended = new HashSet<>();
		try (PreparedStatement ps = c.prepareStatement(
				"SELECT ref_key FROM coin_ledger WHERE user_id = ? AND reason = 'ATTENDANCE'")) {
			ps.setLong(1, userId);
			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					attended.add(LocalDate.parse(rs.getString(1)));
				}
			}
		}
		int points = 0;
		int peak = 0;
		for (LocalDate d = budgets.firstKey(); d.isBefore(today); d = d.plusDays(1)) {
			var budget = budgets.floorEntry(d);
			boolean kept = budget != null && spent.getOrDefault(d, 0L) <= budget.getValue();
			int change = (attended.contains(d) ? ATTEND : 0) + (kept ? UP : -DOWN);
			points = Math.max(0, Math.min(CAP, points + change));
			peak = Math.max(peak, points);
		}
		return peak;
	}
}
