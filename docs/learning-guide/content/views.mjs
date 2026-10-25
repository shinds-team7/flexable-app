import { h2, h3, p, basic, deep, note, snip, ul, ol, table, quiz, steps } from "./h.mjs";
import { viewsA } from "./views-a.mjs";
import { viewsB } from "./views-b.mjs";
import { viewsC } from "./views-c.mjs";
import { viewsD } from "./views-d.mjs";
import { laneSvg } from "./diagrams.mjs";

export const TOC = [
  { g: "시작", items: ["home", "paths"] },
  { g: "큰 그림", items: ["arch"] },
  { g: "코드 지도", items: ["front", "back"] },
  { g: "요청 따라가기", items: ["flow-tx", "flows"] },
  { g: "데이터", items: ["db", "db-lab"] },
  { g: "설계", items: ["design"] },
  { g: "실무", items: ["change", "ops"] },
  { g: "발표·점검", items: ["mentor"] },
  { g: "찾아보기", items: ["idx-feature", "idx-screen", "idx-api", "idx-code", "idx-table", "idx-test", "idx-glossary"] },
  { g: "근거", items: ["scope"] },
];

export function build(ctx) {
  const { SC, SHA } = ctx;
  const flowTx = {
    id: "flow-tx", title: "대표 요청 추적: 거래 등록과 수정", group: "요청 따라가기",
    summary: "점심 9,000원 기록 → 10,000원으로 수정, 화면부터 DB 행까지 16단계",
    html: `<p class="lead">사용자가 <b>점심 지출 9,000원을 기록하고, 내역에서 10,000원으로 고친다.</b> 그 사이 코드가 지나는 모든 층을 단계별로 따라간다. 1~11단계가 등록(POST), 12~16단계가 수정(PATCH)이다.</p>
${note("info", "요청·응답 JSON은 실제 API 계약(DTO·<code>docs/contracts/app-api.yaml</code>)에 맞춘 <b>가상 예시</b>다(사용자 learner@example.com, 2026-10-13). '실행 로그' 상자는 2026-10-24 로컬 H2 서버에서 같은 요청을 실제로 보내 캡처한 것이라 날짜가 다르다 {{b:ran}}. 값을 넣어 보여 주는 SQL은 '개념 예시'라고 적었다.")}
${laneSvg()}
<div id="flow-slot"></div>
${h2("flow-tx.diff", "등록과 수정의 차이")}
${table(["", "등록(POST /transactions)", "수정(PATCH /transactions/{id})"], [
  ["화면", "<code>/transactions/new</code>, 빈 폼", "<code>/transactions/1</code>, 서버에서 읽어 채운 폼(같은 컴포넌트)"],
  ["재시도 키", "<code>Idempotency-Key</code> 보냄", "보내지 않음(같은 값을 다시 정해도 결과가 같으므로)"],
  ["트랜잭션", "<code>TransactionTemplate</code>(코드로) — 충돌 뒤 새 트랜잭션에서 다시 찾으려고", "<code>@Transactional</code>(어노테이션)"],
  ["소유자 확인", "카테고리만(<code>requireForType</code>)", "거래(<code>findByIdAndUserId</code>) + 카테고리"],
  ["SQL", "<code>save()</code> 때 바로 INSERT(IDENTITY)", "<code>save()</code> 없음, commit 직전 flush에서 UPDATE(모든 열)"],
  ["응답", "201(같은 키 재전송이면 200)", "200"],
  ["DB 변화", "transactions에 행 추가", "같은 행의 amount·updated_at 변경"],
])}
${h2("flow-tx.faq", "꼭 답할 수 있어야 하는 질문")}
<div id="faq-slot"></div>`,
  };

  const mentor = {
    id: "mentor", title: "멘토 리뷰·발표 준비", group: "발표·점검",
    summary: "10분 발표 흐름, 30초·3분·5분 설명, 멘토님께 여쭐 설계 질문, 이해도 점검",
    html: `<p>발표 모드(오른쪽 위 <b>발표</b> 또는 <button class="btn-inline" data-action="present">지금 열기</button>)는 이 가이드와 같은 데이터로 그린다. 질문이 나오면 장면의 '자세히' 버튼으로 학습 내용·코드·테이블로 바로 간다.</p>
${h2("mentor.plan", "10분 발표 흐름")}
${table(["장면", "시간", "말할 것", "보여 줄 것"], [
  ["1. 문제와 실제 구현 범위", "1분", "사회초년생의 '오늘 얼마 써도 되나'. 직접 입력 기반, 계좌 연결·AI는 없음", "{{v:home.real|실제/시연 구분}}"],
  ["2. 전체 아키텍처와 EC2·RDS", "2분", "앱·웹 → Caddy → Spring Boot → RDS MySQL, 별도 웹사이트는 경계 API만", "{{v:arch.diagram|구조도}}"],
  ["3. 대표 요청 흐름", "3분", "거래 등록·수정이 지나는 층, save() 없는 수정, 재시도 중복 방지", "{{v:flow-tx|레인 그림}}"],
  ["4. 핵심 ERD", "1.5분", "user_id 중심, 거래↔카테고리, 논리 관계, Flyway V1~V11", "{{v:db.erd|ERD}}"],
  ["5. 주요 설계와 핵심 코드", "1.5분", "서버 계산식, JWT+token_version, 잠금·UNIQUE", "{{v:design|설계}}"],
  ["6. 제약과 질문", "1분", "GET의 쓰기, 단일 서버 메모리 상태, 고정지출 이름 변경", "{{v:mentor.questions|질문 목록}}"],
])}
${h2("mentor.30s", "30초 프로젝트 소개")}
<blockquote class="script">텅장관리는 사회초년생이 '오늘 얼마까지 써도 되는지'를 알려 주는 생활비 앱입니다. 은행과 연결하지 않고, 사용자가 직접 넣은 잔액·수입일·고정지출·거래로 서버가 계산합니다. 앱과 웹은 Expo 한 코드로 만들고, API는 Spring Boot로 EC2의 Docker에서 돌며 데이터는 RDS MySQL에 있습니다. 지금 Google Play 비공개 테스트 중입니다.</blockquote>
${h2("mentor.3m", "3분 구조 설명")}
<blockquote class="script"><p>화면은 <code>frontend/src/app</code>의 경로 파일이 <code>src/service</code>의 화면 컴포넌트를 부르는 구조이고, 서버 호출은 전부 <code>api/client.ts</code>의 <code>api()</code> 하나를 지납니다. 여기서 토큰과 재시도 키를 붙입니다.</p>
<p>요청은 HTTPS로 EC2의 Caddy에 닿고, Caddy가 같은 Docker 네트워크의 API 컨테이너로 넘깁니다. 서버는 보안 필터에서 JWT 서명을 확인하고 DB의 token_version까지 맞춰 본 다음 컨트롤러 → 서비스 → 리포지토리 순서로 갑니다. 서비스가 소유자 확인과 계산, 트랜잭션을 맡고, 리포지토리는 Spring Data JPA 인터페이스입니다.</p>
<p>DB는 Flyway 마이그레이션 V1~V11로 만든 17개 테이블이고, 거의 모두 user_id로 users를 가리킵니다. 엔티티는 객체 연관관계 없이 ID만 갖습니다. 오늘 쓸 수 있는 돈은 저장하지 않고 조회할 때마다 BudgetCalculator가 계산합니다. 별도 데스크톱 웹사이트는 자기 서버·DB를 쓰고, 이 서버와는 서비스 키로 여는 internal API로만 연결됩니다.</p></blockquote>
${h2("mentor.5m", "5분 거래 저장 흐름 설명")}
<blockquote class="script"><ol>
<li>거래 화면은 등록과 수정이 같은 <code>TransactionForm</code>입니다. 입력은 React state에 있다가, 저장을 누르면 <code>save()</code>가 연타를 ref로 막고 재시도 키를 한 번 만들어 <code>POST /api/v1/transactions</code>를 보냅니다. 본문에 userId는 없습니다.</li>
<li>서버 보안 필터가 토큰 서명·만료를 보고, users 행의 token_version과 비교합니다. 로그를 보면 모든 인증 요청마다 이 조회가 한 번 나갑니다.</li>
<li>컨트롤러는 DTO로 받으면서 <code>@Valid</code>로 금액·제목을 검사하고, 토큰에서 userId를 꺼내 서비스로 넘깁니다.</li>
<li>서비스는 트랜잭션 안에서 같은 키로 만든 거래가 있는지 보고, 카테고리가 내 것이고 지출용인지 확인한 뒤 엔티티를 저장합니다. ID를 DB가 정하므로 INSERT가 바로 나가고, 메서드가 끝나면 commit, 201을 줍니다.</li>
<li>같은 키로 동시에 와도 DB UNIQUE가 하나만 받고, 진 쪽은 새 트랜잭션에서 저장된 거래를 찾아 200을 줍니다. 테스트가 동시 6건으로 확인합니다.</li>
<li>수정은 PATCH이고 키가 없습니다. 서비스가 id와 user_id로 찾아 남의 것이면 404를 주고, 엔티티 필드만 바꾸고 save를 부르지 않습니다. commit 직전 변경 감지로 UPDATE가 나갑니다.</li>
<li>앱은 성공하면 세션의 revision을 올리고 돌아가며, 홈이 다시 앞에 나올 때 오늘 예산을 다시 읽습니다. 숫자는 늘 서버가 다시 계산한 값입니다.</li></ol></blockquote>
${h2("mentor.questions", "멘토님께 확인받고 싶은 설계 질문")}
${p("코드를 분석한 결과에서 골랐다. 형식: <b>현재 구현</b> → <b>선택의 효과와 한계</b> → <b>질문</b>.")}
<div class="mq">
<div class="mqi"><b>1. 조회 API가 쓰기를 한다</b><p><span class="mql">현재</span> <code>GET /budget/today</code>가 날짜가 된 고정지출을 거래로 기록하고 오늘의 하루 예산을 저장한다. 내역·분석·시드머니 조회도 기록을 먼저 한다({{c:FixedExpensePoster}}).</p><p><span class="mql">효과·한계</span> 스케줄러 없이 단일 서버에서 맞는 값을 보여 준다. 대신 GET이 안전한(읽기만 하는) 요청이 아니고, 사용자가 앱을 안 연 날은 기록이 늦어진다.</p><p><span class="mql">질문</span> 지금 규모에서 이 방식이 괜찮은지, 예약 작업이나 별도 쓰기 API로 나눠야 하는 신호는 무엇인지.</p></div>
<div class="mqi"><b>2. JWT + DB 확인</b><p><span class="mql">현재</span> 30일 JWT, refresh 없음. 요청마다 users 행의 token_version을 확인한다({{c:SecurityConfig}}). 로그아웃하면 모든 기기가 끊긴다.</p><p><span class="mql">효과·한계</span> 로그아웃·탈퇴가 즉시 반영된다. 대신 요청마다 조회가 하나 늘고 '이 기기만 로그아웃'을 할 수 없다.</p><p><span class="mql">질문</span> 이 구조를 유지하면서 보완할 점(만료 기간, 기기별 토큰 등)이 있는지.</p></div>
<div class="mqi"><b>3. ID만 저장하는 엔티티와 소유자 검사</b><p><span class="mql">현재</span> 엔티티에 연관관계가 하나도 없고 <code>userId</code>·<code>categoryId</code>만 갖는다. 소유자 조건은 리포지토리 메서드마다 사람이 넣는다.</p><p><span class="mql">효과·한계</span> SQL이 예측 가능하고 지연 로딩 문제가 없다. 대신 조건을 빠뜨리면 남의 데이터가 보인다. 접근 제어 테스트({{x:SecurityTest}})는 거래·카테고리만 다룬다.</p><p><span class="mql">질문</span> 새 기능에서 소유자 조건 누락을 막는 실무 방법(공통 테스트, 리포지토리 규칙 등).</p></div>
<div class="mqi"><b>4. 재시도 중복 방지의 범위</b><p><span class="mql">현재</span> <code>Idempotency-Key</code>는 거래 등록에만 있다. 다른 POST는 행 잠금과 UNIQUE로 '한 번만'을 보장하고 재시도하면 409를 받는다.</p><p><span class="mql">효과·한계</span> 가장 자주 쓰는 저장은 안전하다. 다른 요청은 재시도 때 사용자에게 '이미 했어요'가 보인다.</p><p><span class="mql">질문</span> 키를 더 넓힐 필요가 있는지, 지금 경계가 합리적인지.</p></div>
<div class="mqi"><b>5. 거래 수정의 동시성</b><p><span class="mql">현재</span> PATCH가 모든 열을 다시 쓰고(로그 확인) 잠금·버전이 없다. 앱도 화면의 모든 필드를 보낸다.</p><p><span class="mql">효과·한계</span> 단순하다. 같은 거래를 두 기기에서 동시에 고치면 나중 요청이 이긴다.</p><p><span class="mql">질문</span> 개인 가계부에서 이 정도면 충분한지, <code>@Version</code>을 둘 가치가 있는지.</p></div>
<div class="mqi"><b>6. 서버 메모리에 있는 상태</b><p><span class="mql">현재</span> 로그인 실패 제한, 웹 연동 실패 제한, 소셜 로그인 state·코드가 메모리에 있다. API.md에 '여러 인스턴스 전 공유 저장소로 교체'라고 적혀 있다.</p><p><span class="mql">효과·한계</span> 서버 한 대에서는 단순하고 빠르다. 재시작하면 사라지고, 두 대가 되면 따로 센다.</p><p><span class="mql">질문</span> 언제 Redis 같은 공유 저장소로 옮기는 것이 맞는지.</p></div>
<div class="mqi"><b>7. 고정지출 설정 변경 시 기록을 이어받는 규칙</b><p><span class="mql">현재</span> 기록 키는 날짜·일자·이름·순번을 사용한다. #129는 이름 변경으로 사라진 항목의 기록을 같은 날짜의 새 항목이 이어받게 고쳤다({{v:design.fixed|코드와 회귀 테스트}}).</p><p><span class="mql">효과·한계</span> 기존 기록 키와 호환되고 이름만 바꿔도 지난 날짜를 다시 빼지 않는다. 같은 저장에서 삭제한 항목과 새로 추가한 항목도 이름 변경처럼 다룬다.</p><p><span class="mql">질문</span> 항목 id가 저장마다 바뀌는 현재 구조에서, 변하지 않는 id로 수정과 추가를 구분하도록 바꿀 필요가 있는지.</p></div>
<div class="mqi"><b>8. 테스트 DB와 운영 DB</b><p><span class="mql">현재</span> 테스트·로컬은 H2(MySQL 모드), 운영은 MySQL. 로컬 H2에서는 시각이 한국 시각으로 저장되는 것을 확인했고, 운영은 UTC 설정이다. 코드 주석이 MySQL 격리 수준을 전제로 잠금 순서를 정한 곳이 있다.</p><p><span class="mql">효과·한계</span> 설치 없이 빠르게 테스트한다. MySQL에서만 생기는 문제는 테스트가 못 잡는다.</p><p><span class="mql">질문</span> Testcontainers 같은 MySQL 테스트를 어느 범위까지 들이면 좋을지.</p></div>
<div class="mqi"><b>9. 손으로 쓴 API 계약과 손으로 맞춘 앱 타입</b><p><span class="mql">현재</span> 10-25부터 OpenAPI 계약(<code>docs/contracts/*.yaml</code>)을 사람이 먼저 쓰고, {{x:ContractTest}}가 실제 응답이 계약과 같은지(스펙에 없는 필드까지) 검사한다. 계약에서 만든 프론트 타입 <code>schema.d.ts</code>는 있지만 화면 코드는 아직 손으로 맞춘 {{c:types}}를 쓴다.</p><p><span class="mql">효과·한계</span> 서버 응답이 계약을 벗어나면 CI가 막는다. 앱 쪽 타입과 계약의 차이는 아직 아무것도 검사하지 않는다.</p><p><span class="mql">질문</span> 화면 코드를 생성 타입으로 옮기는 게 좋을지, 아니면 코드에서 스펙을 만드는 방식(springdoc 등)이 이 규모에 더 맞을지.</p></div>
</div>
${h2("mentor.quiz", "이해도 점검 질문과 해설")}
${quiz([
  ["앱이 보내는 거래 등록 본문에 userId가 없는데, 서버는 어떻게 주인을 정하나?", "JWT의 <code>sub</code>. 보안 필터가 검증한 토큰을 컨트롤러가 <code>@AuthenticationPrincipal</code>로 받아 <code>CurrentUser.id(jwt)</code>로 꺼낸다."],
  ["남의 거래를 PATCH하면 403이 아니라 404인 이유는?", "<code>findByIdAndUserId</code>가 0행이라 '없음'으로 처리한다. 남의 거래가 있는지조차 알려 주지 않는다."],
  ["DTO와 Entity를 나누는 이점 두 가지는?", "① 받아선 안 되는 값(userId, idempotencyKey 등)을 요청에서 받지 않는다 ② DB 열을 바꿔도 API 모양을 따로 지킬 수 있다(응답에 카테고리 이름 같은 다른 테이블 값도 넣는다)."],
  ["<code>update()</code>에 save가 없는데 언제 UPDATE가 나가나?", "메서드가 끝나 commit하기 직전 flush에서. 로그에서 'Committing' 다음에 update가 찍힌다."],
  ["flush 후 rollback되면 DB는?", "flush로 보낸 SQL도 취소된다. commit 전에는 확정이 아니다."],
  ["같은 Idempotency-Key 요청 두 개가 동시에 오면?", "둘 다 INSERT를 시도하지만 UNIQUE가 하나만 받는다. 진 쪽은 rollback 뒤 새 트랜잭션에서 저장된 거래를 찾아 200."],
  ["오늘 9,000원을 쓰면 하루 예산(dailyBudget)은 줄어드나?", "아니다. 하루 예산 = (남은 생활비 + 오늘 쓴 돈) ÷ 남은 날이라 그대로이고, 오늘 쓸 수 있는 돈만 9,000원 준다."],
  ["잔액을 10:00에 입력했다. 09:00 지출은 추정 잔액에서 빠지나? 오늘 쓴 돈에는?", "추정 잔액에서는 안 빠진다(이미 잔액에 반영). 오늘 쓴 돈에는 들어간다."],
  ["고정지출 자동 기록은 언제 실행되나?", "예약 작업이 아니다. 오늘 예산·시드머니 조회·반영, 내역·분석 조회를 할 때 먼저 실행된다."],
  ["로그아웃하면 다른 기기 토큰이 바로 막히는 이유는?", "<code>token_version</code>이 1 오르고, 요청마다 서버가 DB 값과 토큰의 <code>tv</code>를 비교하기 때문."],
  ["코스튬 구매에서 잠금을 맨 먼저 거는 이유는?", "MySQL REPEATABLE READ는 첫 일반 조회 때 스냅숏을 잡으므로, 잠그기 전에 조회하면 앞 요청이 산 기록을 못 본다(코드 주석)."],
  ["DB 열을 하나 더하려면 무엇을 바꾸나?", "새 <code>V12__….sql</code> 추가(기존 파일 수정 금지) + 엔티티 <code>@Column</code> + DTO·문서·테스트. 배포한 app.jar가 켜질 때 RDS에 적용된다."],
])}`,
  };

  const scope = {
    id: "scope", title: "분석 기준·검증 범위·미확인 사항", group: "근거",
    summary: "저장소·커밋·날짜, 직접 실행한 검증, 문서와 코드 불일치, 미확인 사항, 가이드 갱신 방법",
    html: `${h2("scope.basis", "분석 기준")}
${table(["항목", "값"], [
  ["저장소", "<code>shinds-team7/flexable-app</code>(공개 저장소)"],
  ["브랜치·커밋", `<code>${ctx.BRANCH || "detached HEAD"}</code> · <code>${SHA}</code>`],
  ["원격 최신 여부", `원본 분석은 main 35e5804 기준. #129·#130 머지 후 main 5e31651, 10-25 작업 방식·정책·계약 PR(#132~#142) 머지 후 main 4b7b2e8을 반영했다. 현재 코드 발췌와 링크는 위 빌드 커밋 기준이다`],
  ["커밋 안 된 변경", ctx.DIRTY ? "분석 대상 코드에 커밋되지 않은 변경 있음. 고정 링크와 다를 수 있다" : "분석 대상 코드에 없음(가이드 자체 변경 제외)"],
  ["분석·갱신 날짜", "최초 분석 2026-10-24, #129·#130 반영 및 백엔드 재검증 2026-10-25 새벽, 정책·계약 테스트와 작업 방식 반영 및 백엔드 재검증 2026-10-25 오후"],
  ["접근하지 못한 자료", "별도 저장소 flexable-web(웹 서버·DB·시연), 운영 서버(EC2)·RDS·로그, EAS·Play Console·Vercel 대시보드. 이것들에 관한 내용은 저장소 문서의 기록만 옮겼다. GitHub Actions는 PR #128·#129·#130의 통과 결과를 확인했다"],
])}
${h2("scope.legend", "표기")}
<div class="legend">{{b:code}} {{b:config}} {{b:doc}} {{b:test}} {{b:ran}} {{b:ci}} {{b:infer}} {{b:suggest}} {{b:unknown}}</div>
${p("각 배지 위에 마우스를 올리면 뜻이 보인다.")}
${h2("scope.ran", "직접 실행해 확인한 것(2026-10-24~25, 이 PC)")}
${table(["명령·작업", "결과"], [
  ["<code>cd backend && ./gradlew test</code>", "2026-10-25 main 4b7b2e8: 17개 클래스 116개 통과, 실패·오류·건너뜀 0(XML 보고서 집계). 새로 생긴 정책 테스트 3개 클래스 25개와 {{x:ContractTest}} 5개를 포함한다. 최초 분석 85개 → #129 반영 86개 → 지금 116개"],
  ["<code>cd frontend && npm run test:unit</code>", "6개 통과, 실패 0"],
  ["<code>npx tsc --noEmit</code>, <code>npx expo lint</code>", "둘 다 종료 코드 0"],
  ["로컬 백엔드(local 프로필, 포트 18080, 임시 H2 파일, SQL·트랜잭션 로그 켬)", "Flyway V1~V11 적용 로그 확인"],
  ["curl로 가입 → 예산 설정 → 거래 등록(Idempotency-Key) → 같은 키 재전송 → 금액 수정 → 오늘 예산", "201 → 200(같은 id) → 200, SQL·commit 순서 로그 캡처, 하루 예산 유지·오늘 남은 돈 감소 확인"],
  ["실패 분기: 다른 사용자 PATCH, 수입 카테고리로 PATCH, amount 0, 토큰 없음·변조, 로그아웃 후", "404(rollback) · 400(rollback-only → rollback) · 400 · 401 · 401 · 401"],
  ["고정지출 이름만 바꿔 다시 저장(수정 전)", "같은 날짜가 한 번 더 기록됨(추정 잔액 550,000 → 100,000). #129 회귀 테스트는 수정 전 실패·수정 후 통과"],
  ["H2 Shell로 SELECT·JOIN·SUM·information_schema", "결과를 {{v:db-lab.sql|실습}}에 그대로 실음. 최종 스키마를 CSV로 뽑아 ERD 데이터와 대조"],
  ["로컬 서버·Gradle 데몬 종료", "완료. 저장소 <code>git status</code> 깨끗"],
])}
${note("warn", "직접 실행하지 않은 것: 로컬 E2E, 운영 서버·DB 접속, 배포 명령, 실기기 앱. E2E는 PR #128·#129·#130의 GitHub Actions에서 통과를 확인했다 {{b:ci}}.")}
${h2("scope.build", "이 가이드 자체의 검증")}
<div id="build-report"></div>
${h2("scope.pending", "변경 반영 상태(2026-10-25)")}
${p("아래 PR은 모두 CI 통과 후 main에 머지했고, 이 가이드의 코드 발췌·설명·테스트 목록에도 반영했다. 백엔드 운영 반영에는 별도 배포가 필요하다. 10-25 오후 PR은 문서·테스트·CI만 바꿨고 서비스 동작은 그대로다(주석 두 줄만 문서 위치를 가리키도록 바뀜).")}
${table(["PR", "변경·검증", "상태·남은 일"], [
  ["#129 고정지출 이름 변경", "사라진 항목의 기록을 같은 날짜의 새 항목이 이어받는다. 기존 키 유지, 마이그레이션 없음. 회귀 테스트 포함 백엔드 86개 통과 {{b:ran}}", "main 머지 완료(807fb30). 사람이 백엔드 배포. 기존 중복 거래는 자동 정리하지 않음"],
  ["#130 문서·주석 정리", "패키지 목록, 디스크 15GB 주석, 가입 선물과 업데이트 기념 선물의 관계, 분석 합계의 고정지출 포함 여부를 명시. 동작 변경 없음", "main 머지 완료(5e31651)"],
  ["#128 학습 가이드", "최신 코드 발췌·회귀 테스트·설명·문서 정리 결과를 반영. 빌드 자체 검증은 아래 보고서 참고", "main 머지 완료(2b683e6). 공유 아티팩트는 10-25 이 판으로 다시 게시"],
  ["#132 작업 방식", "AGENTS.md 재작성(구조·배포 갈래는 <code>docs/ARCHITECTURE.md</code>로), Issue·PR 템플릿, CODEOWNERS, <code>pr-rules</code>, <code>docs/decisions/</code>, <code>docs/CHANGELOG.md</code>", "main 머지 완료. {{v:ops.pr|PR이 머지되기까지}}"],
  ["#134 PRD·정책", "<code>docs/PRD.md</code>, <code>docs/policies.md</code>(예산 계산식을 API.md에서 옮김), <code>tests/policy/*.json</code> + 정책 테스트 3개", "main 머지 완료. 계산 규칙은 그대로"],
  ["#136 API 계약", "OpenAPI <code>docs/contracts/*.yaml</code>, {{x:ContractTest}}, 프론트 <code>gen:api</code>·<code>check:api</code>·<code>mock:api</code>. <code>docs/API.md</code>는 요약이 됨", "main 머지 완료. 응답 형식은 그대로"],
  ["#138 테스트 시계", "고정 시각에 가입해 10-31부터 토큰 만료로 깨질 테스트를, 가입만 실제 시각에 하도록 수정", "main 머지 완료"],
  ["#140·#142 문서", "<code>main</code> 보호 설정 완료(승인·병합은 리드만), HANDOFF 남은 일 합침", "main 머지 완료"],
])}
${h2("scope.mismatch", "분석 중 찾은 어긋남과 처리 결과")}
${table(["위치", "내용", "처리"], [
  ["AGENTS.md 구조 설명", "common·config와 별도 db.migration 위치 누락", "#130에서 목록에 추가"],
  ["deploy.sh·application.yml 주석", "디스크 6.7GB 표기와 HANDOFF의 15GB 기록 차이", "#130에서 과거 용량과 10-20 확인 용량을 구분"],
  ["CoinReason.SIGNUP_GIFT 주석", "문서의 가입 선물과 모달의 업데이트 기념 선물은 같은 지급이다(기존 가입자도 1.4.0 이후 첫 check-in에 받음)", "#130에서 주석으로 관계를 명시"],
  ["API.md 소비 분석", "byCategory·expenseTotal에 고정지출 자동 기록이 포함된다는 설명 누락", "#130에서 추가"],
  ["API.md 고정지출 자동 기록", "이름 변경 시 지난 날짜가 다시 기록되던 문제(수정 전 로컬 재현)", "#129에서 수정하고 기록 이어받기 규칙 명시"],
  ["ApiFlowTest 주석 '저장은 UTC'", "로컬 H2에서는 한국 시각으로 저장되는 것을 확인. 이 차이가 그 테스트의 결과를 바꾸지는 않는다 {{b:ran}} {{b:infer}}", "운영 MySQL 저장값은 미확인"],
  ["FEATURES.md·HANDOFF 머리말", "기준 커밋 83c7981로 적혀 있다 {{b:doc}}", "문서 머리말의 기준 시점이며 이 가이드 빌드 커밋과 구분"],
  ["frontend/AGENTS.md “API 응답 타입은 schema.d.ts에서”", "계약에서 만든 <code>src/service/api/schema.d.ts</code>는 있지만 10-25 기준 어느 화면 코드도 import하지 않는다. 화면은 여전히 손으로 맞춘 {{c:types}}를 쓴다 {{b:code}}", "새 코드에 대한 지침으로 읽힌다 {{b:infer}}. <code>check:api</code>는 생성 파일이 스펙과 같은지만 보고, <code>types.ts</code>와 스펙의 차이는 잡지 못한다"],
])}
${h2("scope.unknown", "확인하지 못한 사항")}
${ul([
  "운영에 배포된 코드 버전과 이 커밋의 차이(HANDOFF: #123 홈 시안·#124 연동 코드 6자리·#129 고정지출 수정은 운영 미배포 기록).",
  "운영 MySQL에 실제로 저장된 시각 값의 시간대(설정으로는 UTC).",
  "운영 RDS 보안 그룹·TLS·백업 실제 설정(문서 기록만).",
  "flexable-web 서버가 internal API를 부르는 실제 코드·키 관리.",
  "MySQL에서의 동시성 테스트 결과(테스트는 H2).",
  "성능·응답 시간·사용자 수.",
  "로컬 E2E 실행 결과(CI에서는 #128·#129·#130 통과 확인).",
  "<code>npm run mock:api</code>(Prism 목 서버)와 <code>npm run check:api</code>의 로컬 실행 결과(이번에 돌리지 않음, check:api는 CI에서 돈다).",
  "고정지출 이름 변경 수정의 실기기 동작과 운영 배포 여부(API 회귀 테스트로만 확인).",
])}
${h2("scope.update", "프로젝트 코드가 바뀌면 이 가이드를 갱신하는 방법")}
${ol([
  "가이드는 생성기(Node 스크립트, 외부 패키지 없음)로 만든다. 코드 발췌는 줄 번호가 아니라 <b>기준 문자열</b>로 실제 파일에서 다시 뽑으므로, 코드가 움직여도 다시 빌드하면 줄 번호·GitHub 고정 링크가 새 커밋 기준으로 바뀐다.",
  "빌드는 다음을 검사하고 하나라도 어긋나면 파일을 만들지 않는다: 발췌 기준 문자열이 파일에 있는지(없거나 두 번 이상이면 실패), 모든 내부 링크 대상, 컨트롤러의 모든 <code>@…Mapping</code>이 API 목록에 있는지, ERD 데이터가 H2에 마이그레이션을 실제로 적용한 스키마와 같은지(열 순서·NULL·기본값·PK·UNIQUE·FK·삭제 규칙·인덱스), 계산 시뮬레이터가 <code>BudgetCalculatorTest</code> 기대값과 같은지.",
  "새 마이그레이션(V12…)을 넣으면: 로컬에서 서버를 한 번 띄워 H2 스키마를 다시 뽑고(<code>information_schema</code> → CSV) 빌드한다. 테이블 데이터(<code>e-tables.mjs</code>)를 고치지 않으면 빌드가 어디가 다른지 알려 준다.",
  "새 API를 만들면 API 목록(<code>e-api.mjs</code>)에 넣으라고 빌드가 알려 준다.",
  "설명 문장은 사람이(또는 Claude에게 맡겨) 다시 읽어야 한다. 빌드는 '코드가 있다'만 검사하고 '설명이 맞다'는 검사하지 못한다.",
  "생성기는 저장소의 <code>docs/learning-guide/</code>에 있다. 실행 방법은 그 폴더의 <code>README.md</code>. 결과 HTML(<code>out/</code>)은 커밋하지 않는다.",
])}`,
  };

  const idx = (id, title, kind, summary) => ({ id, title, group: "찾아보기", summary, html: `<div class="idx" data-idx="${kind}"></div>` });
  const index = [
    idx("idx-feature", "기능 목록", "f", "실제 서비스 기능과 관련 화면·API·코드·테이블·테스트"),
    idx("idx-screen", "화면 목록", "s", "주소, 경로 파일, 화면 컴포넌트"),
    idx("idx-api", "API 목록", "a", "메서드·경로·인증·컨트롤러 줄"),
    idx("idx-code", "코드 목록", "c", "파일·클래스별 역할과 다음 갈 곳, 저장소 전체 파일"),
    idx("idx-table", "테이블 목록", "t", "17개 테이블"),
    idx("idx-test", "테스트 목록", "x", "테스트 클래스·메서드와 실행 결과"),
    idx("idx-glossary", "용어집", "g", "처음 나오는 기술 용어와 우리 코드 위치"),
  ];
  const all = [...viewsA(ctx), ...viewsB(ctx), flowTx, ...viewsC(ctx), ...viewsD(ctx), mentor, ...index, scope];
  return all;
}
