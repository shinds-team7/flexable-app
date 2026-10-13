package db.migration;

import java.sql.PreparedStatement;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * 고정지출 자동 기록 도입 전에 예산을 설정한 사용자에게 도입 시각을 넣는다. 앱은 시각을 UTC로 저장하므로(hibernate.jdbc.time_zone)
 * DB 세션 시간대와 무관하게 UTC 값을 직접 넣는다.
 */
public class V3__fixed_posting_cutover extends BaseJavaMigration {

	@Override
	public void migrate(Context context) throws Exception {
		try (PreparedStatement ps = context.getConnection()
			.prepareStatement("UPDATE budget_settings SET fixed_posting_since = ?")) {
			ps.setObject(1, LocalDateTime.now(ZoneOffset.UTC));
			ps.executeUpdate();
		}
	}
}
