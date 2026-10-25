import { h2, h3, p, basic, deep, note, snip, ul, ol, table, quiz, design, steps } from "./h.mjs";

export function viewsD({ SC }) {
  const b = SC.before, c = SC.created;
  const n = (x) => x.toLocaleString("ko-KR");
  const designV = {
    id: "design", title: "핵심 설계와 코드 이해", group: "설계",
    summary: "계산식, 잔액 기준 시각, 고정지출 중복 방지, 시드머니, JWT, Idempotency-Key, 코인 동시성, 늦은 응답, 오류 응답, 현재 제약",
    html: `${p("중요한 순서대로 골랐다. 각 주제는 <b>문제 → 코드 → 동작 → 지켜야 할 규칙 → 관련 테스트</b> 순서이고, 끝에 '이 구조의 효과'(코드로 확인되는 결과)와 '추정되는 이유'(문서에 이유가 없으면 추론으로 표시)와 '제약·검토할 점'을 나눴다.")}
${design({
      id: "design.calc", title: "1. BudgetCalculator: 오늘 쓸 수 있는 돈의 실제 계산식",
      problem: "다음 수입일까지 남은 돈을 남은 날로 나눠 '오늘 얼마'를 정해야 한다. 이미 쓴 돈, 앞으로 나갈 고정지출, 카드값, 저축할 돈을 빼야 한다.",
      code: snip("be-calc-compute") + snip("be-calc-payday") + snip("be-calc-occurrences"),
      how: `<ol class="formula">
<li><b>추정 잔액</b> = 잔액 − (잔액 기준 시각 뒤 시드머니로 옮긴 돈) + (기준 시각 <b>뒤</b> 수입) − (기준 시각 뒤 지출, 자동 기록 포함)</li>
<li><b>다음 수입일</b> = 오늘 <b>이후</b> 가장 가까운 수입일(31 = 말일, 토·일·공휴일이면 다음 평일). <b>남은 날</b> = 오늘부터 수입일 전날까지(오늘 포함, 최소 1)</li>
<li><b>남은 고정지출</b> = 고정지출마다 금액 × (내일 ~ 수입일 전날 사이에 그 날짜가 오는 횟수). 오늘까지의 고정지출은 이미 거래로 기록돼 1번에서 빠졌다</li>
<li><b>남은 생활비</b>(remaining) = 추정 잔액 − 남은 고정지출 − 카드 미결제 − 매달 저축할 돈 합</li>
<li><b>하루 예산</b> = max(0, 남은 생활비 + <b>오늘 쓴 돈</b>) ÷ 남은 날 (내림). 오늘 쓴 돈을 다시 더하므로 오늘 지출이 오늘의 하루 예산을 줄이지 않는다</li>
<li><b>오늘 쓸 수 있는 돈</b> = 하루 예산 − 오늘 쓴 돈(넘으면 음수). 오늘 쓴 돈에는 자동 기록 고정지출이 들어가지 않는다</li>
<li><b>이번 주</b>: 남은 날 = 오늘 ~ (이번 주 일요일과 수입일 전날 중 빠른 날), 쓸 수 있는 돈 = max(0, 하루 예산 × 남은 날 − 오늘 쓴 돈)</li></ol>
${h3("design.calc-check", "숫자로 검산(가이드 시나리오)")}
<p>가상 사용자: 2026-10-13(화) 10:00 잔액 1,250,000 · 수입일 25일(10-25가 일요일이라 10-26 월) · 15일 월세 450,000 · 매달 저축 300,000 · 카드 0. 점심 9,000원을 12:30에 기록.</p>
${table(["단계", "저장 전", "9,000원 저장 후"], [
  ["추정 잔액", `${n(b.estimatedBalance)}`, `1,250,000 − 9,000 = <b>${n(c.estimatedBalance)}</b>`],
  ["남은 날", `10-13 → 10-26 = ${b.daysLeft}일`, `${c.daysLeft}일`],
  ["남은 고정지출", `10-15 월세 1번 = ${n(b.reservedFixed)}`, n(c.reservedFixed)],
  ["남은 생활비", `1,250,000 − 450,000 − 0 − 300,000 = <b>${n(b.remaining)}</b>`, `1,241,000 − 450,000 − 300,000 = <b>${n(c.remaining)}</b>`],
  ["하루 예산", `⌊${n(b.remaining)} ÷ 13⌋ = ⌊38,461.5…⌋ = <b>${n(b.dailyBudget)}</b>`, `⌊(491,000 + 9,000) ÷ 13⌋ = <b>${n(c.dailyBudget)}</b>`],
  ["오늘 쓸 수 있는 돈", `<b>${n(b.todayAvailable)}</b>`, `38,461 − 9,000 = <b>${n(c.todayAvailable)}</b>`],
  ["이번 주(10-13~10-18, 6일)", `38,461 × 6 = <b>${n(b.weekAvailable)}</b>`, `38,461 × 6 − 9,000 = <b>${n(c.weekAvailable)}</b>`],
])}
<p>테스트의 예제({{x:BudgetCalculatorTest}} <code>computesDocumentedExample</code>)도 같은 식이다: 잔액 1,250,000, 10:00 이후 지출 12,000·수입 30,000, 09:00 지출 58,000(기준 시각 전이라 잔액에는 이미 반영) → 추정 잔액 1,268,000, 남은 생활비 518,000, 오늘 쓴 돈 70,000(09:00 지출도 오늘 쓴 돈에는 들어감), 하루 예산 ⌊588,000 ÷ 13⌋ = 45,230, 오늘 쓸 수 있는 돈 −24,770.</p>
${snip("t-calc-example")}
<p>같은 규칙을 표로 적은 문서가 <code>docs/policies.md</code>이고, 그 표를 JSON으로 옮긴 <code>tests/policy/budget.json</code>을 {{x:BudgetPolicyTest}}가 읽는다. 표 한 줄이 테스트 하나라, 문서를 고치고 코드를 안 고치면(또는 반대로) 테스트가 실패한다 {{b:test}}.</p>
${snip("cfg-policy-budget")}${snip("t-policy-payday")}
${h3("design.sim", "계산 시뮬레이터(학습용)")}
<p>서버 <code>BudgetCalculator.compute</code>를 자바스크립트로 그대로 옮긴 <b>학습 도구</b>다. 서비스 코드가 아니며 앱은 이 계산을 하지 않는다. 가이드를 만들 때 <code>BudgetCalculatorTest</code>의 기대값 55개와 모두 같은지 자동으로 검사했다 {{b:ran}}. 공휴일 목록은 <code>PublicHolidays.java</code>에서 그대로 읽었다.</p>
<div id="sim-slot" class="sim"></div>`,
      rules: ul(["최종값은 서버만 계산한다. 앱은 받은 값을 그린다(AGENTS.md).", "원 단위 정수, 나눗셈은 내림.", "계산 규칙의 정본은 <code>docs/policies.md</code> §1·§2다(10-25 <code>docs/API.md</code>에서 옮김). 식을 바꾸려면 그 예시 표와 <code>tests/policy/budget.json</code>을 같은 PR에서 먼저 고친다(<code>spec-change</code>, 리드 리뷰).", "<code>SeedMoneyService.allAmount</code>도 같은 <code>compute</code>를 주기 마지막 날 기준으로 다시 쓴다. 바꾸면 시드머니 'ALL' 금액도 바뀐다."]),
      tests: "{{x:BudgetCalculatorTest}} 11개(수입일·주말·공휴일·말일·고정지출 횟수·예제·음수)와 정책 예시 표를 읽는 {{x:BudgetPolicyTest}} 13개, 직접 실행 통과 {{b:ran}}. API 수준은 {{x:ApiFlowTest}} <code>fullFlow</code>(<code>todaySpent</code>, <code>estimatedBalance</code>).",
      effect: "계산이 DB·스프링을 모르는 순수 함수라 입력만 바꿔 바로 검사할 수 있다. 앱·웹이 같은 값을 보여 준다.",
      why: "AGENTS.md에 '예산 금액은 서버(BudgetCalculator)가 최종값'이라는 규칙만 있고 이유는 적혀 있지 않다. 앱 버전이 섞여 있어도(원격 업데이트 전후) 같은 결과를 내려는 것으로 보인다 {{b:infer}}.",
      limits: ul([
        "조회마다 잔액 기준 시각 이후 거래를 모두 읽어 자바에서 더한다(<code>findSince</code>). 잔액을 오래 다시 입력하지 않으면 읽는 행이 계속 늘어난다. 실제 성능은 측정하지 않았다 {{b:unknown}}.",
        "<code>income_amount</code>(예정 수입액)는 저장하지만 계산식에 쓰이지 않는다 {{b:code}}. 입력 화면이 있는 값이 결과에 영향이 없다는 점을 팀이 의도했는지 확인해 볼 만하다 {{b:suggest}}.",
        "고정지출 날짜는 주말·공휴일로 미루지 않는다(수입일만 미룸, <code>paydayIn</code>) {{b:code}}.",
      ]),
    })}
${design({
      id: "design.balanceat", title: "2. 잔액 기준 시각과 그 뒤의 거래",
      problem: "사용자가 10:00에 '지금 잔액 1,250,000'을 입력했다면, 09:00 거래는 이미 그 잔액에 들어 있다. 또 빼면 두 번 빠진다.",
      code: "{{c:BudgetCalculator}}의 <code>if (t.occurredAt().isAfter(in.balanceAt()))</code> 한 줄, {{c:BudgetService}} <code>put</code>의 기준 시각 처리, 앱 {{c:OnboardingScreen}}의 잔액 변경 처리." + snip("fe-onb-balanceat") + snip("be-budget-put"),
      how: ul([
        "기준 시각 <b>뒤</b>(같은 순간 제외) 거래만 추정 잔액에 더하고 뺀다. 오늘 쓴 돈은 기준 시각과 무관하게 오늘 날짜면 센다.",
        "서버: 요청의 <code>balanceAt</code>이 없으면 지금. 5분 넘게 미래면 400, 5분 이내 미래면 지금으로(기기 시계 오차 허용).",
        "앱: 예산 설정에서 잔액을 <b>바꾸면</b> <code>balanceAt</code>도 지금으로 바꾼다. 잔액을 그대로 두면 기존 기준 시각을 유지한다.",
        "앱의 새 거래 기본 시각은 초까지 둔다(분 단위로 자르면 기준 시각보다 앞설 수 있다는 주석).",
        "고정지출 자동 기록이 잔액 기준일 당일이면 기준 시각 + 1ms로 넣어 그 잔액에서 빠지게 한다.",
        "시드머니로 옮긴 돈도 기준 시각 뒤에 옮긴 것만 뺀다(<code>sumCreatedAfter</code>).",
      ]),
      rules: "잔액을 다시 입력하는 화면은 반드시 기준 시각도 함께 보내야 한다. 시각 비교는 모두 <code>Instant</code>(UTC 순간)로 한다.",
      tests: "{{x:BudgetCalculatorTest}} <code>computesDocumentedExample</code>(09:00 지출은 잔액에서 안 뺌) {{b:ran}}, E2E <code>re-entering the balance in settings does not subtract earlier spending again</code>({{b:test}}, 이번에 실행 안 함).",
      effect: "사용자는 언제든 실제 통장 잔액을 다시 입력해 추정값을 바로잡을 수 있고, 그 전 기록은 다시 빠지지 않는다.",
      limits: "잔액을 바꾸지 않고 다른 설정만 고치면 옛 기준 시각이 남는다. 따라서 고정지출 설정만 고쳐도 이미 기록한 날짜가 다시 빠지지 않아야 한다(아래 3번, #129).",
    })}
${design({
      id: "design.fixed", title: "3. 고정지출 자동 기록과 중복 방지",
      problem: "월세가 빠지는 날 잔액에서 자동으로 빠져야 한다. 그런데 서버에 예약 작업이 없고, 사용자가 같은 지출을 직접 기록했을 수도 있고, 같은 날을 두 번 빼면 안 되며, 사용자가 자동 기록을 지워도 다시 생기면 안 된다.",
      code: snip("be-poster-entry") + snip("be-poster-ctor") + snip("be-poster-post") + snip("be-poster-orphans") + snip("be-poster-manual") + snip("be-settings-repo"),
      how: ol([
        "설정 행을 <code>SELECT … FOR UPDATE</code>로 잠근다. 같은 사용자의 동시 조회가 같은 날짜를 두 번 기록하지 않게 줄을 세운다.",
        "기록 시작일 = 잔액 기준일(도입 전 사용자는 도입 시각 이후).",
        "항목 키 = SHA-256(<code>일자:이름:순번</code>) 앞 32자. 같은 일자·이름이 여럿이면 순번으로 구분.",
        "달마다 그 날짜(31이면 말일) <code>d</code>가 시작일~오늘 사이이고 <code>d:항목키</code>가 {{t:fixed_expense_postings}}에 없으면 기록 대상.",
        "현재 설정에 없는 항목의 기록을 날짜별로 모은다(<code>orphans</code>). 이미 현재 항목이 이어받은 거래와 중복 거래 id는 제외한다. 새 키가 없을 때 같은 날짜의 이 기록을 먼저 이어받고 거래는 다시 만들지 않는다.",
        "같은 날 같은 이름·금액의 직접 기록(아직 다른 항목을 맡지 않은 것)이 있으면 그 거래를 이 항목의 기록으로 삼는다(새로 만들지 않음).",
        "없으면 '고정지출' 카테고리로 <code>fromFixed=true</code> 거래를 만들고, 기록 표시 행을 남긴다.",
      ]),
      rules: ul(["기록 표시 행은 거래를 지워도 지우지 않는다(다시 만들지 않으려고).", "오늘 예산·시드머니는 같은 트랜잭션(MANDATORY), 내역·분석은 따로 commit(REQUIRES_NEW, 실패해도 조회 계속).", "남은 고정지출은 <b>내일부터</b>만 센다. 오늘까지는 이미 거래가 됐으므로."]),
      tests: "{{x:ApiFlowTest}} <code>fixedExpensesArePostedAsTransactions</code>(지워도·다시 저장해도 다시 안 만듦), <code>fixedExpensePostingEdgeCases</code>(같은 이름 여러 개, 직접 기록이 대신, 다른 카테고리로 옮기면 일반 지출, 도입 전 사용자), {{x:BudgetCalculatorTest}} <code>fixedExpenseNoLongerComesBackAfterItsDay</code> 및 <code>renamingAFixedExpenseDoesNotPostItsPastDatesAgain</code>(이름 변경과 거래 삭제 후 재변경) — 모두 2026-10-25 직접 실행 통과 {{b:ran}}." + snip("t-fixed-posted") + snip("t-fixed-rename"),
      effect: "스케줄러·별도 작업 서버 없이 단일 서버에서 동작한다. 오늘 예산 계산과 기록이 한 트랜잭션이라 '기록은 됐는데 계산엔 빠진' 상태가 없다.",
      why: "서버가 EC2 한 대이고 값이 필요한 때가 '사용자가 앱을 열 때'뿐이라 예약 작업을 두지 않은 것으로 보인다 {{b:infer}}.",
      limits: ul([
        "<b>GET 요청이 DB에 쓴다</b>(오늘 예산·내역·분석·시드머니 조회). HTTP 관례상 GET은 읽기만 하는 요청이라, 캐시·미리 읽기 같은 동작과 만날 때 예상 밖일 수 있다 {{b:infer}}.",
        `<b>#129에서 고친 문제</b>: 예전에는 이미 기록된 고정지출의 이름만 바꿔 다시 저장하면 같은 날짜가 한 번 더 기록됐다. 로컬 재현은 잔액 기준 10-20, 22일 월세 450,000 → 추정 잔액 550,000 → 이름만 '집세'로 바꿔 저장 → 같은 날짜의 거래가 추가돼 100,000이 되는 순서였다(2026-10-24 {{b:ran}}). 현재는 사라진 항목의 기록을 같은 날짜의 새 항목이 이어받으므로 거래를 다시 만들지 않는다. 키 형식은 유지해 기존 기록과 호환되며 마이그레이션은 없다 {{b:code}}. <b>남은 한계</b>: 같은 저장에서 항목 하나를 지우고 같은 날짜의 다른 항목을 넣어도 이름 변경으로 다룬다. 항목 id가 저장마다 바뀌므로 수정과 추가를 구분할 정보가 없다. 변하지 않는 항목 id를 쓰는 설계를 검토할 만하다 {{b:suggest}}. 이미 중복된 사용자 거래는 자동 정리하지 않는다. 운영 반영에는 사람의 백엔드 배포가 필요하다(HANDOFF {{b:doc}}). {{v:scope.pending|변경 반영 상태}}.`,
        "사용자가 오래 앱을 열지 않으면 그동안의 고정지출이 다음 조회 때 한꺼번에 기록된다(동작은 맞지만 기록 시점이 늦다).",
      ]),
    })}
${design({
      id: "design.seed", title: "4. 시드머니와 사용 가능 금액",
      problem: "수입일 전날 남은 돈을 '모아둔 돈'으로 옮겼다고 기록하면, 그 돈은 생활비에서 빠져야 한다. 또 주기마다 한 번만 반영돼야 한다.",
      code: snip("be-seed-pending") + snip("be-seed-confirm") + snip("be-seed-sum"),
      how: ul([
        "반영할 주기(pending): 오늘이 수입일 전날이면 오늘 끝나는 주기, 아니면 직전 주기. 그 주기 끝 전부터 앱을 썼고(첫 하루 예산 기록) 아직 반영하지 않았을 때만.",
        "GOAL = 매달 저축할 돈 합, ALL = 주기 마지막 날 기준 <code>compute(...).remaining + 저축할 돈</code>(0 미만이면 0), MANUAL = 보낸 금액. GOAL·ALL은 서버가 정하고 보낸 금액은 무시.",
        "반영 기록의 <code>created_at</code>이 잔액 기준 시각 뒤면 오늘 예산의 추정 잔액에서 뺀다.",
        "시드머니 합계 = <code>seed_base</code> + 반영 기록 합. 생활비 잔액과 따로다.",
      ]),
      rules: "주기당 한 번: 설정 행 잠금 + pending 재확인 + UNIQUE <code>(user_id, cycle_end)</code>. 응답하지 않은 주기는 다음 주기 전날 넘어간다.",
      tests: "{{x:SeedMoneyFlowTest}} 6개, 직접 실행 통과 {{b:ran}}.",
      effect: "웹 연동에 주는 시드머니도 같은 확정 기록에서 만든다(<code>forWeb</code>). 반영 대기 정보는 웹에 주지 않는다.",
      limits: "알림은 기기 안 예약뿐이라 웹 사용자는 홈의 반영 창으로만 알게 된다(FEATURES.md {{b:doc}}).",
    })}
${design({
      id: "design.auth", title: "5. JWT 인증, 토큰 폐기, 사용자별 접근 제어",
      problem: "서버는 요청마다 '누구인가'를 알아야 하고, 로그아웃한 토큰은 못 쓰게 해야 하고, 남의 데이터는 막아야 한다.",
      code: snip("be-token-issue") + snip("be-security-converter") + snip("be-currentuser") + snip("be-tx-service-find") + snip("be-user-revoke"),
      how: ol([
        "로그인 때 <code>{ sub: 사용자 번호, iat, exp(30일), tv: token_version }</code>을 HS256 비밀키로 서명해 준다. 서버는 세션을 저장하지 않는다(STATELESS).",
        "요청마다 서명·만료를 확인하고, <b>DB에서 사용자 행을 읽어</b> <code>token_version</code>이 토큰의 <code>tv</code>와 같은지 본다.",
        "로그아웃 = 사용자 행을 잠그고 <code>token_version + 1</code>. 그 사용자의 이전 토큰은 모든 기기에서 다음 요청부터 401.",
        "컨트롤러는 <code>CurrentUser.id(jwt)</code>로만 userId를 얻고, 서비스·리포지토리는 늘 <code>user_id</code> 조건으로 찾는다. 남의 것은 404.",
      ]),
      rules: ul(["새 API를 만들면 userId는 토큰에서만, 조회는 <code>…AndUserId</code>로.", "공개 경로는 <code>SecurityConfig</code>에 명시한 것뿐(가입·로그인·소셜·health).", "<code>JWT_SECRET</code>은 32바이트 이상이어야 서버가 뜬다. 바꾸면 모든 사용자가 로그아웃된다(backend README).", "웹 서버용 <code>/internal/**</code>은 사용자 토큰이 아니라 서비스 키."]),
      tests: "{{x:SecurityTest}} 4개(비로그인·위조·남의 데이터·CORS), {{x:ApiFlowTest}} <code>logoutRevokesToken</code>·<code>requiresToken</code> — 직접 실행 통과 {{b:ran}}. 로컬에서도 다른 사용자 토큰으로 PATCH → 404, 로그아웃 후 → 401을 확인했다 {{b:ran}}." + snip("t-security-other"),
      effect: "로그아웃·탈퇴·소셜 연결이 즉시 반영된다. 서버에 세션 저장소가 필요 없다.",
      why: "로그아웃을 즉시 반영하려고 순수 JWT 대신 DB 확인을 더한 것으로 보인다(<code>SecurityConfig</code> 주석: '탈퇴한 계정이나 로그아웃(토큰 버전 증가)된 토큰은 거절한다') {{b:code}}.",
      limits: ul(["인증 요청마다 users 조회가 한 번 늘어난다(로그로 확인 {{b:ran}}).", "refresh token이 없어 30일마다 다시 로그인해야 한다. 로그아웃이 '이 기기만'이 아니라 '모든 기기'다(API.md {{b:doc}}).", "소유자 조건을 사람이 매번 챙기는 구조다. {{x:SecurityTest}}는 거래·카테고리를 다룬다. 다른 기능은 각 흐름 테스트가 일부만 본다 {{b:test}}."]),
    })}
${design({
      id: "design.idem", title: "6. Idempotency-Key와 DB UNIQUE 제약",
      problem: "저장 요청을 보냈는데 응답이 끊겼다. 서버에 저장됐는지 모르니 다시 보내야 하는데, 이미 저장됐다면 두 건이 된다.",
      code: snip("fe-form-save") + snip("be-tx-service-create") + snip("be-tx-service-normalize"),
      how: ol([
        "앱: 폼마다 키를 <b>한 번</b> 만들고(<code>randomUUID</code>), 응답을 못 받으면(<code>NETWORK</code>·<code>INTERNAL_ERROR</code>) <code>uncertain</code> 상태로 입력을 잠근 채 '다시 시도'가 같은 본문·같은 키를 보낸다.",
        "서버: 트랜잭션 안에서 <code>(user_id, key)</code>로 먼저 찾고 있으면 그것을 200으로.",
        "동시에 두 요청이 모두 '없음'을 보면 둘 다 INSERT를 시도한다. DB UNIQUE <code>uk_transactions_idem</code>이 하나만 받고 다른 쪽은 <code>DataIntegrityViolationException</code>.",
        "진 쪽은 그 트랜잭션을 rollback하고 <b>새 트랜잭션</b>에서 이긴 쪽 거래를 찾아 200. 그래서 <code>@Transactional</code> 대신 <code>TransactionTemplate</code>을 두 번 쓴다.",
      ]),
      rules: ul(["키는 사용자별(UNIQUE가 <code>(user_id, idempotency_key)</code>). 최대 64자.", "수정·삭제·자동 기록은 키가 없다(NULL은 UNIQUE에 걸리지 않는다).", "같은 키에 다른 본문이 와도 처음 거래를 돌려준다(본문 비교 없음) {{b:code}}."]),
      tests: "{{x:ApiFlowTest}} <code>concurrentRetriesWithSameIdempotencyKeyCreateOneTransaction</code>(동시 6개 → 201 하나·200 다섯·1건) {{b:ran}}, E2E가 실제 응답을 받은 뒤 일부러 끊고 같은 키로 재시도({{x:e2eService}} {{b:test}})." + snip("t-idem-race") + snip("t-e2e-idem"),
      effect: "모바일 네트워크가 불안정해도 거래가 두 번 기록되지 않는다. HANDOFF §6에 '동시 요청 하나가 500'이던 문제를 #107로 고친 기록이 있다 {{b:doc}}.",
      limits: "등록(<code>POST /transactions</code>)에만 있다. 다른 POST(시드머니 반영, 구매, 추천 등록)는 잠금과 UNIQUE로 '한 번만'을 보장하고, 재시도하면 409를 받는다 {{b:code}}.",
    })}
${design({
      id: "design.coin", title: "7. 코인 지급 중복 방지와 구매 동시성",
      problem: "check-in이 여러 번 와도 가입 선물은 한 번, 같은 코스튬을 동시에 두 번 눌러도 코인은 한 번만 빠져야 한다.",
      code: snip("be-coin-post") + snip("be-wallet-repo") + snip("be-outfit-purchase"),
      how: ul([
        "지갑 만들기: <code>INSERT … ON DUPLICATE KEY UPDATE balance = balance</code>(동시에 처음 와도 한 행).",
        "잔액을 바꾸는 요청은 모두 <code>findForUpdate</code>로 지갑 행을 잠근다 → 같은 사용자의 요청이 한 줄로.",
        "지급은 <code>post()</code>: 잠금 안에서 같은 (사유, ref_key)가 있는지 보고 없을 때만 내역 + 잔액. 마지막 방어는 UNIQUE <code>uk_coin_ledger_ref</code>.",
        "구매는 <b>잠금을 가장 먼저</b> 한다. 주석: MySQL(REPEATABLE READ)은 트랜잭션의 첫 일반 조회 때 스냅숏을 잡으므로, 잠그기 전에 무언가를 조회하면 앞 요청이 산 기록을 못 본다.",
        "<code>CoinWallet</code>에는 <code>@Version</code>(낙관적 잠금)도 있어 갱신마다 <code>version</code>이 오른다.",
      ]),
      rules: "지갑 잔액을 바꾸는 새 기능은 ① <code>coins.lockWallet</code> 먼저 ② <code>coins.post</code>로 내역과 함께 바꾸기. ref_key 규칙은 <code>CoinReason</code> 주석.",
      tests: "{{x:CoinFlowTest}} <code>concurrentPurchaseChargesOnce</code>(동시 2번 → 200·409, 잔액 0), <code>signupGiftOnlyOnceAndRewardsRepeatUntilAck</code> 등 14개 {{b:ran}}." + snip("t-purchase-race"),
      effect: "잔액(<code>coin_wallets.balance</code>)과 내역(<code>coin_ledger</code>)이 같은 트랜잭션에서 함께 바뀐다.",
      why: "잔액을 매번 내역 합으로 계산하지 않고 따로 두는 것은 조회를 단순하게 하려는 것으로 보인다 {{b:infer}}.",
      limits: ul(["테스트는 H2에서 돈다. 주석이 말하는 MySQL REPEATABLE READ 상황은 테스트로 재현되지 않는다 {{b:infer}}.", "<code>ensure()</code>·하루 예산 upsert는 MySQL 문법 네이티브 SQL이다(H2 MySQL 모드로 동작 확인 {{b:ran}})."]),
    })}
${design({
      id: "design.late", title: "8. 세션 변경 후 늦게 도착한 응답",
      problem: "A 계정 요청이 느리게 가는 사이 로그아웃하고 B로 로그인했다. 그 뒤 A 요청의 401이 도착하면 B 세션이 끊길 수 있다. 늦게 온 A의 데이터가 B 화면에 그려질 수도 있다.",
      code: snip("fe-client-session") + snip("fe-client-api") + snip("fe-session-restore"),
      how: ul([
        "<code>setApiSession</code>을 부를 때마다(로그인·로그아웃) <code>generation</code>이 1 오른다.",
        "<code>api()</code>는 보낼 때 <code>started = generation</code>을 기억하고, 401이어도 <code>started === generation</code>일 때만 세션 만료 처리를 부른다.",
        "<code>Session</code>의 복원·<code>refreshUser</code>도 시작 때 세대를 기억해 그사이 바뀌었으면 결과를 버린다.",
        "<code>useResource</code>는 사용자 id + 경로를 묶은 identity와 요청 순번(<code>seq</code>)으로, 이전 화면·이전 사용자의 늦은 응답을 버린다.",
        "캐릭터 홈의 지갑 갱신도 <code>publishWallet(r.wallet, generation)</code>으로 세대를 넘긴다.",
      ]),
      rules: "화면에서 새로 비동기 요청을 만들면, 결과를 state에 넣기 전에 '그사이 세션·화면이 바뀌었나'를 확인한다.",
      tests: "{{x:unitApiSession}} 3개(실제 <code>client.ts</code>를 변환해 가짜 fetch로 실행) {{b:ran}}." + snip("t-unit-late401"),
      effect: "빠르게 계정을 바꾸거나 로그아웃해도 다른 세션이 엉뚱하게 끊기지 않는다.",
    })}
${design({
      id: "design.errors", title: "9. 오류 응답과 화면 표시",
      problem: "서버의 실패 이유를 앱이 알맞은 문구로 보여 주고, 입력칸 옆에 표시해야 한다.",
      code: snip("be-error-code") + snip("be-exception-handler") + snip("fe-client-errortext"),
      how: ol([
        "서비스는 <code>throw new ApiException(ErrorCode.X)</code> 또는 <code>ApiException.invalid(필드, 문구)</code>.",
        "DTO 검증 실패는 스프링이 <code>MethodArgumentNotValidException</code>을 던지고, 처리기가 필드별 문구를 모은다.",
        "{{c:GlobalExceptionHandler}}가 모두 <code>{ code, message, fields?, retryAfterSeconds?, provider? }</code> JSON으로. 모르는 예외는 로그만 남기고 500 <code>INTERNAL_ERROR</code>(내부 내용은 응답에 없음).",
        "앱 <code>api()</code>는 2xx가 아니면 <code>ApiError(code, message, fields, …)</code>를 던지고, 연결 실패·15초 초과는 <code>NETWORK</code>.",
        "화면은 <code>errorText(e)</code>로 문구를 고르고(<code>message</code>를 그대로 쓰는 경우가 많음), <code>fields</code>는 해당 입력칸 아래에, 공통 오류는 <code>ErrorNotice</code>로 보여 준다.",
      ]),
      rules: "분기는 반드시 <code>code</code>로(API.md). <code>message</code>는 사용자에게 보여도 되는 한국어 존댓말로.",
      tests: "로컬 실행으로 400(<code>amount: 0</code>)·404·401 응답 본문을 확인했다 {{b:ran}}. {{x:ApiFlowTest}}가 <code>$.fields.categoryId</code> 등을 검사한다 {{b:ran}}.",
      limits: "<code>DataIntegrityViolationException</code>은 처리기에 따로 없어서, 거래 등록 외의 곳에서 UNIQUE 충돌이 새어 나오면 500이 된다 {{b:code}}(가입은 직접 잡아 409로 바꾼다).",
    })}
${h2("design.limits", "10. 현재 구조의 제약과 검토할 점(근거 포함)")}
${p("장점과 함께 지금 구조가 전제하는 것과 약한 곳을 모았다. 성능·사용자 수·운영 안정성은 측정하지 않았으므로 주장하지 않는다.")}
${table(["#", "현재 구현", "근거", "검토할 점"], [
  ["1", "조회 API(오늘 예산·내역·분석·시드머니)가 고정지출 기록·하루 예산 저장을 함께 한다", "{{c:FixedExpensePoster}} 호출 위치 {{b:code}}", "GET이 쓰기를 해도 되는가, 별도 작업으로 뺄 시점은 언제인가"],
  ["2", "로그인 실패 제한·웹 연동 실패 제한·소셜 state가 서버 메모리에 있다", "{{c:LoginAttemptLimiter}}, {{c:MemoryOAuthStore}}, API.md에 '여러 인스턴스 전 공유 저장소로 교체' 기록 {{b:doc}}", "서버가 한 대라는 전제. 재시작하면 기록이 사라진다"],
  ["3", "인증 요청마다 사용자 행 조회", "로컬 로그 {{b:ran}}", "즉시 폐기와 조회 비용의 교환"],
  ["4", "거래 수정이 모든 열을 다시 쓰고 잠금·버전이 없다", "UPDATE 로그 {{b:ran}}, 엔티티에 <code>@Version</code> 없음 {{b:code}}", "같은 거래를 두 기기에서 동시에 고치면 나중 것이 이긴다(개인 데이터라 괜찮은가)"],
  ["5", "엔티티에 연관관계 없이 ID만, 소유자 조건은 사람이 챙김", "{{b:code}}", "새 기능에서 <code>user_id</code> 조건을 빠뜨리지 않게 하는 장치(테스트 패턴 등)"],
  ["6", "오늘 예산 계산이 기준 시각 이후 거래를 모두 읽는다", "{{c:BudgetService}} <code>findSince</code> {{b:code}}", "기록이 쌓였을 때의 비용(측정 안 함)"],
  ["7", "고정지출 설정 변경 시 사라진 항목의 기록을 이어받는다(#129)", "{{c:FixedExpensePoster}} <code>orphans</code> {{b:code}}", "수정과 추가를 구분할 고정 id가 필요한가"],
  ["8", "분석 지출 합에는 고정지출 자동 기록이 들어가고, 오늘 쓴 돈에는 안 들어간다", "{{c:AnalysisController}}, {{c:BudgetCalculator}} {{b:code}}", "화면 문구로 이 차이를 설명하고 있는가(API.md에는 #130에서 명시)"],
  ["9", "테스트 DB는 H2, 운영은 MySQL", "{{b:config}}", "시간대 저장·격리 수준 차이를 운영 전에 확인할 방법"],
  ["10", "분석만 서비스 계층 없이 컨트롤러에서 처리", "{{c:AnalysisController}} {{b:code}}", "계층 규칙을 통일할지"],
  ["11", "<code>income_amount</code>는 계산에 안 쓰인다", "{{c:BudgetCalculator}} 입력에 없음 {{b:code}}", "입력을 받는 이유"],
  ["12", "공휴일 목록을 해마다 손으로 더한다", "{{c:PublicHolidays}}, HANDOFF §6 {{b:doc}}", "잊었을 때 생기는 일(토·일만 미룸)"],
])}`,
  };

  const change = {
    id: "change", title: "기능 수정과 문제 조사 지도", group: "실무",
    summary: "문구, 입력 항목 추가, 계산 변경, 응답 필드, DB 컬럼, 로그인 풀림, 저장 후 미갱신",
    html: `${p("이번 작업에서는 서비스 코드를 고치지 않았다. 아래는 '이걸 바꾸려면 어디를 열고, 무엇이 같이 흔들리고, 무엇으로 확인하나'의 지도다.")}
${h2("change.copy", "문구나 스타일 바꾸기")}
${table(["볼 파일", "같이 흔들리는 것", "확인"], [
  ["화면: <code>src/service/*Screen.tsx</code>, 공통 UI: <code>src/components/*</code>, 색·간격: {{c:theme}}", "E2E가 화면 글자로 버튼·문구를 찾는다(<code>getByText</code>, <code>getByRole({ name })</code>). 글자를 바꾸면 <code>frontend/e2e/*.spec.ts</code>도 바꿔야 한다", "<code>npx tsc --noEmit</code>, <code>npx expo lint</code>, <code>npx playwright test</code>"],
  ["약관·개인정보처리방침: <code>src/service/legal.ts</code>와 <code>docs/play-store/*.md</code>", "둘이 같아야 한다(E2E <code>approved legal copy…</code>가 검사)", "E2E"],
  ["문구 규칙", "AGENTS.md: '입력한 잔액·기록 기준 추정'. 계좌 연결·소비 패턴 분석처럼 없는 기능을 암시하지 않는다", "리뷰"],
])}
${p("배포: 웹은 머지하면 Vercel, 앱은 EAS 원격 업데이트(새 설치 없이).")}
${h2("change.field", "거래 입력 항목 추가(예: '결제 수단')")}
${steps([
  ["DB", "<code>V12__transaction_payment.sql</code> 추가(기존 파일 수정 금지). 이미 있는 행과 옛 앱을 생각해 NULL 허용이나 기본값."],
  ["엔티티", "{{c:Transaction}} 필드 + <code>@Column</code>, 생성자, <code>update()</code>. <code>ddl-auto: validate</code>라 DB에 열이 없으면 서버가 뜨지 않는다."],
  ["DTO", "{{c:TransactionDtos}} <code>CreateRequest</code>(검증 어노테이션), <code>UpdateRequest</code>, <code>TransactionResponse.of</code>."],
  ["서비스", "{{c:TransactionService}} <code>createOnce</code>·<code>update</code>에서 값 넘기기."],
  ["프론트", "{{c:types}} <code>Transaction</code>, {{c:TransactionForm}} state·입력칸·<code>body</code>."],
  ["계약", "구현보다 먼저 <code>docs/contracts/app-api.yaml</code>의 <code>Transaction</code>·요청 스키마에 필드를 더한다(계약 변경은 먼저 알리고 <code>spec-change</code>). 응답에 스펙에 없는 필드가 나오면 {{x:ContractTest}}가 실패하므로 순서를 바꿀 수 없다."],
  ["프론트 타입·테스트", "<code>npm run gen:api</code>로 <code>schema.d.ts</code>를 다시 만든다(CI <code>check:api</code>가 검사). {{x:ApiFlowTest}}에 검사 추가, E2E에 입력 추가."],
  ["배포 순서", "백엔드(마이그레이션 포함) 먼저 → 앱. 반대로 하면 옛 서버가 모르는 필드를 받거나 새 앱이 없는 필드를 기다린다 {{b:infer}}."],
])}
${h2("change.calc", "예산 계산 바꾸기")}
${table(["볼 파일", "같이 흔들리는 것", "확인"], [
  ["{{c:BudgetCalculator}} <code>compute</code>, 입력을 모으는 {{c:BudgetService}} <code>today</code>", "{{c:SeedMoneyService}} <code>allAmount</code>(같은 compute 사용), {{t:daily_budgets}}에 저장되는 하루 예산 → 캐릭터 점수·코인 보너스 판단, <code>docs/policies.md</code> 예시 표와 <code>tests/policy/budget.json</code>, 이 가이드의 시뮬레이터", "표와 JSON을 먼저 고치고 → {{x:BudgetPolicyTest}}·{{x:BudgetCalculatorTest}} → <code>./gradlew test</code>"],
])}
${p("과거 날짜의 하루 예산은 이미 저장돼 있으므로 식을 바꿔도 지난 점수는 그대로이고, 바꾼 날부터 새 식의 값이 쌓인다 {{b:infer}}. 앱은 계산하지 않으므로 프론트는 보통 바꿀 것이 없다.")}
${h2("change.response", "API 응답 필드 추가")}
${ul(["백엔드: 응답 record(예: <code>BudgetDtos.TodayResponse</code>)에 필드 추가, 만드는 곳(<code>compute</code>, <code>withCharacter</code>) 수정.", "프론트: {{c:types}}에 필드 추가. 옛 서버가 아직 안 주는 기간이 있으면 선택(<code>?</code>)으로 둔다(<code>User.provider?</code>가 그런 예, 주석 '소셜 로그인 전 서버').", "계약: <code>docs/contracts/app-api.yaml</code>에 먼저 적는다. 스키마가 <code>additionalProperties: false</code>라 적지 않은 필드를 내보내면 {{x:ContractTest}}가 실패한다. 그다음 <code>npm run gen:api</code>(프론트 타입 재생성). 테스트: <code>jsonPath(\"$.새필드\")</code>.", "옛 앱은 모르는 필드를 무시하므로 백엔드를 먼저 내도 된다 {{b:infer}}."])}
${snip("cfg-contract-tx")}
${h2("change.column", "DB 컬럼 추가")}
${ol(["<code>backend/src/main/resources/db/migration/V12__설명.sql</code>을 <b>추가</b>(V1~V11과 V3 Java는 수정·삭제 금지). 시각 값을 넣는 데이터 변경처럼 DB 세션 시간대에 기대면 안 되는 것은 Java 마이그레이션.", "NOT NULL 열은 기존 행 때문에 DEFAULT가 필요하다(<code>from_fixed BOOLEAN NOT NULL DEFAULT FALSE</code>가 예).", "엔티티에 <code>@Column</code>. 로컬 <code>bootRun</code>으로 Flyway 적용·검증 통과 확인 → <code>./gradlew test</code>(H2에서도 같은 SQL이 돌아야 한다).", "배포하면 새 <code>app.jar</code>가 켜질 때 운영 RDS에 적용된다. Flyway는 자동으로 되돌리지 않는다. 되돌리려면 새 번호의 마이그레이션을 만든다.", "HANDOFF에 적용 기록을 남긴다(지금 'V11까지 운영 적용' 기록이 있음)."])}
${h2("change.logout", "'로그인이 풀려요' 조사")}
${table(["가능한 원인", "확인할 곳", "어떻게"], [
  ["토큰 30일 만료", "{{c:TokenService}}(<code>ttl-days: 30</code>)", "로그인한 날짜"],
  ["다른 기기에서 로그아웃(모든 기기 폐기)", "{{c:AuthService}} <code>logout</code> → <code>token_version</code>", "로컬 DB의 <code>users.token_version</code>"],
  ["같은 이메일로 소셜 로그인 연결(비밀번호 계정이면 기존 세션 끊음)", "{{c:OAuthUserService}}", "<code>user_identities</code> 행이 생겼나"],
  ["서버 <code>JWT_SECRET</code> 변경", "서버 <code>.env</code>(사람만)", "전원이 동시에 풀렸나"],
  ["탈퇴", "{{c:AccountDeletionService}}", ""],
  ["기기 저장소가 지워짐", "{{c:storage}}", "웹: 브라우저 저장소 삭제, 시크릿 창"],
  ["로그아웃이 아니라 네트워크 오류", "{{c:apiClient}}(<code>NETWORK</code>, 15초)", "토스트 문구가 '다시 로그인해 주세요'인지 '연결이 불안정해요'인지"],
])}
${p("확인 방법: 웹이면 개발자 도구 Network 탭에서 401 응답 본문의 <code>code</code>를 본다. 관련 테스트: {{x:unitApiSession}}, {{x:SecurityTest}}, {{x:ApiFlowTest}} <code>logoutRevokesToken</code>, E2E <code>expired token returns to start…</code>. 서버 로그로 볼 때, 소셜 로그인 코드는 토큰·이메일·응답 본문을 로그에 남기지 않도록 짜여 있다(<code>OAuthService</code> 주석).")}
${h2("change.stale", "'저장했는데 화면이 그대로예요' 조사")}
${steps([
  ["저장이 성공했나", "성공 토스트('거래를 기록했어요')가 떴나. 실패면 버튼이 '다시 시도'."],
  ["다시 읽게 했나", "저장 함수가 <code>session.invalidate()</code>를 부르나({{c:TransactionForm}} <code>done</code>). 새 화면을 만들었다면 여기를 빠뜨리기 쉽다."],
  ["화면이 다시 읽나", "그 화면이 <code>useResource</code>로 읽나(직접 <code>api()</code>만 부르면 다시 앞에 나와도 안 읽는다). 이미 앞에 떠 있는 화면은 이동만으로 다시 읽지 않는다(<code>seedReminder.ts</code> 주석의 사례 → <code>invalidate()</code>)."],
  ["서버 계산에 들어가나", "거래 시각이 잔액 기준 시각보다 <b>앞</b>이면 추정 잔액에서 빠지지 않는다(정상 동작). 자동 기록 고정지출은 오늘 쓴 돈에 안 들어간다. 내역은 이번 달 범위만 읽는다."],
  ["Android 빈 화면", "저장 성공 뒤 빠지는 화면을 다시 그리면 빈 화면이 났던 버그와 재발 방지 규칙: {{p:docs/bug-transaction-edit-blank-screen.md}}."],
])}
${p("관련 테스트: E2E <code>real service lifecycle…</code>가 저장 전후 <code>/budget/today</code>의 <code>estimatedBalance</code> 차이와 홈 문구를 확인한다({{b:test}}).")}`,
  };

  const ops = {
    id: "ops", title: "실행·테스트·배포 이해", group: "실무",
    summary: "로컬 실행, 설정·환경변수, 테스트 종류, CI, PR이 머지되기까지, 테스트 밖 영역, 배포 갈래, 스키마 변경",
    html: `${h2("ops.local", "로컬 실행 순서")}
${steps([
  ["준비", "JDK 21, Node 22 이상(README)."],
  ["백엔드", "<code>cd backend</code> → <code>./gradlew bootRun --args='--spring.profiles.active=local'</code> → <code>curl http://localhost:8080/api/v1/health</code> → <code>{\"status\":\"UP\"}</code>. MySQL 없이 H2 파일 DB, 개발용 JWT 키."],
  ["웹", "<code>cd frontend</code> → <code>npm ci</code> → <code>.env.example</code>을 <code>.env.local</code>로 복사(<code>EXPO_PUBLIC_API_URL=http://localhost:8080</code>) → <code>npm run web</code> → <code>http://localhost:8081</code>."],
  ["백엔드 없이 화면만(선택)", "<code>npm run mock:api</code> → 계약(<code>app-api.yaml</code>)의 예시 값으로 답하는 목 서버가 <code>http://localhost:4010</code>에 뜬다(Prism). <code>.env.local</code>의 주소를 4010으로 바꾸고 <code>npm run web</code>. 계산·저장은 하지 않으므로 화면 모양 확인용이다."],
  ["Android(선택)", "날짜 선택기·알림·영상 같은 네이티브 모듈은 Expo Go가 아니라 개발 빌드에서 확인(frontend README)."],
  ["끝낼 때", "EAS 빌드 전에는 <code>./gradlew --stop</code>과 로컬 서버 종료(잠금 파일 때문에 업로드가 실패한 기록, HANDOFF §4-2)."],
])}
${p("이번 분석 때는 기본 DB 파일을 건드리지 않으려고 포트(18080)와 DB 경로를 바꿔서 띄웠다 {{b:ran}}: <code>--server.port=18080 --spring.datasource.url=jdbc:h2:file:{임시 폴더}/guide;MODE=MySQL;… --spring.jpa.show-sql=true --logging.level.org.springframework.orm.jpa.JpaTransactionManager=DEBUG</code>. 마지막 두 옵션이 이 가이드의 SQL·트랜잭션 로그를 찍었다.")}
${h2("ops.config", "설정 파일과 환경변수의 역할")}
${table(["파일", "역할"], [
  ["<code>backend/src/main/resources/application.yml</code>", "기본 설정. 값은 <code>${DB_URL:기본값}</code>처럼 환경변수가 있으면 그것, 없으면 기본값"],
  ["<code>application-local.yml</code>", "<code>local</code> 프로필: H2 파일, 개발용 키, 꺼진 상품도 보이기"],
  ["<code>src/test/resources/application.yml</code>", "테스트: H2 메모리, 테스트용 키"],
  ["서버 <code>/opt/flexable/.env</code>(저장소에 없음)", "운영 비밀값. 양식은 <code>backend/deploy/.env.example</code>"],
  ["<code>frontend/.env.local</code> / <code>.env.production</code> / EAS 환경변수", "<code>EXPO_PUBLIC_API_URL</code>(로컬 / 운영 웹 / 앱 빌드·원격 업데이트). <code>EXPO_PUBLIC_</code> 값은 번들에 그대로 들어가므로 비밀을 넣지 않는다"],
  ["<code>frontend/app.json</code>, <code>eas.json</code>", "앱 이름·버전(1.4.0)·권한·플러그인·원격 업데이트 런타임 정책 / 빌드 프로필(development·preview·production)"],
  ["<code>frontend/public/app-version.json</code>", "Android 최소 버전(이보다 낮으면 필수 업데이트 창)"],
])}
${table(["백엔드 환경변수(값은 적지 않음)", "쓰임"], [
  ["<code>DB_URL</code>, <code>DB_USERNAME</code>, <code>DB_PASSWORD</code>", "MySQL 연결"],
  ["<code>JWT_SECRET</code>", "토큰 서명 키(32바이트 이상). 바꾸면 전원 로그아웃"],
  ["<code>CORS_ORIGINS</code>", "허용 웹 주소"],
  ["<code>WEB_LINK_SERVICE_KEYS</code>", "웹 서버가 <code>/internal</code>을 부를 키(교체 중 두 개)"],
  ["<code>OAUTH_CALLBACK_BASE_URL</code>, <code>OAUTH_ALLOWED_REDIRECT_URIS</code>, <code>KAKAO_*</code>, <code>GOOGLE_*</code>", "소셜 로그인"],
  ["<code>PORT</code>, <code>API_DOMAIN</code>", "서버 포트, Caddy 인증서 도메인"],
])}
${snip("cfg-app-yml-app")}
${h2("ops.tests", "단위·통합·E2E 테스트의 차이")}
${table(["종류", "무엇을 띄우나", "이 저장소", "개수(소스 기준)", "이번 실행"], [
  ["백엔드 단위", "클래스 하나(스프링 없음)", "<code>BudgetCalculatorTest</code>, <code>CharacterScoreTest</code>, 제한기 테스트 등", "—", "아래 합계에 포함"],
  ["백엔드 정책", "<code>tests/policy/*.json</code>의 표 한 줄 = 테스트 하나", "<code>BudgetPolicyTest</code>·<code>CharacterPolicyTest</code>(단위), <code>SeedMoneyPolicyTest</code>(API)", "3개 클래스 25개", "아래 합계에 포함"],
  ["백엔드 계약", "스프링 전체 + MockMvc, 응답을 OpenAPI 스펙으로 검사", "<code>ContractTest</code>", "5개", "아래 합계에 포함"],
  ["백엔드 통합", "스프링 전체 + H2 메모리 + MockMvc(가짜 HTTP)", "<code>ApiFlowTest</code>, <code>SecurityTest</code>, <code>CoinFlowTest</code> …", "백엔드 전체 17개 클래스 116개", "<code>./gradlew test</code> 116개 통과(2026-10-25) {{b:ran}}"],
  ["프론트 단위", "node:test로 TS 파일 일부", "<code>test/*.test.cjs</code>", "6개", "<code>npm run test:unit</code> 6개 통과(10-24) {{b:ran}}"],
  ["타입 검사·린트·계약 타입", "—", "<code>tsc</code>, <code>expo lint</code>, <code>check:api</code>", "—", "<code>tsc</code>·<code>lint</code> 오류 없음(10-24) {{b:ran}}. <code>check:api</code>는 CI에서 돈다"],
  ["E2E", "실제 브라우저(Playwright) + 실제 백엔드(H2) + 정적 웹", "<code>e2e/*.spec.ts</code>", "20개(service 15·coins 3·web-links 2)", "로컬 실행 안 함. PR #128·#129·#130의 CI 통과 {{b:ci}}"],
])}
${p("<b>시계를 고정하는 테스트</b>: 시드머니·코인처럼 날짜에 달린 규칙은 테스트가 주입 <code>Clock</code>을 특정 날짜로 고정한다. 그런데 토큰 만료 검사는 실제 시각을 쓴다. 그래서 고정 시각(예: 10-01)에 가입하면 그 토큰의 30일 만료가 실제 날짜 10-31에 닥쳐 테스트가 401로 깨질 뻔했다. #138에서 가입만 지금 시각에 하고 고정 시각으로 돌아오게 고쳤다({{x:SeedMoneyFlowTest}}, {{x:CoinFlowTest}}. 새로 생긴 {{x:ContractTest}}·{{x:SeedMoneyPolicyTest}}는 처음부터 같은 방식) {{b:code}}.")}
${p("<b>실제 API와 mock</b>: E2E는 기본적으로 진짜 백엔드를 부른다. 시간이 필요하거나 외부 공급자가 필요한 곳만 특정 응답을 가짜로 바꾼다 {{b:test}}: 소셜 로그인 교환 응답, Google 연결 계정의 로그인 응답, 시간 적립 모으기, 시드머니 반영 대기, 웹 연동 화면의 API 전부, 카카오 계정처럼 보이게 한 <code>/me</code>. mock으로 확인한 것은 '화면이 그 응답을 잘 처리하는가'이지 서버 동작이 아니다. 서버 쪽은 백엔드 통합 테스트가 따로 본다.")}
${h2("ops.ci", "CI가 검사하는 것")}
${snip("cfg-ci")}
${ul(["<b>백엔드 테스트</b>: <code>./gradlew test</code>(계약·정책 테스트 포함. <code>docs/contracts</code>·<code>tests/policy</code>가 바뀌어도 다시 돈다)", "<b>프론트엔드</b>: Node 22·npm 10으로 <code>npm ci</code>(EAS와 같은 조건, Windows에서 만든 lock 파일 문제를 잡음) → <code>check:api</code>(계약에서 다시 만든 <code>schema.d.ts</code>가 커밋된 것과 같은지) → <code>tsc</code> → <code>expo lint</code> → <code>test:unit</code>", "<b>웹 빌드·E2E</b>: H2 백엔드를 띄우고 <code>expo export -p web</code> → <code>serve -s dist</code> → <code>playwright test</code>", "별도로 <code>server-health.yml</code>이 15분마다 운영 <code>/actuator/health</code>·웹 <code>/privacy</code>·인증서 만료를 밖에서 확인하고 실패하면 이슈를 연다 {{b:config}}"])}
${p("CI가 실패한 PR은 머지하지 않는다(AGENTS.md). 10-25부터는 <code>main</code> 보호 규칙이 이것을 강제한다(아래). PR #128·#129·#130의 CI 통과를 2026-10-24 확인했다 {{b:ci}}. CI 통과와 운영 배포 여부는 별개다.")}
${h2("ops.pr", "PR이 머지되기까지(10-25 도입한 작업 방식)")}
${p("2026-10-25 웹 저장소와 같은 작업 방식을 앱 저장소에도 들였다(<code>docs/decisions/2026-10-25-dev-process.md</code> {{b:doc}}). 핵심은 <b>저장소 문서가 유일한 기준</b>이라는 것이다. 회의·메신저에서 합의한 내용도 PR로 문서에 들어오기 전까지는 개발 기준이 아니다.")}
${steps([
  ["Issue", "목표·참고 자료·범위·완료 조건을 Issue 템플릿(<code>.github/ISSUE_TEMPLATE</code>)으로 적는다."],
  ["브랜치", "<code>main</code>에서 <code>SXXNHU/&lt;종류&gt;-&lt;내용&gt;</code>(예: <code>SXXNHU/fix-dow-ui</code>). 커밋은 <code>feat(frontend): 한국어 요약</code> 형식."],
  ["작업", "관련 <code>docs/policies.md</code> 항목과 <code>docs/contracts/</code>를 먼저 읽는다. 정책에 없는 결정은 PR의 '새로 내린 결정' 칸에, 다른 파트에 영향이 있으면 <code>docs/decisions/</code>에 남긴다."],
  ["PR", "템플릿(<code>.github/pull_request_template.md</code>)에 <code>Closes #번호</code>, 참고한 문서, 영향받는 파트, 검증 결과를 채운다."],
  ["자동 검사", "<code>ci.yml</code>(백엔드·프론트·E2E)와 <code>pr-rules.yml</code>: <b>issue-link</b>(본문에 Issue 번호, 긴급 수정은 <code>no-issue</code> 라벨), <b>spec-change</b>(기준 문서를 바꿨으면 라벨 + <code>docs/CHANGELOG.md</code> 한 줄)."],
  ["승인·병합", "<code>main</code> 보호: 직접 push·강제 push 금지, 위 CI 다섯 개 통과 필수, CODEOWNERS 경로(지침·PRD·정책·계약·결정·<code>tests/policy</code>·워크플로)는 리드 승인 필수. 승인·병합은 리드만 한다."],
  ["기준 문서가 바뀐 뒤", "<code>spec-change</code> PR이 병합되면 봇이 열린 PR마다 안내 댓글을 단다. 작업 브랜치를 최신 <code>main</code>에 rebase하고, AI 세션을 새로 시작한다(이전 대화가 옛 문서를 기억하므로)."],
])}
${snip("cfg-pr-rules")}
${table(["무엇", "어디(저장소가 기준본)"], [
  ["목적·사용자·기능·범위", "<code>docs/PRD.md</code>, 기능별 화면·API·확인 방법은 <code>docs/FEATURES.md</code>"],
  ["계산·상태 규칙과 예시 표", "<code>docs/policies.md</code> = <code>tests/policy/*.json</code> = <code>*PolicyTest</code>"],
  ["API 계약", "<code>docs/contracts/app-api.yaml</code>, <code>web-link-api.yaml</code>(정본). <code>docs/API.md</code>는 요약·동작 설명"],
  ["폴더 구조·요청 경로·배포 갈래", "<code>docs/ARCHITECTURE.md</code>(10-25 루트 AGENTS.md에서 옮김)"],
  ["결정 기록, 문서 변경 이력", "<code>docs/decisions/</code>, <code>docs/CHANGELOG.md</code>"],
  ["배포·출시 현황·할 일", "<code>docs/HANDOFF.md</code>"],
])}
${h2("ops.untested", "코드 테스트로 확인되지 않는 영역")}
${ul([
  "<b>실기기 전용</b>: SecureStore, 기기 알림 예약, 영상 재생, 네이티브 날짜 선택기, 원격 업데이트 적용, 필수 업데이트 창, 화면 회전, R8 난독화. HANDOFF에 10-23 사용자 실기기 확인 기록이 있다 {{b:doc}}.",
  "<b>운영 인프라</b>: Caddy 인증서 발급·갱신, RDS 연결·TLS·보안 그룹, 백업, 디스크. 외부 감시 워크플로가 일부를 본다.",
  "<b>MySQL 고유 동작</b>: 시간대 저장, 격리 수준. 테스트는 H2.",
  "<b>실제 소셜 공급자</b>: 테스트는 공급자 HTTP를 가짜로 둔다.",
  "<b>flexable-web과의 실서버 연동</b>: 기록 없음(HANDOFF).",
  "<b>성능·부하·동시 사용자 수</b>: 측정 코드·기록 없음.",
])}
${h2("ops.deploy", "배포 세 갈래(+ 백엔드)")}
${table(["바뀐 것", "반영 방법", "누가", "주의"], [
  ["웹", "<code>main</code>에 머지 → Vercel 자동 배포(<code>vercel.json</code>: <code>expo export -p web</code>, SPA rewrite)", "자동", ""],
  ["앱 JS·이미지", "EAS Update(원격 업데이트) <code>production</code> 채널", "사람(<code>! npx eas-cli … update</code>)", "실행 때 스플래시 3초 안에 받으면 바로, 아니면 다음 실행에 적용(<code>LaunchUpdate.ts</code>)"],
  ["앱 네이티브(패키지·권한·아이콘·플러그인·SDK)", "<code>app.json</code> <code>version</code>을 올리고 새 빌드 → Play 업로드", "사람", "<code>runtimeVersion</code> 정책이 <code>appVersion</code>이라 버전을 안 올리고 원격 업데이트로 보내면 옛 앱이 꺼질 수 있다(HANDOFF). Play 출시 <b>뒤에</b> <code>minVersion</code>을 올린다"],
  ["백엔드", "<code>backend/deploy/deploy.sh</code>: jar 빌드 → 업로드 → <code>docker compose up -d --build</code>", "사람(AI는 실행하지 않음, AGENTS.md)", "새 마이그레이션은 이때 RDS에 적용된다"],
])}
${snip("cfg-app-json-rt")}${snip("cfg-eas")}
${h2("ops.schema", "EC2 애플리케이션 변경과 RDS 스키마 변경의 관계")}
${ol([
  "스키마 변경은 따로 배포하지 않는다. <b>새 app.jar가 EC2에서 켜질 때</b> Flyway가 RDS에 아직 없는 번호를 적용한다. 그다음 Hibernate가 엔티티와 테이블이 맞는지 검사(<code>validate</code>)하고, 맞지 않으면 서버가 뜨지 않는다 {{b:config}}.",
  "그래서 코드와 마이그레이션은 같은 PR·같은 배포로 나간다. 서버가 한 대라 새 컨테이너가 뜨는 동안 잠깐 응답이 끊길 수 있다 {{b:infer}}.",
  "앱(원격 업데이트)과 순서가 필요한 경우가 있다. 예: V9·V11 주석 '앱에 영상·그림을 먼저 전달한 뒤 서버에 적용', V10 '앱에 REFUND 안내 모달이 먼저 들어간 뒤 서버에 적용' {{b:code}}. 반대로 웹 연동 코드 6자리 변경은 '백엔드·앱·웹을 같은 시점에'(HANDOFF {{b:doc}}).",
  "Flyway는 자동으로 되돌리지 않는다. 잘못 나간 변경은 새 번호로 고친다. RDS 자동 백업 보관 7일 기록이 있다 {{b:doc}}.",
])}`,
  };
  return [designV, change, ops];
}
