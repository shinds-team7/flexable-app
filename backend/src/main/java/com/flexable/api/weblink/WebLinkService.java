package com.flexable.api.weblink;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flexable.api.budget.BudgetDtos.WebSeedMoney;
import com.flexable.api.budget.SeedMoneyService;
import com.flexable.api.common.ApiException;
import com.flexable.api.common.ErrorCode;
import com.flexable.api.common.Times;
import com.flexable.api.config.AppProperties;
import com.flexable.api.user.User;
import com.flexable.api.user.UserIdentityRepository;
import com.flexable.api.user.UserRepository;
import com.flexable.api.weblink.WebLinkDtos.AppProfile;
import com.flexable.api.weblink.WebLinkDtos.LinkCodeResponse;
import com.flexable.api.weblink.WebLinkDtos.LinkCreated;
import com.flexable.api.weblink.WebLinkDtos.LinkItem;

/**
 * 웹사이트 [앱 연동하기]. 앱 사용자가 받은 일회용 코드를 웹 서버가 가져오면 linkId를 만들어 주고,
 * 이후 웹 서버는 linkId로만 이 사용자의 정보를 읽는다. 앱 로그아웃은 연동에 영향을 주지 않고,
 * 앱에서 탈퇴하면 외래 키(ON DELETE CASCADE)로 코드·연동이 함께 지워진다.
 */
@Service
public class WebLinkService {

	static final Duration CODE_TTL = Duration.ofMinutes(10);
	static final int CODE_LENGTH = 6;
	/** 헷갈리는 글자(숫자 0·1, 영문 I·L·O)를 뺀 31자. 6자리면 약 8억 8,750만 가지(웹이 하이픈 없는 6자리로 바꿔 맞췄다). */
	static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

	private final SecureRandom random = new SecureRandom();
	private final WebLinkCodeRepository codes;
	private final WebLinkRepository links;
	private final UserRepository users;
	private final UserIdentityRepository identities;
	private final WebLinkAttemptLimiter limiter;
	private final SeedMoneyService seedMoney;
	private final Clock clock;
	private final ZoneId zone;

	public WebLinkService(WebLinkCodeRepository codes, WebLinkRepository links, UserRepository users,
			UserIdentityRepository identities, WebLinkAttemptLimiter limiter, SeedMoneyService seedMoney, Clock clock,
			AppProperties props) {
		this.codes = codes;
		this.links = links;
		this.users = users;
		this.identities = identities;
		this.limiter = limiter;
		this.seedMoney = seedMoney;
		this.clock = clock;
		this.zone = props.zoneId();
	}

	// ---- 앱 사용자 ----

	@Transactional
	public LinkCodeResponse issueCode(long userId) {
		Instant now = clock.instant();
		codes.deleteByUserIdOrExpired(userId, now);
		StringBuilder code = new StringBuilder(CODE_LENGTH);
		for (int i = 0; i < CODE_LENGTH; i++) {
			code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
		}
		Instant expiresAt = now.plus(CODE_TTL);
		codes.save(new WebLinkCode(userId, sha256(code.toString()), expiresAt, now));
		return new LinkCodeResponse(code.toString(), Times.at(expiresAt, zone));
	}

	@Transactional(readOnly = true)
	public List<LinkItem> list(long userId) {
		return links.findByUserIdOrderByCreatedAtDesc(userId).stream()
			.map(l -> new LinkItem(l.getId(), Times.at(l.getCreatedAt(), zone)))
			.toList();
	}

	@Transactional
	public void unlinkByUser(long userId, long id) {
		if (links.deleteByIdAndUserId(id, userId) == 0) {
			throw new ApiException(ErrorCode.NOT_FOUND);
		}
	}

	// ---- 웹 서버(서비스 키로 인증) ----

	@Transactional
	public LinkCreated link(String rawCode) {
		limiter.check();
		String code = rawCode.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
		Optional<WebLinkCode> found = code.length() == CODE_LENGTH ? codes.findByCodeHash(sha256(code))
				: Optional.empty();
		Instant now = clock.instant();
		if (found.isEmpty() || !found.get().getExpiresAt().isAfter(now) || codes.deleteOnce(found.get().getId()) != 1) {
			limiter.recordFailure();
			throw new ApiException(ErrorCode.LINK_CODE_INVALID);
		}
		User user = users.findById(found.get().getUserId())
			.orElseThrow(() -> new ApiException(ErrorCode.LINK_CODE_INVALID));
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String linkId = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		links.save(new WebLink(user.getId(), sha256(linkId), now));
		return new LinkCreated(linkId, profileOf(user));
	}

	@Transactional(readOnly = true)
	public AppProfile profile(String linkId) {
		WebLink link = find(linkId);
		return profileOf(users.findById(link.getUserId()).orElseThrow(() -> new ApiException(ErrorCode.LINK_NOT_FOUND)));
	}

	/** 예산 설정 전이면 404 BUDGET_NOT_SET(LINK_NOT_FOUND와 코드로 구분). */
	@Transactional(readOnly = true)
	public WebSeedMoney seedMoney(String linkId) {
		return seedMoney.forWeb(find(linkId).getUserId());
	}

	@Transactional
	public void unlink(String linkId) {
		if (links.deleteByLinkHash(sha256(linkId)) == 0) {
			throw new ApiException(ErrorCode.LINK_NOT_FOUND);
		}
	}

	private WebLink find(String linkId) {
		return links.findByLinkHash(sha256(linkId)).orElseThrow(() -> new ApiException(ErrorCode.LINK_NOT_FOUND));
	}

	private AppProfile profileOf(User user) {
		String provider = identities.findFirstByUserIdOrderByIdAsc(user.getId()).map(i -> i.getProvider()).orElse("email");
		return new AppProfile(user.getEmail(), provider);
	}

	static String sha256(String value) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
