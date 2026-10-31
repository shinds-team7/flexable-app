package com.flexable.api.coin;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.BudgetService;
import com.flexable.api.coin.CoinDtos.AttendResponse;
import com.flexable.api.coin.CoinDtos.Attendance;
import com.flexable.api.coin.CoinDtos.CheckInResponse;
import com.flexable.api.coin.CoinDtos.CollectResponse;
import com.flexable.api.coin.CoinDtos.LedgerEntry;
import com.flexable.api.coin.CoinDtos.LedgerPage;
import com.flexable.api.coin.CoinDtos.Passive;
import com.flexable.api.coin.CoinDtos.Reward;
import com.flexable.api.coin.CoinDtos.Wallet;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.Times;
import com.flexable.api.config.AppProperties;
import com.flexable.api.outfit.UserOutfit;
import com.flexable.api.outfit.UserOutfitRepository;

/**
 * 앱 안에서만 쓰는 코인. 규칙은 docs/coin-plan.md §1, API는 docs/API.md "코인·코스튬".
 * 잔액을 바꾸는 요청은 지갑 행을 잠그고, 모든 지급은 coin_ledger (사유, ref_key) 유니크로 한 번만 한다.
 */
@Service
public class CoinService {

	public static final int SIGNUP_GIFT = 200;
	public static final int BUDGET_BONUS = 5;
	public static final int PASSIVE_LIMIT = 10;
	static final Duration PASSIVE_EVERY = Duration.ofHours(1);
	public static final int ATTENDANCE_REWARD = 5;
	/** 누적 출석 보상: 3일째, 그리고 8일째부터 7일 주기의 3·7번째 날 */
	public static final int ATTENDANCE_MILESTONE_REWARD = 50;
	public static final int ATTENDANCE_CYCLE = 7;
	/** 누적 7일째에 한 번만 주는 코스튬. 상점에서는 팔지 않는다(V16) */
	public static final String ATTENDANCE_OUTFIT = "outfit-06";
	public static final String ONCE = "once";
	public static final int LEDGER_DEFAULT_LIMIT = 30;
	public static final int LEDGER_MAX_LIMIT = 100;

	private final CoinWalletRepository wallets;
	private final CoinLedgerRepository ledger;
	private final BudgetService budget;
	private final UserOutfitRepository userOutfits;
	private final Clock clock;
	private final ZoneId zone;

	public CoinService(CoinWalletRepository wallets, CoinLedgerRepository ledger, BudgetService budget,
			UserOutfitRepository userOutfits, Clock clock, AppProperties props) {
		this.wallets = wallets;
		this.ledger = ledger;
		this.budget = budget;
		this.userOutfits = userOutfits;
		this.clock = clock;
		this.zone = props.zoneId();
	}

	/** 앱을 열 때·앞으로 돌아올 때. 가입 선물, 어제 예산 보너스(그날 첫 요청에서 어제 하루치만), 시간 적립 시작. */
	@Transactional
	public CheckInResponse checkIn(long userId) {
		LocalDate today = today();
		CoinWallet w = lockWallet(userId);
		post(w, CoinReason.SIGNUP_GIFT, ONCE, SIGNUP_GIFT, false);
		if (!today.equals(w.getPassiveDate())) {
			w.startPassive(today, clock.instant());
			LocalDate yesterday = today.minusDays(1);
			if (budget.keptBudget(userId, yesterday)) {
				post(w, CoinReason.BUDGET_BONUS, yesterday.toString(), BUDGET_BONUS, false);
			}
		}
		List<Reward> rewards = ledger.findUnnotified(userId).stream().map(this::toReward).toList();
		return new CheckInResponse(view(w), rewards);
	}

	@Transactional
	public void ack(long userId, List<Long> ids) {
		if (ids != null && !ids.isEmpty()) {
			ledger.markNotified(userId, ids, clock.instant());
		}
	}

	@Transactional(readOnly = true)
	public Wallet wallet(long userId) {
		return wallets.findById(userId)
			.map(this::view)
			.orElseGet(() -> new Wallet(0, new Passive(0, 0, PASSIVE_LIMIT, null), null));
	}

	/** 오늘 쌓인 시간 적립을 받는다. 받을 게 없으면 0. */
	@Transactional
	public CollectResponse collect(long userId) {
		CoinWallet w = lockWallet(userId);
		int accrued = accrued(w);
		int collectable = accrued - collectedToday(w);
		if (collectable <= 0) {
			return new CollectResponse(0, view(w));
		}
		post(w, CoinReason.PASSIVE, today() + "#" + accrued, collectable, true);
		w.collectPassive(accrued);
		return new CollectResponse(collectable, view(w));
	}

	@Transactional(readOnly = true)
	public Attendance attendance(long userId) {
		return attendance(userId, today());
	}

	/** 오늘 출석. 이미 했으면 아무것도 주지 않고 rewarded 0. 받은 코인·코스튬은 출석 모달에서 바로 보여 주므로 check-in 모달로 보내지 않는다. */
	@Transactional
	public AttendResponse attend(long userId) {
		LocalDate today = today();
		CoinWallet w = lockWallet(userId);
		Attendance before = attendance(userId, today);
		if (before.checkedToday()) {
			return new AttendResponse(0, null, before, view(w));
		}
		post(w, CoinReason.ATTENDANCE, today.toString(), before.todayReward(), true);
		String outfit = before.todayOutfitId();
		if (outfit != null) {
			userOutfits.save(new UserOutfit(userId, outfit, clock.instant()));
		}
		return new AttendResponse(before.todayReward(), outfit, attendance(userId, today), view(w));
	}

	/** 누적 n번째 출석의 코인. 3일째, 그리고 8일째부터 7일 주기의 3·7번째 날은 50, 그 밖에는 5 */
	public static int attendanceReward(int n) {
		int day = (n - 1) % ATTENDANCE_CYCLE + 1;
		boolean milestone = n == 3 || n > ATTENDANCE_CYCLE && (day == 3 || day == ATTENDANCE_CYCLE);
		return milestone ? ATTENDANCE_MILESTONE_REWARD : ATTENDANCE_REWARD;
	}

	private Attendance attendance(long userId, LocalDate today) {
		List<String> keys = ledger.findRefKeys(userId, CoinReason.ATTENDANCE);
		boolean checkedToday = keys.contains(today.toString());
		int total = keys.size();
		int next = checkedToday ? total : total + 1;
		// 누적 7일째에 한 번만. 이미 가졌으면(그날 출석한 뒤 포함 아님) 주지 않는다
		boolean costume = next == ATTENDANCE_CYCLE
				&& (checkedToday || !userOutfits.existsByUserIdAndOutfitId(userId, ATTENDANCE_OUTFIT));
		return new Attendance(today, total, checkedToday, attendanceReward(next), costume ? ATTENDANCE_OUTFIT : null);
	}

	/** 적립·사용 내역, 최신순. before가 없으면 가장 최근부터. limit+1개를 읽어 다음 쪽이 있는지 본다. */
	@Transactional(readOnly = true)
	public LedgerPage ledger(long userId, Long before, int limit) {
		if (limit < 1 || limit > LEDGER_MAX_LIMIT) {
			throw ApiException.invalid("limit", "limit은 1~" + LEDGER_MAX_LIMIT + " 사이로 보내 주세요");
		}
		List<CoinLedger> rows = ledger.findByUserIdAndIdLessThanOrderByIdDesc(userId,
				before == null ? Long.MAX_VALUE : before, Limit.of(limit + 1));
		boolean more = rows.size() > limit;
		List<LedgerEntry> items = rows.stream().limit(limit).map(this::toEntry).toList();
		return new LedgerPage(items, more ? items.get(items.size() - 1).id() : null);
	}

	/** 지갑이 없으면 만들고 행을 잠근다. 같은 트랜잭션 안에서 잔액을 바꾸기 전에 부른다. */
	public CoinWallet lockWallet(long userId) {
		wallets.ensure(userId, clock.instant());
		return wallets.findForUpdate(userId).orElseThrow();
	}

	/**
	 * 잠근 지갑에 내역을 남기고 잔액을 바꾼다. 같은 (사유, refKey)가 이미 있으면 아무것도 하지 않고 false.
	 * shown: 모달 없이 바로 보여 주는 내역이면 true(만들 때 notified_at을 채워 check-in rewards에 넣지 않는다).
	 */
	public boolean post(CoinWallet w, CoinReason reason, String refKey, int amount, boolean shown) {
		if (ledger.existsByUserIdAndReasonAndRefKey(w.getUserId(), reason, refKey)) {
			return false;
		}
		Instant now = clock.instant();
		ledger.save(new CoinLedger(w.getUserId(), reason, refKey, amount, shown ? now : null, now));
		w.add(amount);
		return true;
	}

	public Wallet view(CoinWallet w) {
		int accrued = accrued(w);
		int collected = collectedToday(w);
		Passive passive = new Passive(accrued - collected, collected, PASSIVE_LIMIT, nextAt(w, accrued));
		return new Wallet(w.getBalance(), passive, w.getEquippedOutfitId());
	}

	private LocalDate today() {
		return LocalDate.now(clock.withZone(zone));
	}

	private boolean startedToday(CoinWallet w) {
		return today().equals(w.getPassiveDate()) && w.getPassiveStartedAt() != null;
	}

	/** 오늘 check-in한 시각부터 1시간에 1개, 하루 최대 10개. 자정이 지나면(오늘 check-in 전) 0. */
	private int accrued(CoinWallet w) {
		if (!startedToday(w)) {
			return 0;
		}
		long hours = Duration.between(w.getPassiveStartedAt(), clock.instant()).dividedBy(PASSIVE_EVERY);
		return (int) Math.min(PASSIVE_LIMIT, Math.max(0, hours));
	}

	private int collectedToday(CoinWallet w) {
		return startedToday(w) ? w.getPassiveCollected() : 0;
	}

	/** 다음 1개가 쌓이는 시각. 오늘 10개가 다 쌓였거나, check-in 전이거나, 자정을 넘기면 null. */
	private OffsetDateTime nextAt(CoinWallet w, int accrued) {
		if (!startedToday(w) || accrued >= PASSIVE_LIMIT) {
			return null;
		}
		Instant next = w.getPassiveStartedAt().plus(PASSIVE_EVERY.multipliedBy(accrued + 1L));
		Instant midnight = today().plusDays(1).atStartOfDay(zone).toInstant();
		return next.isBefore(midnight) ? Times.at(next, zone) : null;
	}

	private Reward toReward(CoinLedger l) {
		LocalDate refDate = l.getReason() == CoinReason.BUDGET_BONUS ? LocalDate.parse(l.getRefKey()) : null;
		return new Reward(l.getId(), l.getReason(), l.getAmount(), refDate, Times.at(l.getCreatedAt(), zone));
	}

	private LedgerEntry toEntry(CoinLedger l) {
		LocalDate refDate = l.getReason() == CoinReason.BUDGET_BONUS ? LocalDate.parse(l.getRefKey()) : null;
		String outfitId = l.getReason() == CoinReason.PURCHASE ? l.getRefKey() : null;
		return new LedgerEntry(l.getId(), l.getReason(), l.getAmount(), refDate, outfitId,
				Times.at(l.getCreatedAt(), zone));
	}
}
