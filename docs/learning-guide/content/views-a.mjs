import { h2, h3, p, basic, deep, note, snip, ul, ol, table, quiz, topic, steps } from "./h.mjs";
import { archSvg, deploySvg } from "./diagrams.mjs";

export function viewsA({ SC, SHA, BRANCH, DIRTY }) {
  const S = SC.s;
  const home = {
    id: "home", title: "처음 보는 사람을 위한 시작", group: "시작",
    summary: "텅장관리 앱이 무엇이고 어디부터 읽을지",
    html: `<div class="hero"><p class="eyebrow">텅장관리(Flex-able) · 팀 학습 자료</p><h1>텅장관리 학습 가이드</h1>
<p class="lead">사회초년생용 생활비 관리 앱이다. 사용자가 <b>직접 입력한</b> 잔액·수입일·고정지출·거래로 서버가 <b>오늘 쓸 수 있는 돈</b>을 계산해 보여 준다. 이 가이드는 그 계산과 저장이 화면 → 서버 → DB를 어떻게 지나가는지 실제 코드로 따라간다.</p>
<p class="meta-line">기준: <code>${BRANCH || "detached HEAD"}</code> <code>${SHA.slice(0, 7)}</code> · 갱신 2026-10-25 · 분석 대상 코드의 커밋 안 된 변경 ${DIRTY ? "있음" : "없음"} · {{v:scope|분석 기준과 검증 범위}}</p></div>
${h2("home.q", "질문으로 바로 들어가기")}
<div class="qgrid">
<a class="qcard" href="#arch.inputs" data-go="arch.inputs"><b>우리 앱은 무엇을 하는가?</b><span>입력한 값과 서버가 계산하는 값</span></a>
<a class="qcard" href="#paths" data-go="paths"><b>처음인데 어디부터 코드를 읽어야 하는가?</b><span>30분 · 2시간 · 심화 경로</span></a>
<a class="qcard" href="#flow-tx" data-go="flow-tx"><b>저장 버튼을 누르면 무슨 일이 일어나는가?</b><span>거래 등록·수정 16단계 추적</span></a>
<a class="qcard" href="#back.jpa" data-go="back.jpa"><b>서버와 DB는 어떻게 데이터를 주고받는가?</b><span>자바 객체 → SQL → DB 행</span></a>
<a class="qcard" href="#db.basics" data-go="db.basics"><b>DB 테이블은 어떻게 읽는가?</b><span>행·열·키와 17개 테이블 ERD</span></a>
<a class="qcard" href="#design.calc" data-go="design.calc"><b>오늘 쓸 수 있는 돈은 어디서 계산하는가?</b><span>BudgetCalculator와 계산 시뮬레이터</span></a>
<a class="qcard" href="#design.auth" data-go="design.auth"><b>로그인을 서버는 어떻게 알아보는가?</b><span>JWT와 token_version</span></a>
<a class="qcard" href="#change" data-go="change"><b>이 기능을 바꾸려면 어디를 봐야 하는가?</b><span>상황별 파일·영향·테스트</span></a>
</div>
${h2("home.real", "실제 앱에 있는 것과 없는 것")}
<p>이 저장소의 앱(Android·웹)에 있는 기능만 다룬다. 계좌 연결, AI 소비 분석·추천, 결제 알림·문자 자동 기록, 예정 지출·정산은 <b>시연에만</b> 있고 실제 앱에는 없다. 시연은 별도 저장소 <code>shinds-team7/flexable-web</code>의 <code>/m</code>에 있다(<code>docs/FEATURES.md</code> {{b:doc}}). 분석 탭의 '소비 분석'은 입력한 기록을 기간별로 더한 <b>집계</b>이고 AI가 아니다(<code>AnalysisController</code> {{b:code}}).</p>
<div class="two">
<div class="box-ok"><b>실제 앱(이 저장소)</b>${ul(["이메일·카카오·Google 가입·로그인", "초기 예산 설정 8단계", "오늘·이번 주 쓸 수 있는 돈(서버 계산)", "거래 직접 기록·수정·삭제, 카테고리", "고정지출 자동 기록(조회할 때 서버가 기록)", "기간별 지출 집계(분석 탭)", "시드머니, 코인·코스튬·추천 코드", "웹사이트 연동 코드(선택 동의)", "계정·데이터 삭제"])}</div>
<div class="box-no"><b>시연에만 있거나 아직 없음</b>${ul(["계좌 연결(오픈뱅킹)", "AI 소비 분석·추천", "결제 알림·문자 자동 기록, 서버 푸시", "예정 지출·고액 지출 계획, 정산", "비밀번호 찾기, 이메일 인증", "오프라인 저장(앱은 온라인 전용)"])}</div></div>
${h2("home.legend", "표기 읽는 법")}
<p>문장마다 근거의 종류를 배지로 붙였다. 코드에 있다고 운영에 배포됐다는 뜻이 아니고, 테스트를 읽었다고 통과했다는 뜻이 아니다.</p>
<div class="legend">{{b:code}} 구현 코드에서 확인 · {{b:config}} 설정·배포 파일 · {{b:doc}} 문서에만 기록된 운영 현황 · {{b:test}} 테스트가 검증하도록 작성된 내용 · {{b:ran}} 이번에 직접 실행해 확인 · {{b:ci}} GitHub Actions 결과 확인 · {{b:infer}} 설계 의도 추론 · {{b:suggest}} 개선 제안 · {{b:unknown}} 미확인</div>
${h2("home.use", "이 가이드 쓰는 법")}
${ul([
  "위쪽 검색(<kbd>/</kbd>)에 기능·파일·함수·API·테이블·컬럼·용어를 치면 바로 그 설명으로 간다. 예: <code>idempotency</code>, <code>postDue</code>, <code>token_version</code>, <code>PATCH</code>.",
  "<span class=\"fold-tag inline\">기초</span> 상자는 처음 보는 개념, <span class=\"fold-tag inline deep\">상세</span> 상자는 더 깊은 동작이다. 위쪽 버튼으로 한꺼번에 펼치거나 접을 수 있다.",
  "파란 글씨 링크(기능·화면·API·코드·테이블·테스트·용어)를 누르면 그 항목 페이지가 열리고, 거기서 다시 연결된 항목으로 간다.",
  "코드 상자의 경로·줄 번호는 커밋 <code>" + SHA.slice(0, 7) + "</code>의 실제 파일에서 뽑았다. ↗ 링크는 같은 커밋에 고정된 GitHub 주소(새 탭)다. 외부 링크를 열지 않아도 내용은 가이드 안에 다 있다.",
  "오른쪽 위 <b>발표</b>로 바꾸면 멘토 리뷰용 10분 발표 화면이 된다. 같은 데이터를 쓰므로 학습 내용과 다른 말을 하지 않는다.",
])}`,
  };

  const paths = {
    id: "paths", title: "학습 경로", group: "시작",
    summary: "30분, 2시간, 심화 순서와 확인 질문",
    html: `${h2("paths.30", "30분: 전체 그림과 대표 요청 하나")}
<p><b>목표</b>: 앱·서버·DB가 각각 무엇을 하는지 말할 수 있고, 거래 저장 한 번이 어떤 파일을 지나는지 순서대로 짚을 수 있다.</p>
${steps([
  ["{{v:arch.inputs|사용자가 입력하는 값과 서버가 계산하는 값}} (5분)", "앱은 입력만 받고 계산은 서버가 한다."],
  ["{{v:arch.diagram|전체 구조도}} (5분)", "앱/웹 → HTTPS·JSON → Caddy → Spring Boot → SQL → MySQL."],
  ["{{v:flow-tx|거래 등록 1~11단계}} (15분)", "{{c:TransactionForm}} <code>save()</code> → {{c:apiClient}} <code>api()</code> → {{c:SecurityConfig}} → {{c:TransactionController}} <code>create</code> → {{c:TransactionService}} <code>create</code> → {{c:TransactionRepository}} <code>save</code> → {{t:transactions}}"],
  ["아래 확인 질문 (5분)", ""],
])}
${quiz([
  ["앱이 '오늘 쓸 수 있는 돈'을 직접 계산하는가?", "아니다. 서버 <code>BudgetCalculator</code>가 계산한 값을 <code>GET /budget/today</code>로 받아 보여 주기만 한다(AGENTS.md 규칙)."],
  ["거래를 저장할 때 서버는 '누구의 거래'인지 어떻게 아는가?", "요청 헤더의 JWT. 본문에는 userId가 없다."],
  ["저장 요청 한 번에 서버 안에서 트랜잭션은 몇 개 열리는가?", "로컬 로그 기준 두 개: 보안 필터의 사용자 확인(읽기 전용)과 거래 저장."],
])}
${h2("paths.120", "2시간: 핵심 코드와 DB 관계")}
<p><b>목표</b>: 프론트·백엔드 폴더 구조를 설명하고, 등록과 수정이 DB에 반영되는 방식의 차이를 말하고, 테이블을 직접 SELECT해 본다.</p>
${steps([
  ["30분 경로 전체", ""],
  ["{{v:front.routing|프론트 라우팅}} → {{v:front.session|세션·저장소·API 클라이언트}} (15분)", "{{c:Session}}, {{c:storage}}, {{c:serviceUi|useResource}}"],
  ["{{v:back.layers|백엔드 계층}} → {{v:back.di|DI와 어노테이션}} → {{v:back.jpa|JPA가 하는 일}} (20분)", ""],
  ["{{v:flow-tx.s12|거래 수정 12~16단계}} + 아래 질문 8개 (20분)", "save() 없는 수정, flush와 commit, rollback, 재시도 중복 방지"],
  ["{{v:db.erd|ERD}} → {{t:transactions}}·{{t:categories}}·{{t:budget_settings}} 상세 (15분)", ""],
  ["{{v:design.calc|오늘 쓸 수 있는 돈 계산식}} + 시뮬레이터 (10분)", "{{c:BudgetCalculator}} <code>compute</code>"],
  ["{{v:db-lab|직접 테이블 보기}}: 로컬 서버를 켜고 SELECT 3개 (10분)", ""],
])}
${quiz([
  ["<code>TransactionService.update</code>에 <code>save()</code>가 없는데 DB가 바뀌는 이유는?", "트랜잭션 안에서 읽은 엔티티는 영속성 컨텍스트가 관리하고, commit 직전 flush에서 변경 감지로 UPDATE가 나간다."],
  ["거래 테이블에서 '남의 것'을 막는 조건 열은?", "<code>user_id</code>. <code>findByIdAndUserId</code>."],
  ["카테고리를 지우면 그 카테고리의 거래는?", "같은 종류의 기본 '기타'/'기타 수입'으로 옮겨진다. FK에 연쇄 삭제가 없어서 옮기지 않으면 지울 수 없다."],
])}
${h2("paths.deep", "심화: 인증, 트랜잭션, 중복 방지, 동시성, 테스트")}
<p><b>목표</b>: '왜 이렇게 만들었나'와 '어디가 약한가'를 근거를 들어 말한다. 멘토 리뷰 준비.</p>
${steps([
  ["{{v:design.auth|JWT·token_version·접근 제어}}", "{{c:TokenService}}, {{c:SecurityConfig}} <code>converter</code>, {{x:SecurityTest}}"],
  ["{{v:design.idem|Idempotency-Key와 UNIQUE}}", "{{c:TransactionService}} <code>create</code>의 catch, {{x:ApiFlowTest}} 동시 6건"],
  ["{{v:design.fixed|고정지출 자동 기록}}", "{{c:FixedExpensePoster}}의 REQUIRES_NEW / MANDATORY, posting_key"],
  ["{{v:design.coin|코인 지급·구매 동시성}}", "{{c:CoinService}} <code>post</code>, {{c:OutfitService}} <code>purchase</code>(잠금 먼저)"],
  ["{{v:design.late|늦게 도착한 응답}}", "{{c:apiClient}} <code>generation</code>, {{x:unitApiSession}}"],
  ["{{v:ops.tests|테스트 종류}} → 직접 <code>./gradlew test</code> 실행", ""],
  ["{{v:design.limits|현재 구조의 제약}} → {{v:mentor.questions|멘토 질문}}", ""],
])}
${quiz([
  ["로그아웃하면 다른 기기의 토큰은 어떻게 되는가? 왜?", "모두 401. <code>token_version</code>이 1 올라 토큰의 <code>tv</code>와 달라지기 때문(요청마다 DB의 사용자 행을 확인)."],
  ["같은 키로 동시에 6개 요청이 오면 서버 안에서 무슨 일이 일어나는가?", "여럿이 '없음'을 보고 INSERT하지만 UNIQUE가 하나만 받는다. 실패한 쪽은 rollback 뒤 새 트랜잭션에서 저장된 거래를 찾아 200."],
  ["코스튬 구매에서 지갑을 '가장 먼저' 잠그는 이유는?", "MySQL REPEATABLE READ는 트랜잭션의 첫 일반 조회 때 스냅숏을 잡으므로, 잠그기 전에 조회하면 앞 요청이 산 기록을 못 볼 수 있다(코드 주석)."],
])}`,
  };

  const arch = {
    id: "arch", title: "프로젝트 전체 구조", group: "큰 그림",
    summary: "입력·계산, 앱과 웹, 프론트·API·DB, HTTP, 웹 서버·WAS·DB, EC2·RDS, 배포 구성",
    html: `${topic({
      id: "arch.inputs", title: "사용자가 입력하는 정보와 서버가 계산하는 정보",
      problem: "사용자는 '오늘 얼마까지 써도 되나'를 알고 싶다. 은행과 연결하지 않으므로 앱이 아는 것은 사용자가 직접 넣은 값뿐이다.",
      role: table(["사용자가 직접 입력(저장되는 값)", "서버가 계산(조회할 때마다 다시 계산)"], [
        ["잔액과 그 기준 시각 → {{t:budget_settings}} <code>balance</code>, <code>balance_at</code>", "추정 잔액 = 잔액 + 기준 시각 이후 수입 − 지출 − 시드머니로 옮긴 돈"],
        ["수입일(1~31), 예정 수입액, 카드 미결제액", "다음 수입일(주말·공휴일이면 다음 평일), 남은 날 수"],
        ["고정지출 목록 → {{t:fixed_expenses}}", "남은 고정지출 예정액, 날짜가 된 고정지출의 자동 기록"],
        ["매달 저축할 돈 → {{t:protected_items}}, 모아둔 돈 <code>seed_base</code>", "남은 생활비 = 추정 잔액 − 남은 고정지출 − 카드 미결제 − 저축할 돈"],
        ["거래(지출·수입) → {{t:transactions}}", "하루 예산, <b>오늘 쓸 수 있는 돈</b>, 이번 주 쓸 수 있는 돈, 캐릭터 점수"],
      ]),
      code: "계산은 {{c:BudgetCalculator}} 하나에 모여 있고, {{c:BudgetService}} <code>today()</code>가 DB에서 값을 모아 넘긴다. 앱은 {{a:budget-today}}의 응답을 그대로 그린다 {{b:code}}.",
      io: "입력값(DB) → <code>GET /budget/today</code> → 계산 결과 JSON → 홈 화면",
      next: "{{v:design.calc|계산식 자세히}} · {{v:arch.diagram|구조도}}",
    })}
${topic({
      id: "arch.run", title: "앱과 웹의 실행 형태",
      problem: "같은 기능을 Android 앱과 웹에서 모두 쓰게 하려면 화면 코드를 두 번 짜야 할까?",
      basics: basic("Expo·React Native가 하는 일", p("React로 화면을 짜면 React Native가 Android 네이티브 화면으로, react-native-web이 브라우저 화면으로 바꿔 준다. Expo는 그 빌드·배포 도구 묶음이다. 그래서 <code>frontend/</code> 하나로 Android 앱과 웹을 함께 만든다.")),
      role: table(["", "Android 앱", "웹"], [
        ["빌드", "EAS Build(AAB/APK) {{b:config}}", "<code>npx expo export -p web</code> → <code>dist/</code> {{b:config}}"],
        ["배포", "Google Play 비공개 테스트 1.4.0 {{b:doc}}", "Vercel이 <code>main</code> 머지 때 자동 배포 {{b:doc}}"],
        ["JS 바뀐 것 반영", "EAS Update(원격 업데이트)", "다시 배포하면 끝"],
        ["토큰 저장", "SecureStore", "localStorage"],
        ["API 주소", "EAS 환경변수 <code>EXPO_PUBLIC_API_URL</code>", "<code>.env.production</code>"],
      ]),
      code: "분기는 몇 군데뿐이다: {{c:storage}}(<code>Platform.OS === \"web\"</code>), <code>DateTimeField.tsx</code>/<code>DateTimeField.web.tsx</code>, <code>seedReminder.ts</code>/<code>seedReminder.web.ts</code>(파일 이름 끝 <code>.web</code>이면 웹에서 그 파일을 쓴다), {{c:RootLayout}}(Android만 필수 업데이트 창).",
      io: "같은 소스 → 두 빌드 → 같은 API 서버",
      next: "{{v:front|프론트엔드 코드 지도}}",
    })}
${topic({
      id: "arch.roles", title: "프론트엔드, API 서버, DB의 역할",
      problem: "화면에서 바로 DB에 저장하면 안 되나?",
      basics: basic("왜 세 층으로 나누나", p("앱은 사용자 기기에서 돈다. 기기 안의 코드는 누구나 들여다보고 고칠 수 있으므로 DB 비밀번호를 넣을 수 없고, 앱이 보낸 값을 그대로 믿을 수도 없다. 그래서 믿을 수 있는 곳(서버)에서 검사·계산하고, 서버만 DB에 접근한다.")),
      role: table(["층", "맡은 일", "우리 코드"], [
        ["프론트엔드(앱·웹)", "입력받기, 서버에 요청, 받은 값 그리기. 계산·권한 판단은 하지 않는다", "<code>frontend/src</code>"],
        ["API 서버", "토큰 확인, 입력 검증, 소유자 확인, 계산, 트랜잭션, DB 읽기·쓰기", "<code>backend/src/main/java/com/flexable/api</code>"],
        ["DB", "데이터 보관과 제약(FK·UNIQUE)으로 마지막 방어", "MySQL(RDS) · <code>db/migration</code>"],
      ]),
      code: "프론트가 서버를 부르는 곳은 {{c:apiClient}} 하나, 서버가 DB를 부르는 곳은 리포지토리 인터페이스들이다.",
      io: "사용자 입력 → (HTTP) → 서버 규칙 → (SQL) → DB",
      next: "{{v:arch.http|HTTP와 JSON}}",
    })}
${topic({
      id: "arch.http", title: "HTTP 요청·응답과 JSON",
      problem: "앱과 서버는 서로 다른 언어(TypeScript·Java)인데 어떻게 데이터를 주고받나?",
      basics: basic("HTTP 요청 한 개의 생김새", `<pre class="code-plain" data-copy>PATCH /api/v1/transactions/1 HTTP/1.1          ← 메서드 + 주소
Authorization: Bearer eyJ…                        ← 헤더(누가)
Content-Type: application/json                    ← 헤더(본문 형식)

{"amount":10000}                                  ← 본문(JSON)</pre>${p("응답도 같은 모양이다: <code>HTTP/1.1 200 OK</code> + 헤더 + JSON 본문. JSON은 글자일 뿐이라 어느 언어든 읽고 쓸 수 있다. 앱은 <code>JSON.stringify</code>/<code>res.json()</code>, 서버는 Jackson이 자바 record ↔ JSON을 바꾼다.")}`, true) +
        basic("상태 코드로 결과를 나눈다", table(["코드", "뜻", "이 앱의 예"], [["200·201·204", "성공(201=새로 만듦, 204=본문 없음)", "거래 등록 201, 같은 키 재전송 200, 삭제 204"], ["400", "입력이 잘못됨", "<code>VALIDATION_FAILED</code> + <code>fields</code>"], ["401", "로그인 필요·토큰 무효", "<code>UNAUTHORIZED</code> → 앱이 시작 화면으로"], ["404", "없음(남의 것 포함)", "<code>NOT_FOUND</code>, <code>BUDGET_NOT_SET</code>"], ["409", "지금 상태와 충돌", "<code>CATEGORY_DUPLICATE</code>, <code>OUTFIT_OWNED</code>"], ["429", "너무 많이 시도", "<code>TOO_MANY_ATTEMPTS</code>"], ["500", "서버 오류", "<code>INTERNAL_ERROR</code>"]])),
      role: "모든 API는 <code>/api/v1</code> 아래 JSON을 주고받는다. 오류도 항상 <code>{ \"code\": …, \"message\": … }</code> 모양이라 앱은 <code>code</code>로 분기하고 <code>message</code>를 그대로 보여 준다 {{b:code}}. 금액은 원 단위 정수, 시각은 <code>+09:00</code>이 붙은 ISO 문자열이다.",
      code: snip("fe-client-api") + snip("be-exception-handler"),
      io: "JS 객체 → JSON 글자 → (네트워크) → 자바 DTO → … → 자바 DTO → JSON 글자 → JS 객체",
      next: "{{v:arch.servers|웹 서버·WAS·DB 서버}}",
    })}
${topic({
      id: "arch.servers", title: "웹 서버, WAS, DB 서버의 차이",
      problem: "'서버'라는 말이 여러 가지를 가리켜 헷갈린다.",
      role: table(["구분", "하는 일", "이 프로젝트에서"], [
        ["웹 서버", "요청을 처음 받는 문지기. HTTPS 인증서, 정적 파일, 다른 서버로 넘기기(리버스 프록시)", "<b>Caddy</b>(EC2의 caddy 컨테이너): HTTPS를 풀고 <code>api:8080</code>으로 넘긴다 {{b:config}}. 웹 앱의 HTML·JS 파일은 <b>Vercel</b>이 준다"],
        ["WAS(애플리케이션 서버)", "요청마다 코드를 실행해 답을 만든다", "<b>Spring Boot</b> 안의 Tomcat이 <code>app.jar</code>를 실행(api 컨테이너)"],
        ["DB 서버", "데이터를 저장하고 SQL에 답한다", "<b>MySQL</b>(AWS RDS). 로컬·테스트는 H2"],
      ]),
      code: snip("cfg-caddy") + snip("cfg-compose"),
      io: "인터넷 → Caddy(443) → api(8080) → RDS(3306)",
      next: "{{v:arch.diagram|구조도}}",
    })}
${h2("arch.diagram", "전체 구조도")}
${archSvg()}
${topic({
      id: "arch.ec2rds", title: "EC2와 RDS가 맡는 역할",
      problem: "서버 한 대에 DB까지 같이 두면 안 되나?",
      basics: basic("EC2·RDS란", p("EC2는 AWS가 빌려주는 가상 컴퓨터다. 운영체제부터 직접 관리한다. RDS는 AWS가 MySQL 같은 DB를 대신 운영해 주는 서비스다. 설치·패치·자동 백업을 AWS가 맡고, 우리는 접속 주소와 계정만 쓴다.")),
      role: table(["", "EC2", "RDS"], [
        ["올라가는 것", "Docker, caddy·api 컨테이너, <code>/opt/flexable/.env</code> {{b:config}}", "MySQL DB <code>flexable</code>, 앱 계정 <code>flexable_app</code>(관리자 계정 미사용) {{b:config}}"],
        ["바뀌는 때", "<code>deploy.sh</code>로 새 <code>app.jar</code>를 올릴 때", "새 app.jar가 켜질 때 Flyway가 새 마이그레이션을 적용할 때"],
        ["접근", "80·443 공개, 22는 관리자 IP만(문서)", "퍼블릭 접근 없음, EC2에서만(문서). 연결은 TLS 필수(<code>sslMode=REQUIRED</code>, 설정)"],
        ["상태(문서 기록)", "Ubuntu, t3.micro, 루트 디스크 15GB(10-20 확인 기록) {{b:doc}}", "자동 백업 보관 7일(10-14 설정 기록) {{b:doc}}"],
      ]),
      code: "앱 계정 권한은 <code>backend/deploy/setup-db.sh</code>에서 <code>SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES</code>로 준다 {{b:config}}. DDL 권한이 있는 이유는 Flyway가 같은 계정으로 스키마를 바꾸기 때문이다 {{b:infer}}.",
      io: "API 컨테이너(EC2) —JDBC/TLS→ RDS",
      next: "{{v:arch.deploy|배포 구성}} · {{v:ops.schema|앱 변경과 스키마 변경의 관계}}",
    })}
${h2("arch.deploy", "실제 배포 구성: 프록시·컨테이너·애플리케이션")}
${deploySvg()}
${p("배포 파일에서 읽을 수 있는 사실 {{b:config}}:")}
${ul([
  "서버에서 Gradle 빌드를 하지 않는다. 개발자 PC에서 만든 <code>app.jar</code>를 올리고 Dockerfile은 JRE 위에 복사만 한다(주석: t3.micro에서 빌드를 피하려고).",
  "api 컨테이너는 포트를 <b>밖에 열지 않고</b>(<code>expose</code>) caddy만 80·443을 연다(<code>ports</code>). 바깥에서 8080으로 바로 들어올 수 없다.",
  "JVM 시간대는 UTC(<code>-Duser.timezone=UTC</code>), 앱의 '오늘'은 설정값 <code>app.zone: Asia/Seoul</code>로 계산한다.",
  "메모리 제한 700MB, 힙 448MB. 헬스체크는 30초마다 <code>/api/v1/health</code>.",
  "비밀값은 서버 <code>/opt/flexable/.env</code>에만 있고 저장소에는 양식(<code>.env.example</code>)만 있다.",
])}
${snip("cfg-dockerfile")}${snip("cfg-deploy-sh", "주소는 가이드에서 가렸다")}
${topic({
      id: "arch.dbs", title: "운영 MySQL, 로컬 H2, 테스트 DB의 차이",
      problem: "개발할 때마다 MySQL을 설치해야 하나?",
      role: table(["", "운영", "로컬 실행(local 프로필)", "백엔드 테스트"], [
        ["DB", "MySQL 8(RDS)", "H2 파일 <code>backend/build/localdb/</code>", "H2 메모리(<code>jdbc:h2:mem:test</code>)"],
        ["설정 파일", "<code>application.yml</code> + 서버 <code>.env</code>", "<code>application-local.yml</code>", "<code>src/test/resources/application.yml</code>"],
        ["모드", "—", "<code>MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE</code>", "<code>MODE=MySQL;DATABASE_TO_LOWER=TRUE</code>"],
        ["스키마", "Flyway V1~V11 (문서상 운영 적용 10-23 {{b:doc}})", "Flyway가 처음 켤 때 V1~V11 적용(직접 확인 {{b:ran}})", "테스트 시작 때 Flyway 적용"],
        ["데이터 수명", "영구", "폴더를 지울 때까지", "테스트 실행이 끝나면 사라짐"],
      ]),
      code: snip("cfg-local-yml") + snip("cfg-test-yml") + "H2 드라이버는 <code>developmentOnly</code>·<code>testRuntimeOnly</code>라서 운영 <code>app.jar</code>에는 들어가지 않는다 {{b:config}}. " + snip("cfg-gradle-deps"),
      io: "같은 마이그레이션 SQL → 세 DB에 같은 테이블",
      next: "{{v:db-lab.h2mysql|H2와 MySQL이 다른 점}}",
    })}
${topic({
      id: "arch.web", title: "별도 웹사이트(flexable-web)와의 경계",
      problem: "웹사이트에도 로그인·시드머니 화면이 있는데, 그건 이 서버인가?",
      role: `<p>아니다. 데스크톱 웹사이트와 시연은 <b>다른 저장소</b>(<code>shinds-team7/flexable-web</code>)에 있고, 자기 서버·DB·계정을 따로 운영한다(2026-10-20 결정, AGENTS.md {{b:doc}}). 이 저장소에서 보이는 것은 경계 API까지다 {{b:code}}:</p>
${ul([
  "앱 사용자 쪽: {{a:wl-code}}(6자리 코드), {{a:wl-list}}, {{a:wl-delete}} — 사용자 토큰",
  "웹 서버 쪽: {{a:int-link}}, {{a:int-profile}}, {{a:int-seed}}, {{a:int-unlink}} — <code>X-Service-Key</code>, 사용자 토큰으로는 열리지 않음, CORS 없음(서버끼리)",
  "웹에 주는 것: 회원 이메일·로그인 방법, 확정된 시드머니 기록. 거래 원본은 주지 않는다.",
])}
<p class="note">웹 서버가 이 API를 실제로 어떻게 부르는지, 웹의 DB 구조는 이 저장소에 없어서 확인하지 않았다 {{b:unknown}}. 웹 서버와 붙인 실서버 전체 흐름 확인 기록도 없다(HANDOFF {{b:doc}}).</p>`,
      next: "{{v:flows.weblink|앱·웹 연동 흐름}}",
    })}
${h2("arch.demo", "시연·미구현 기능과 '분석'의 정확한 뜻")}
<p>홈 화면 문구 규칙(AGENTS.md): "입력한 잔액·기록 기준 추정"으로 설명하고, "계좌 연결", "최근 6개월 거래", "소비 패턴 분석"처럼 없는 기능을 암시하는 말은 쓰지 않는다. 분석 탭이 하는 일은 {{a:analysis}}: 기간 안 거래를 카테고리·날짜별로 <b>더하고 비율을 내는 것</b>이 전부다 {{b:code}}. 머신러닝·추천·외부 AI 호출 코드는 백엔드에 없다 {{b:code}}.</p>`,
  };
  return [home, paths, arch];
}
