import { h2, h3, p, basic, deep, note, snip, ul, ol, table, quiz, topic, steps } from "./h.mjs";
import { erdSvg } from "./diagrams.mjs";
import { TABLES, GROUPS } from "./e-tables.mjs";

export function viewsC({ SC }) {
  const flows = {
    id: "flows", title: "다른 흐름 따라가기", group: "요청 따라가기",
    summary: "로그인·토큰·만료·로그아웃, 예산 설정→홈, 시드머니, 코인·코스튬, 앱·웹 연동, 고정지출 자동 기록",
    html: `${p("거래 저장({{v:flow-tx|대표 요청}})과 같은 길(화면 → api() → 보안 필터 → 컨트롤러 → 서비스 → 리포지토리 → DB)을 지나므로, 여기서는 흐름마다 <b>다른 점</b>과 <b>실패 분기</b>만 짚는다.")}
${h2("flows.login", "로그인 → 토큰 보관 → 인증 요청 → 만료·로그아웃")}
${steps([
  ["앱 시작: 저장된 토큰으로 복원", "{{c:Session}} <code>useEffect</code>가 {{c:storage}}에서 토큰을 읽어 <code>setApiSession(saved, expired)</code> 후 {{a:me-get}}. 성공하면 user를 넣고 {{c:StartRoute}}가 <code>onboarded</code>로 홈·예산 설정을 고른다. 401이면 <code>expired()</code>로 지우고 시작 화면 + '다시 로그인해 주세요'(소셜 로그인 callback 주소로 열린 경우만 안내 없이 지운다), 네트워크 오류면 다시 시도 화면."],
  ["로그인 요청", "{{c:AuthScreen}}가 <code>api(\"/auth/login\", { token: null, … })</code>. <code>token: null</code>이라 이전 토큰을 붙이지 않고, 이 요청의 401로는 세션 만료 처리를 하지 않는다."],
  ["서버: 실패 제한 → 사용자 찾기 → 비밀번호 비교", "{{c:AuthService}} <code>login</code>: ① {{c:LoginAttemptLimiter}} <code>check</code>(10분 5회 넘으면 429) ② <code>findByEmail</code> ③ 소셜이 붙은 계정이면 실패로 세고 401 <code>SOCIAL_ACCOUNT</code> ④ BCrypt 비교(사용자가 없어도 가짜 해시와 비교해 응답 시간을 맞춤) ⑤ 성공이면 실패 기록 지우기."],
  ["토큰 발급", "{{c:TokenService}} <code>issue</code>: <code>{ sub: \"1\", iat, exp: 30일 뒤, tv: token_version }</code>을 HS256으로 서명. 응답 <code>{ accessToken, expiresAt, user }</code>."],
  ["토큰 보관", "{{c:Session}} <code>accept</code>: 저장소에 쓰고 → <code>setApiSession</code>(generation+1) → user 넣기 → <code>router.replace(onboarded ? \"/\" : \"/onboarding\")</code>."],
  ["인증 요청", "이후 모든 <code>api()</code>가 <code>Authorization: Bearer …</code>를 붙인다. 서버는 서명·만료 → 사용자 행의 <code>token_version</code> 비교({{c:SecurityConfig}} <code>converter</code>)."],
  ["만료", "30일이 지나면 서명 검사 단계에서 401. refresh token이 없으므로 다시 로그인해야 한다(API.md). 앱은 401을 받으면 <code>expired()</code>: 토큰·임시 예산 설정·알림 예약을 지우고 <code>/</code>로 보내 '다시 로그인해 주세요'."],
  ["로그아웃", "{{c:MyScreen}} → {{a:auth-logout}} → <code>findWithLockById</code>로 사용자 행을 잠그고 <code>revokeTokens()</code>(tv+1) → commit. 앱은 서버 응답이 실패해도 <code>finally</code>에서 기기 세션을 지운다. 다른 기기의 같은 토큰도 다음 요청에서 401."],
])}
${table(["실패", "어디서", "응답", "앱 화면"], [
  ["비밀번호 틀림", "AuthService.login", "401 <code>INVALID_CREDENTIALS</code>", "문구 + 비밀번호 칸 비움"],
  ["10분 5회 실패", "LoginAttemptLimiter.check", "429 <code>TOO_MANY_ATTEMPTS</code> + <code>retryAfterSeconds</code>", "'잠시 후 다시 시도해 주세요 (N초 후)'"],
  ["소셜로 가입한 계정에 이메일 로그인", "AuthService.login", "401 <code>SOCIAL_ACCOUNT</code> + <code>provider</code>", "'Google로 가입한 계정이에요' + 그 버튼"],
  ["토큰 위조·만료·로그아웃 후 사용", "보안 필터", "401 <code>UNAUTHORIZED</code>", "시작 화면 + '다시 로그인해 주세요'"],
  ["네트워크 끊김·15초 초과", "api()", "(응답 없음) → <code>NETWORK</code>", "'연결이 불안정해요…'"],
])}
${p("관련 테스트: {{x:ApiFlowTest}} <code>logoutRevokesToken</code>·<code>loginIsRateLimited</code>, {{x:SecurityTest}} <code>forgedAndUnsignedTokensAreRejected</code>, {{x:LoginAttemptLimiterTest}}, {{x:unitApiSession}}, E2E <code>expired token returns to start…</code>. 로컬 실행에서 로그아웃 후 같은 토큰으로 <code>GET /me</code> → 401을 확인했다 {{b:ran}}.")}
${snip("be-auth-login")}${snip("fe-my-logout")}${snip("t-logout")}

${h2("flows.onboarding", "초기 예산 설정 → 홈 예산 조회")}
${steps([
  ["8단계 입력, 서버에는 아직 안 보냄", "{{c:OnboardingScreen}}: index·balance·income·fixed·card·seed·protect·done. 단계를 넘길 때마다 {{c:BudgetDraft}}가 <code>flexable.service.draft.{userId}</code>로 기기에 저장(새로고침해도 이어서). 잔액을 바꾸면 <code>balanceAt</code>을 지금으로."],
  ["마지막 단계에서 PUT 한 번", "<code>if (saved.current !== v) await api(\"/budget/settings\", { method: \"PUT\", body: v })</code>. 같은 값을 이미 보냈으면 다시 보내지 않는다. E2E가 'PUT이 정확히 1번'을 센다."],
  ["서버: 설정 전체 교체", "{{c:BudgetService}} <code>put</code>: ① <code>balanceAt</code>이 5분 넘게 미래면 400, 조금 미래면 지금으로 ② 설정 행 잠금(<code>findForUpdate</code>) 후 값 넣기 ③ <code>seedBase</code>는 보냈을 때만 바꿈(옛 앱 호환) ④ 고정지출·저축 목록 <b>모두 지우고 새로 만들기</b> ⑤ 사용자 행 잠금 후 <code>onboarded=true</code>."],
  ["앱: 정리", "<code>refreshUser()</code>(onboarded 다시 읽기) → <code>invalidate()</code> → 임시값 지우기 → <code>/onboarding/done</code>."],
  ["홈: 오늘 예산 조회", "{{a:budget-today}} → {{c:BudgetService}} <code>today</code>: 고정지출 자동 기록(같은 트랜잭션) → 설정·고정지출·저축·거래·시드머니 합 모으기 → {{c:BudgetCalculator}} <code>compute</code> → 오늘 하루 예산 upsert → 캐릭터 점수."],
])}
${table(["실패", "응답", "처리"], [
  ["설정 전에 오늘 예산 조회", "404 <code>BUDGET_NOT_SET</code>", "탭 묶음의 <code>Guard budget</code>이 먼저 예산 설정으로 보내므로 보통 생기지 않는다"],
  ["금액·수입일 범위 밖", "400 <code>VALIDATION_FAILED</code>", "앱이 먼저 같은 범위를 검사"],
  ["PUT 뒤 사용자 다시 읽기 실패", "(네트워크)", "오류 표시. 다시 '완료'를 누르면 PUT은 다시 보내지 않고 나머지만 진행(E2E <code>real service lifecycle</code>)"],
])}
${snip("fe-onb-save")}${snip("be-budget-put")}${snip("be-budget-today")}

${h2("flows.seed", "시드머니 반영")}
${steps([
  ["알림(기기 안)", "홈이 다음 수입일을 알면 {{c:seedReminder}}가 '수입일 전날 20시' 알림을 하나 예약한다. 이와 별개로 {{c:entryReminder}}가 마지막 기록부터 24시간마다 기록 알림을 예약한다(#146). 둘 다 서버 푸시가 아니다. 웹에는 알림이 없다."],
  ["조회", "{{c:SeedMoneyCard}} → {{a:seed-get}} → {{c:SeedMoneyService}} <code>get</code>: 먼저 고정지출 자동 기록 → <code>pending</code> 계산. 오늘이 수입일 전날이면 오늘 끝나는 주기, 아니면 직전 주기. 그 주기 끝 <b>전부터</b> 앱을 썼고({{t:daily_budgets}} 첫 날짜) 아직 반영 안 했을 때만 있다."],
  ["반영", "{{a:seed-post}} <code>{ cycleEnd, choice, amount? }</code> → 설정 행 잠금 → pending을 다시 계산해 <code>cycleEnd</code>가 같은지 확인 → GOAL(매달 저축할 돈 합)/ALL(그 주기 끝 기준 남은 돈 전부)/MANUAL(보낸 금액) → {{t:seed_money_entries}}에 저장 → 201."],
  ["오늘 예산에 반영", "{{c:BudgetService}} <code>today</code>가 <code>sumCreatedAfter(balanceAt)</code>로 잔액 기준 시각 뒤에 옮긴 돈을 추정 잔액에서 뺀다(통장에서 빠진 돈으로 본다). 분석·오늘 쓴 돈에는 넣지 않는다."],
])}
${table(["실패", "응답"], [["이미 반영했거나 기간이 지남", "409 <code>SEED_NOT_PENDING</code>"], ["MANUAL인데 금액 없음", "400 field <code>amount</code>"], ["두 번 동시에 반영", "설정 행 잠금으로 줄을 서고, 뒤 요청은 pending이 없어 409. 마지막 방어는 UNIQUE <code>(user_id, cycle_end)</code>"]])}
${snip("be-seed-pending")}${snip("be-seed-confirm")}

${h2("flows.coin", "코인 지급과 코스튬 구매")}
${steps([
  ["check-in을 부르는 때", "{{c:HomeScreen}}: <b>캐릭터 홈일 때만</b>, 홈이 앞에 나올 때와 앱이 다시 활성화될 때 {{a:coin-checkin}}. 기본 홈에서는 부르지 않는다."],
  ["서버: 지갑 잠금 → 지급", "{{c:CoinService}} <code>checkIn</code>: <code>lockWallet</code>(없으면 <code>INSERT … ON DUPLICATE KEY UPDATE</code>로 만들고 <code>FOR UPDATE</code>) → 가입 선물(<code>SIGNUP_GIFT</code>, ref <code>once</code>) → 오늘 첫 check-in이면 시간 적립 시작 + 어제 예산을 지켰으면 <code>BUDGET_BONUS</code>(ref = 어제 날짜) → 아직 안 보여 준 보상 목록."],
  ["한 번만 지급", "<code>post()</code>가 같은 (사유, ref_key)가 있으면 아무것도 안 한다. 지갑 잠금 안에서 확인하므로 동시에 와도 한 번, 마지막 방어는 UNIQUE <code>uk_coin_ledger_ref</code>."],
  ["보상 모달·ack", "앱이 보상을 오래된 순으로 모달로 띄우고 닫을 때 {{a:coin-ack}}. ack 전에 다시 check-in하면 같은 보상이 다시 온다(지급은 한 번)."],
  ["구매", "{{a:outfit-purchase}} → {{c:OutfitService}} <code>purchase</code>: <b>지갑 잠금을 가장 먼저</b> → 판매 중인지 → 이미 샀는지 → 잔액 → <code>PURCHASE</code>(−200, ref = 코스튬 id) → {{t:user_outfits}} 저장. 산다고 바로 적용되지는 않는다(<code>PUT /outfits/equipped</code>)."],
])}
${table(["실패", "응답"], [["레벨 코스튬·판매 안 함", "409 <code>OUTFIT_NOT_FOR_SALE</code>"], ["이미 가짐(동시에 두 번 눌렀을 때 두 번째 포함)", "409 <code>OUTFIT_OWNED</code>"], ["코인 부족", "409 <code>COINS_NOT_ENOUGH</code>"], ["안 가진 코스튬 적용", "409 <code>OUTFIT_LOCKED</code>"]])}
${p("테스트: {{x:CoinFlowTest}} <code>concurrentPurchaseChargesOnce</code>(동시 2번 → 200·409, 잔액 0) 등 14개, 직접 실행 통과 {{b:ran}}.")}
${snip("be-coin-checkin")}${snip("be-coin-post")}${snip("be-outfit-purchase")}

${h2("flows.weblink", "앱·웹 연동(이 저장소에서 보이는 경계까지)")}
${steps([
  ["앱: 코드 받기", "{{c:WebLinksScreen}}에서 선택 동의를 체크하고 {{a:wl-code}} → {{c:WebLinkService}} <code>issueCode</code>: 이 사용자의 이전 코드와 만료된 코드를 지우고, 헷갈리는 글자를 뺀 31자에서 6자리를 뽑아 <b>SHA-256 해시만</b> 저장(10분)."],
  ["사용자가 웹사이트에 코드 입력", "웹사이트(flexable-web) 화면과 서버 처리는 이 저장소 밖이다 {{b:unknown}}."],
  ["웹 서버 → 이 서버", "{{a:int-link}}, 헤더 <code>X-Service-Key</code>({{c:ServiceKeyFilter}}가 상수 시간 비교). <code>link()</code>: 서비스 전체 실패 제한 → 공백·하이픈 제거·대문자 → 해시로 찾기 → 만료 확인 → <code>deleteOnce(id) == 1</code>(같은 코드가 동시에 와도 한쪽만) → 32바이트 무작위 <code>linkId</code>를 만들고 해시만 저장 → <code>{ linkId, profile }</code>(linkId 원문은 이 응답에서만)."],
  ["이후", "웹 서버가 <code>linkId</code>로 {{a:int-profile}}·{{a:int-seed}}. 앱은 {{a:wl-list}}·{{a:wl-delete}}로 보고 끊는다. 앱 로그아웃은 연동에 영향이 없고, 탈퇴하면 FK CASCADE로 코드·연동이 함께 지워진다."],
])}
${table(["실패", "응답"], [["서비스 키 없음·틀림", "401 <code>UNAUTHORIZED</code>(JSON)"], ["코드 없음·만료·이미 사용", "400 <code>LINK_CODE_INVALID</code>"], ["실패가 서비스 전체 10분 30회", "429 <code>TOO_MANY_ATTEMPTS</code>"], ["해제됐거나 앱 탈퇴", "404 <code>LINK_NOT_FOUND</code>"]])}
${note("warn", "HANDOFF 기록 {{b:doc}}: 코드 6자리·하이픈 없음 변경(#124)은 머지됐지만 운영 미배포이고, 백엔드·앱·웹을 같은 시점에 내야 한다. 웹 서버와 붙인 실서버 전체 흐름 확인 기록은 없다.")}
${snip("be-weblink-issue")}${snip("be-weblink-link")}${snip("be-weblink-once")}

${h2("flows.fixed", "고정지출 자동 기록: 실제 호출 계기")}
<p><b>예약 작업(스케줄러)이 아니다.</b> 백엔드 전체에 <code>@Scheduled</code>·<code>@EnableScheduling</code>이 없다 {{b:code}}. 아래 API가 불릴 때 <b>먼저</b> 실행된다(호출 위치를 코드에서 모두 찾음 {{b:code}}):</p>
${table(["API", "부르는 코드", "입구", "실패하면"], [
  ["{{a:budget-today}}", "<code>BudgetService.today</code>", "<code>postInTransaction</code>(MANDATORY: 같은 트랜잭션)", "요청도 실패(고정지출이 빠진 금액을 보여 주지 않으려고)"],
  ["{{a:seed-get}}·{{a:seed-post}}", "<code>SeedMoneyService.get/confirm</code>", "<code>postInTransaction</code>", "요청도 실패"],
  ["{{a:tx-list}}", "<code>TransactionController.list</code>", "<code>postDue</code>(REQUIRES_NEW: 따로 commit)", "경고 로그만, 조회는 계속(다음 조회 때 다시 시도)"],
  ["{{a:analysis}}", "<code>AnalysisController.summary</code>", "<code>postDue</code>", "경고 로그만"],
])}
${p("그래서 사용자가 앱을 열지 않으면 그동안은 기록되지 않고, 다음에 열 때 지난 날짜까지 한꺼번에 기록된다(잔액 기준일부터 오늘까지) {{b:infer}}. 같은 날짜·항목은 {{t:fixed_expense_postings}}의 <code>posting_key</code>로 한 번만 만든다. 자세한 규칙은 {{v:design.fixed|설계 편}}.")}
${snip("be-poster-entry")}${snip("be-tx-controller-list")}`,
  };

  // FK 표·제약 표는 테이블 데이터에서 만든다(손으로 옮기지 않음)
  const fkRows = [];
  const ruleKo = { CASCADE: "함께 삭제", "SET NULL": "NULL로 비움", "NO ACTION": "삭제 막음(먼저 옮기거나 지워야 함)" };
  for (const [tn, t] of Object.entries(TABLES)) for (const f of t.fks) fkRows.push([`{{t:${tn}}}.<code>${f.column}</code>`, `{{t:${f.refTable}}}.<code>${f.refColumn}</code>`, `<code>${f.onDelete}</code> · ${ruleKo[f.onDelete]}`, `<code>${f.name}</code>`]);
  const logicalRows = [];
  for (const [tn, t] of Object.entries(TABLES)) for (const l of t.logical || []) logicalRows.push([`{{t:${tn}}}.<code>${l.column}</code>`, `<code>${l.to}</code>`, l.note]);
  logicalRows.push(["{{t:coin_ledger}}.<code>ref_key</code>", "<code>outfits.id</code>(사유가 PURCHASE·REFUND일 때) / 날짜 / <code>once</code>", "사유마다 뜻이 다른 문자열(CoinReason 주석)"]);
  const uqRows = [], idxRows = [];
  for (const [tn, t] of Object.entries(TABLES)) {
    for (const u of t.uniques) uqRows.push([`{{t:${tn}}}`, `<code>${u.name}</code>`, `<code>(${u.columns.join(", ")})</code>`]);
    for (const i of t.indexes) idxRows.push([`{{t:${tn}}}`, `<code>${i.name}</code>`, `<code>(${i.columns.join(", ")})</code>`]);
  }
  const tableCards = GROUPS.map((g) => `<div class="tgroup"><h3 id="db.g-${g.id}">${g.title}</h3><div class="tcards">${g.tables.map((n) => `<a class="tcard" href="#t.${n}" data-go="t.${n}"><b>${n}</b><span>${TABLES[n].summary.replace(/<[^>]+>/g, "").slice(0, 70)}…</span></a>`).join("")}</div></div>`).join("");

  const db = {
    id: "db", title: "DB와 테이블 읽기", group: "데이터",
    summary: "테이블·행·열, PK·FK, JOIN, user_id, 객체와 행, 저장값과 계산값, 금액·시간대, 제약·인덱스, Flyway, 전체 ERD",
    html: `${topic({
      id: "db.basics", title: "테이블, 행, 열, PK·FK, JOIN",
      problem: "거래 화면의 '식비 · 점심 · 9,000원' 한 줄은 DB에 어떻게 들어 있나?",
      basics: basic("엑셀 시트로 생각하기(비유)", p("테이블은 시트 하나, 행은 한 줄(거래 한 건), 열은 칸 제목(금액, 제목)이다. 다만 DB는 칸마다 타입(숫자·글자·시각)과 규칙(비어도 되나, 겹쳐도 되나)이 정해져 있고 어기면 저장을 거절한다는 점이 다르다."), true) +
        basic("PK·FK·JOIN", ul([
          "<b>PK</b>: 행 하나를 딱 집는 값. {{t:transactions}}의 <code>id</code>(1, 2, 3…, DB가 붙임).",
          "<b>FK</b>: 다른 테이블의 PK를 가리키는 열과 그 약속. <code>transactions.category_id</code> → <code>categories.id</code>. 없는 카테고리 번호로는 거래를 넣을 수 없다.",
          "<b>JOIN</b>: 두 테이블을 FK로 이어 한 줄로 보기. 거래에는 카테고리 <b>번호</b>만 있으므로 이름을 보려면 JOIN한다.",
        ]) + `<pre class="code-plain" data-copy>SELECT t.id, t.title, t.amount, c.name AS category
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = 1;</pre>`),
      role: "이 앱의 거의 모든 테이블은 '누구의 데이터인가'를 <code>user_id</code>로 갖고, 거래·카테고리처럼 서로 이어지는 것은 FK로 묶인다. 단, 서버 코드는 JOIN 대신 두 번 읽어 자바에서 합치는 곳이 많다(엔티티에 연관관계가 없어서) {{b:code}}.",
      code: snip("mig-v1-tx"),
      io: "화면 한 줄 = transactions 한 행 + categories 한 행(JOIN 또는 두 번 조회)",
      next: "{{v:db.erd|전체 ERD}} · {{v:db-lab.sql|직접 SELECT}}",
    })}
${topic({
      id: "db.userid", title: "user_id가 여러 테이블에 있는 이유",
      problem: "한 DB에 모든 사용자의 데이터가 섞여 있는데, 내 것만 어떻게 고르나?",
      role: ul([
        "사용자 데이터 테이블 15개가 <code>user_id</code>(또는 <code>invitee_id</code>·<code>inviter_id</code>)로 {{t:users}}를 가리킨다. 나머지 둘 중 {{t:outfits}}는 사용자와 무관한 상품 목록, {{t:users}}는 자기 자신이다 {{b:code}}.",
        "<b>읽을 때 내 것만</b>: 리포지토리 질의마다 <code>where user_id = ?</code>가 들어간다(예: <code>findByIdAndUserId</code>, <code>findInRange(userId, …)</code>). userId는 토큰에서 온다.",
        "<b>지울 때 함께</b>: FK에 <code>ON DELETE CASCADE</code>라서 사용자를 지우면 따라 지워진다. 그래도 {{c:AccountDeletionService}}는 순서를 정해 직접 지운다(거래 → 카테고리는 CASCADE가 없어서 순서가 중요).",
        "<b>빨리 찾기</b>: <code>(user_id, occurred_at)</code> 같은 인덱스와, UNIQUE 제약에 붙은 인덱스가 사용자별 조회를 돕는다.",
        "<b>사용자당 한 행</b>인 테이블({{t:budget_settings}}, {{t:coin_wallets}})은 <code>user_id</code> 자체가 PK다.",
      ]),
      next: "{{v:design.auth|사용자별 접근 제어}}",
    })}
${h2("db.erd", "전체 ERD(기능별로 묶음)")}
${erdSvg()}
${h3("db.fks", "실제 FK와 삭제 동작(전체)")}
${table(["열", "가리키는 곳", "가리키던 행을 지우면", "제약 이름"], fkRows)}
${h3("db.logical", "FK가 없는 논리적 관계")}
${p("DB가 지켜 주지 않고 코드가 뜻을 정하는 관계다. 가리키는 행이 사라져도 DB는 막지 않는다.")}
${table(["열", "뜻하는 곳", "설명"], logicalRows)}
${h2("db.tables", "테이블 목록")}
${p("누르면 모든 열(타입·NULL·기본값)·키·인덱스·관련 엔티티·리포지토리·API와 예시 행을 볼 수 있다.")}
${tableCards}
${topic({
      id: "db.mapping", title: "Java 객체와 DB 행의 연결",
      problem: "자바의 <code>Transaction</code> 객체와 DB의 transactions 행은 어떻게 짝지어지나?",
      role: table(["자바(엔티티 필드)", "어노테이션", "DB 열", "변환"], [
        ["<code>Long id</code>", "<code>@Id @GeneratedValue(IDENTITY)</code>", "<code>id BIGINT AUTO_INCREMENT</code>", "DB가 번호를 정함"],
        ["<code>Long userId</code>", "<code>@Column(name=\"user_id\")</code>", "<code>user_id BIGINT</code>", "이름만 다름(camelCase ↔ snake_case)"],
        ["<code>TxType type</code>", "<code>@Enumerated(STRING)</code>", "<code>type VARCHAR(10)</code>", "enum ↔ 'EXPENSE'"],
        ["<code>long amount</code>", "<code>@Column</code>", "<code>amount BIGINT</code>", "원 단위 정수"],
        ["<code>Instant occurredAt</code>", "<code>@Column(name=\"occurred_at\")</code>", "<code>occurred_at DATETIME(6)</code>", "순간 ↔ 날짜+시각(시간대 없음)"],
        ["<code>boolean fromFixed</code>", "<code>@Column(name=\"from_fixed\")</code>", "<code>from_fixed BOOLEAN</code>", ""],
      ]),
      basics: basic("ID만 저장 vs 객체 연관관계", p("JPA는 <code>@ManyToOne Category category</code>처럼 엔티티가 다른 엔티티를 직접 들고 있게 할 수 있다(객체 연관관계). 그러면 <code>t.getCategory().getName()</code>처럼 쓸 수 있지만, 언제 SQL이 나가는지(지연 로딩)가 숨겨진다. 이 프로젝트는 <code>Long categoryId</code> 숫자만 저장한다. 필요한 곳에서 리포지토리로 명시적으로 읽는다. 엔티티 17개 모두 같은 방식이다 {{b:code}}.")),
      code: snip("be-tx-entity"),
      next: "{{v:back.jpa|JPA가 하는 일}}",
    })}
${topic({
      id: "db.computed", title: "저장된 값과 조회할 때 계산하는 값",
      problem: "'오늘 쓸 수 있는 돈'은 DB 어느 열에 있나?",
      role: table(["값", "저장?", "어디서"], [
        ["잔액·기준 시각·수입일·고정지출·저축할 돈", "저장", "{{t:budget_settings}}, {{t:fixed_expenses}}, {{t:protected_items}}"],
        ["거래", "저장", "{{t:transactions}}"],
        ["추정 잔액·남은 생활비·하루 예산·오늘 쓸 수 있는 돈·이번 주", "<b>저장 안 함</b>, 조회마다 계산", "{{c:BudgetCalculator}}"],
        ["그날 하루 예산", "저장(그날 마지막 값)", "{{t:daily_budgets}} — 지난날 점수를 판단하려고"],
        ["캐릭터 점수·최고 단계", "<b>저장 안 함</b>, 하루 예산 기록과 지출로 매번 계산", "{{c:CharacterScore}}"],
        ["코인 잔액", "저장(+ 모든 내역도 저장)", "{{t:coin_wallets}}.<code>balance</code>, {{t:coin_ledger}}"],
        ["시드머니 합계", "저장 안 함(<code>seed_base</code> + 반영 기록 합)", "{{c:SeedMoneyService}}"],
      ]),
      io: "계산값을 저장하지 않으면 규칙을 바꿔도 지난 데이터로 다시 계산된다(CharacterScore 주석). 대신 조회마다 계산 비용이 든다.",
    })}
${topic({
      id: "db.time", title: "금액 단위와 날짜·시간대",
      problem: "'오늘'은 한국 날짜인데 서버는 UTC로 돈다. 자정 근처 거래는 어느 날에 들어가나?",
      role: ul([
        "<b>금액</b>: 모두 원 단위 정수(<code>BIGINT</code>/<code>long</code>). 소수·문자열 금액 없음. 나눗셈은 내림(정수 나눗셈) {{b:code}}. 범위 1조 미만은 DTO 검증.",
        "<b>순간(시각)</b>: 자바 <code>Instant</code>, DB <code>DATETIME(6)</code>(마이크로초). 응답에는 <code>Times.at(instant, Asia/Seoul)</code>로 <code>+09:00</code>을 붙인다.",
        "<b>날짜</b>: '오늘', '이번 주', 수입일은 <code>LocalDate.now(clock.withZone(Asia/Seoul))</code>. 거래가 어느 날인지는 <code>occurredAt.atZone(Asia/Seoul).toLocalDate()</code> {{b:code}}.",
        "<b>DB에 들어가는 값</b>: 운영은 JVM(<code>-Duser.timezone=UTC</code>)·JDBC(<code>serverTimezone=UTC</code>)·Hibernate(<code>hibernate.jdbc.time_zone: UTC</code>)가 모두 UTC로 설정돼 있어 UTC 시각으로 저장된다고 본다 {{b:infer}}. 로컬 H2(JVM이 한국 시각인 PC)에서는 <code>occurred_at</code>이 한국 시각 그대로 보였다 {{b:ran}}. 그래서 DB를 직접 볼 때 같은 거래도 환경에 따라 9시간 차이가 날 수 있다.",
        "<b>V3 Java 마이그레이션</b>이 SQL 대신 자바로 <code>LocalDateTime.now(UTC)</code>를 넣는 이유도 이것이다(DB 세션 시간대에 기대지 않으려고, 주석 {{b:code}}).",
      ]),
      code: snip("mig-v3"),
      next: "{{v:db-lab.h2mysql|H2와 MySQL 차이}}",
    })}
${h2("db.constraints", "제약조건과 인덱스")}
${p("UNIQUE는 '겹치면 저장 거절', 인덱스는 '빨리 찾기'다. MySQL은 UNIQUE·FK에도 내부 인덱스를 만든다. 아래는 마이그레이션에 이름을 붙여 만든 것만이다.")}
${table(["테이블", "UNIQUE 제약", "열"], uqRows)}
${table(["테이블", "인덱스(CREATE INDEX)", "열"], idxRows)}
${p("UNIQUE가 '코드 검사의 마지막 방어'로 쓰이는 곳 {{b:code}}: 같은 키 거래(<code>uk_transactions_idem</code>), 같은 날 하루 예산(<code>uk_daily_budgets_date</code> + upsert), 같은 보상(<code>uk_coin_ledger_ref</code>), 같은 주기 시드머니(<code>uk_seed_entry_cycle</code>), 같은 고정지출 날짜(<code>uk_fixed_postings_key</code>), 같은 이메일(<code>uk_users_email</code>).")}
${topic({
      id: "db.flyway", title: "Flyway와 스키마 변경 이력",
      problem: "운영 DB에 열을 하나 더하고 싶다. 운영 DB에 접속해 ALTER를 치면 되나?",
      basics: basic("Flyway가 하는 일", p("서버가 켜질 때 Flyway가 <code>flyway_schema_history</code> 테이블을 보고, 아직 적용 안 한 <code>V{번호}__설명.sql</code>(또는 Java)을 번호 순서로 실행한 뒤 기록한다. 그래서 모든 환경(로컬 H2, 테스트, 운영 MySQL)이 같은 순서로 같은 스키마가 된다. 이미 적용한 파일을 고치면 체크섬이 달라져 서버가 뜨지 않는다. 그래서 '고치지 말고 새 번호를 추가'가 규칙이다(AGENTS.md).")),
      role: table(["버전", "바꾼 것", "파일"], [
        ["V1", "users, budget_settings, fixed_expenses, protected_items, categories, transactions", "{{snip:mig-v1|V1 전체}}"],
        ["V2", "transactions.from_fixed, budget_settings.fixed_posting_since, fixed_expense_postings", "{{snip:mig-v2|V2}}"],
        ["V3(Java)", "도입 전 사용자의 fixed_posting_since를 UTC 지금으로", "{{c:V3Migration}}"],
        ["V4", "daily_budgets", "{{snip:mig-v4|V4}}"],
        ["V5", "users.email·password_hash NULL 허용, user_identities", "{{snip:mig-v5|V5}}"],
        ["V6", "web_link_codes, web_links", "{{snip:mig-v6|V6}}"],
        ["V7", "budget_settings.seed_base, seed_money_entries", "{{snip:mig-v7|V7}}"],
        ["V8", "coin_wallets, coin_ledger, outfits(+15행), user_outfits, referrals", "{{snip:mig-v8|V8}}"],
        ["V9", "outfit-02 → 직장냥이 판매", "{{snip:mig-v9|V9}}"],
        ["V10", "레벨 코스튬 전환 + 산 사람에게 REFUND 내역·잔액", "{{snip:mig-v10|V10}}"],
        ["V11", "outfit-03·04 → 선비냥이·유령냥이 판매", "{{snip:mig-v11|V11}}"],
        ["V12", "budget_settings.day_preset·day_weights (기본값이 기본 배분이라 기존 금액 그대로)", "{{snip:mig-v12|V12}}"],
      ]),
      code: "로컬 실행에서 Flyway가 V1부터 V12까지 12개를 차례로 적용하는 로그(<code>Successfully applied 12 migrations … now at version v12</code>, 2026-10-28)를 확인했다 {{b:ran}}. 운영 V12 적용은 <code>docs/HANDOFF.md</code>에 10-28 배포·실기기 확인을 마쳤다는 사용자 보고로 기록돼 있다 {{b:doc}}. 이번 문서 갱신에서 운영 DB를 직접 검증한 것은 아니다 {{b:unknown}}. 다음 번호는 V13.",
      io: "새 SQL 파일 → PR → 머지 → 배포한 app.jar가 켜질 때 운영 DB에 적용(현재 아카데미 VM MySQL)",
      next: "{{v:ops.schema|EC2 앱 변경과 RDS 스키마 변경의 관계}} · {{v:change.column|DB 컬럼 추가 지도}}",
    })}`,
  };

  const lab = {
    id: "db-lab", title: "내가 직접 테이블 보기", group: "데이터",
    summary: "로컬 H2 실행·접속, GUI 보는 순서, SELECT·JOIN·합계 실습과 결과, H2와 MySQL 차이",
    html: `${note("warn", "<b>운영 DB에는 접속하지 않는다.</b> 실습은 모두 내 PC의 로컬 H2와 직접 만든 가상 데이터로 한다. 아래 결과는 이번 분석 때 로컬에서 실제로 실행한 값이다(2026-10-24, 별도 임시 DB 파일) {{b:ran}}.")}
${topic({
      id: "db-lab.run", title: "로컬 DB 실행과 접속",
      problem: "MySQL 설치 없이 테이블을 보고 싶다.",
      role: ol([
        "백엔드를 local 프로필로 켠다: <code>cd backend</code> → <code>./gradlew bootRun --args='--spring.profiles.active=local'</code>. 켜질 때 Flyway가 V1~V12를 적용한다.",
        "웹을 켜고(<code>cd frontend</code> → <code>npm run web</code>, <code>.env.local</code>에 <code>EXPO_PUBLIC_API_URL=http://localhost:8080</code>) 가입·예산 설정·거래 몇 건을 넣는다. 데이터는 <code>backend/build/localdb/flexable.mv.db</code> 파일에 쌓인다.",
        "DB 접속 정보(<code>application-local.yml</code> 기준):<pre class=\"code-plain\" data-copy>JDBC URL : jdbc:h2:file:{저장소 경로}/backend/build/localdb/flexable;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE\n사용자   : sa\n비밀번호 : (비움)\n드라이버 : H2 2.x (Gradle이 받은 버전 2.4.240)</pre>",
        "<code>AUTO_SERVER=TRUE</code> 덕분에 서버가 켜져 있어도 두 번째 프로그램(GUI 도구)이 같은 파일에 붙을 수 있다.",
        "<b>H2 웹 콘솔은 설정돼 있지 않다</b>(<code>spring.h2.console</code> 설정 없음 {{b:config}}). DBeaver나 IntelliJ의 Database 창처럼 H2를 지원하는 도구를 쓴다. 도구의 H2 드라이버가 1.x면 파일을 못 연다(2.x 필요) {{b:infer}}.",
        "명령줄로 보려면(이번 분석 때 쓴 방법): <code>java -cp {h2-2.4.240.jar 경로} org.h2.tools.Shell -url \"위 JDBC URL\" -user sa</code>. jar는 <code>~/.gradle/caches/modules-2/files-2.1/com.h2database/h2/</code> 아래에 있다.",
        "DB를 비우려면 서버를 끄고 <code>backend/build/localdb/</code>를 지운다(backend README).",
      ]),
      next: "{{v:db-lab.gui|GUI에서 보는 순서}}",
    })}
${h2("db-lab.gui", "GUI 도구에서 보는 순서")}
${ol([
  "<b>테이블 목록</b>: PUBLIC 스키마 아래 18개(앱 테이블 17 + <code>flyway_schema_history</code>).",
  "<b>구조(Columns)</b>: {{t:transactions}}를 열고 열 이름·타입·NULL 허용·기본값을 이 가이드의 테이블 상세와 비교한다.",
  "<b>키(Constraints)·인덱스</b>: PK, FK(어디를 가리키나, ON DELETE), UNIQUE(<code>uk_…</code>), 인덱스(<code>idx_…</code>).",
  "<b>데이터</b>: 맨 마지막에. <code>user_id</code>로 걸러 내 데이터만 본다. 시각 열은 이 PC의 시간대로 보인다는 점을 기억한다.",
  "<b>관계 그림</b>: 도구의 ER 다이어그램 기능이 있으면 이 가이드의 {{v:db.erd|ERD}}와 비교한다.",
])}
${h2("db-lab.sql", "SQL 실습과 결과 해석")}
${p("아래 결과는 이번 분석 때 가상 사용자 <code>learner@example.com</code>으로 가입 → 예산 설정(잔액 1,250,000, 수입일 25, 월세 15일 450,000, 적금 300,000, 모아둔 돈 500,000) → 점심 9,000원 등록 → 10,000원으로 수정한 직후 실행한 값이다 {{b:ran}}. 날짜는 실행한 날(10-24)이다.")}
${h3("db-lab.q1", "1) 어떤 테이블이 있나")}
<pre class="code-sql" data-copy>SHOW TABLES;</pre>
<pre class="code-out">budget_settings, categories, coin_ledger, coin_wallets, daily_budgets, fixed_expense_postings, fixed_expenses,
flyway_schema_history, outfits, protected_items, referrals, seed_money_entries, transactions, user_identities,
user_outfits, users, web_link_codes, web_links      (18개)</pre>
${h3("db-lab.q2", "2) 사용자")}
<pre class="code-sql" data-copy>SELECT id, email, onboarded, token_version FROM users;</pre>
<pre class="code-out">1 | learner@example.com | TRUE | 0</pre>
${p("해석: 예산 설정을 마쳐서 <code>onboarded</code>가 TRUE, 아직 로그아웃하지 않아 <code>token_version</code>이 0. 로그아웃하면 1이 된다.")}
${h3("db-lab.q3", "3) 내 거래")}
<pre class="code-sql" data-copy>SELECT id, user_id, category_id, type, amount, title, memo, occurred_at, from_fixed
FROM transactions
WHERE user_id = 1
ORDER BY occurred_at DESC;</pre>
<pre class="code-out">1 | 1 | 1 | EXPENSE | 10000 | 점심 | null | 2026-10-24 16:15:27 | FALSE</pre>
${p("해석: 행은 하나다(9,000원 행이 따로 남지 않고 같은 행이 10,000원으로 바뀜 = UPDATE). 빈 메모는 서버가 NULL로 바꿨다. <code>category_id</code> 1은 숫자일 뿐이라 이름을 보려면 JOIN한다.")}
${h3("db-lab.q4", "4) 카테고리 이름 붙이기(JOIN)")}
<pre class="code-sql" data-copy>SELECT t.id, t.title, t.amount, c.name AS category
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = 1;</pre>
<pre class="code-out">1 | 점심 | 10000 | 식비</pre>
${h3("db-lab.q5", "5) 카테고리별 지출 합계")}
<pre class="code-sql" data-copy>SELECT c.name, SUM(t.amount) AS total, COUNT(*) AS cnt
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.user_id = 1 AND t.type = 'EXPENSE'
GROUP BY c.name
ORDER BY total DESC;</pre>
<pre class="code-out">식비 | 10000 | 1</pre>
${p("해석: 분석 탭({{a:analysis}})의 <code>byCategory</code>와 같은 계산이다. 다만 서버는 이 SQL을 쓰지 않고 거래를 읽어 자바에서 더한다(<code>AnalysisController</code>) {{b:code}}. 기간 조건(<code>occurred_at</code>)을 더하면 같은 결과가 나와야 한다.")}
${h3("db-lab.q6", "6) 설정과 하루 예산")}
<pre class="code-sql" data-copy>SELECT user_id, balance, balance_at, payday, card_unpaid, seed_base FROM budget_settings;
SELECT * FROM daily_budgets;</pre>
<pre class="code-out">1 | 1250000 | 2026-10-24 16:15:06.494626 | 25 | 0 | 500000
1 | 1 | 2026-10-24 | 475000</pre>
${p("해석: <code>daily_budgets</code>는 <code>GET /budget/today</code>를 부를 때마다 오늘 행을 덮어쓴다. 실행한 날은 수입일(10-26)까지 2일이라 하루 예산이 (1,250,000 − 300,000) ÷ 2 = 475,000이었다(15일 월세는 잔액 기준일 이전이라 기록되지도, 남은 고정지출에 들어가지도 않음).")}
${h3("db-lab.q7", "7) 스키마 변경 이력")}
<pre class="code-sql" data-copy>-- H2에서는 열 이름을 따옴표로 감쌌다. MySQL에서는 따옴표 없이 쓴다.
SELECT "installed_rank", "version", "description", "type", "success"
FROM "flyway_schema_history" ORDER BY "installed_rank";</pre>
<pre class="code-out">-1 | null | &lt;&lt; Flyway Schema History table created &gt;&gt; | TABLE | TRUE
 1 | 1  | init                   | SQL  | TRUE
 2 | 2  | fixed expense postings | SQL  | TRUE
 3 | 3  | fixed posting cutover  | JDBC | TRUE      ← Java 마이그레이션
 …
11 | 11 | seonbi ghost outfits   | SQL  | TRUE</pre>
${h3("db-lab.q8", "8) 열 정의와 인덱스 확인")}
<pre class="code-sql" data-copy>SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position;

SELECT index_name, column_name
FROM information_schema.index_columns WHERE table_name = 'transactions' ORDER BY index_name, ordinal_position;</pre>
<pre class="code-out">id bigint NO · user_id bigint NO · category_id bigint NO · type character varying NO · amount bigint NO · title character varying NO
memo character varying YES · occurred_at timestamp NO · idempotency_key character varying YES · created_at timestamp NO
updated_at timestamp NO · from_fixed boolean NO FALSE

PRIMARY_KEY_3 (id) · fk_transactions_category_INDEX_3 (category_id) · fk_transactions_user_INDEX_3 (user_id)
idx_transactions_user_time (user_id, occurred_at) · uk_transactions_idem_INDEX_3 (user_id, idempotency_key)</pre>
${p("해석: <code>from_fixed</code>가 맨 뒤인 것은 V2에서 <code>ALTER TABLE … ADD COLUMN</code>으로 나중에 붙였기 때문이다. H2는 FK·UNIQUE마다 인덱스를 자동으로 만들어 이름 뒤에 <code>_INDEX_n</code>을 붙인다.")}
${topic({
      id: "db-lab.h2mysql", title: "H2와 MySQL의 차이",
      problem: "로컬·테스트는 H2, 운영은 MySQL이다. 로컬에서 되면 운영에서도 될까?",
      role: table(["항목", "H2(로컬·테스트)", "MySQL(운영)", "근거"], [
        ["DB에 보이는 시각", "이 PC 시간대(한국 시각)로 보였다", "UTC로 저장되도록 설정", "{{b:ran}} / {{b:infer}}"],
        ["타입 표기", "<code>timestamp</code>, <code>character varying</code>, <code>boolean</code>", "<code>DATETIME(6)</code>, <code>VARCHAR</code>, <code>BOOLEAN</code>(실제로는 TINYINT(1), 도구에 0/1로 보임)", "MySQL 문서 일반"],
        ["MySQL 전용 문법", "<code>MODE=MySQL</code>이라 <code>INSERT … ON DUPLICATE KEY UPDATE</code>도 돈다", "원래 문법", "{{c:DailyBudgetRepository}}·{{c:CoinWalletRepository}}, 로컬 실행 {{b:ran}}"],
        ["트랜잭션 격리·잠금", "기본 격리 수준이 MySQL과 다르다", "InnoDB 기본 REPEATABLE READ(첫 조회 때 스냅숏)", "{{c:OutfitService}} 주석은 MySQL 동작을 전제로 잠금 순서를 정했다. 테스트는 H2에서 돌므로 그 MySQL 특유의 상황은 테스트로 재현되지 않는다 {{b:infer}}"],
        ["이름 대소문자", "<code>DATABASE_TO_LOWER=TRUE</code>로 소문자", "테이블 이름을 모두 소문자로 지어 차이를 피함", "{{b:config}}"],
        ["접속", "<code>sa</code>, 비밀번호 없음, 파일·메모리", "앱 전용 계정, TLS 필수, EC2에서만", "{{b:config}} {{b:doc}}"],
      ]),
      next: "{{v:ops.untested|테스트가 확인하지 못하는 영역}}",
    })}`,
  };
  return [flows, db, lab];
}
