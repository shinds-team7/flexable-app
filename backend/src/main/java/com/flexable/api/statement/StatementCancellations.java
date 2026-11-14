package com.flexable.api.statement;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 결제했다가 취소된 거래 쌍을 뺀다(policies §9, 2026-11-14 사용자 결정).
 * 출금 뒤 31일 안에 같은 적요·같은 내용·같은 금액의 입금이 오면 취소로 보고 둘 다 저장하지 않는다.
 * 카드 가승인·승인 취소가 지출과 수입으로 함께 쌓이지 않게 하려는 것이다.
 * 입금 하나는 그보다 앞선(같은 시각 포함) 짝 없는 출금 중 가장 가까운 하나와만 짝짓는다.
 */
final class StatementCancellations {

	static final Duration WINDOW = Duration.ofDays(31);

	private StatementCancellations() {
	}

	static List<StatementRow> withoutPairs(List<StatementRow> rows) {
		// 시각 순(같은 시각이면 출금 먼저)으로 본다. 내역서가 최신순이어도 결과 순서는 원래 순서를 지킨다.
		List<Integer> order = new ArrayList<>();
		for (int i = 0; i < rows.size(); i++) {
			order.add(i);
		}
		order.sort(Comparator.<Integer, java.time.LocalDateTime>comparing(i -> rows.get(i).at())
			.thenComparing(i -> rows.get(i).deposit() > 0));
		Set<Integer> removed = new HashSet<>();
		for (int pos = 0; pos < order.size(); pos++) {
			int d = order.get(pos);
			StatementRow deposit = rows.get(d);
			if (deposit.deposit() <= 0) {
				continue;
			}
			for (int back = pos - 1; back >= 0; back--) {
				int w = order.get(back);
				StatementRow withdrawal = rows.get(w);
				if (Duration.between(withdrawal.at(), deposit.at()).compareTo(WINDOW) > 0) {
					break;
				}
				if (!removed.contains(w) && withdrawal.withdrawal() == deposit.deposit()
						&& Objects.equals(withdrawal.summary(), deposit.summary())
						&& Objects.equals(withdrawal.content(), deposit.content())) {
					removed.add(w);
					removed.add(d);
					break;
				}
			}
		}
		List<StatementRow> kept = new ArrayList<>();
		for (int i = 0; i < rows.size(); i++) {
			if (!removed.contains(i)) {
				kept.add(rows.get(i));
			}
		}
		return kept;
	}
}
