import { h2, h3, p, basic, deep, note, snip, ul, ol, table, quiz, topic, steps, lookNext } from "./h.mjs";
import { layerSvg } from "./diagrams.mjs";

export function viewsB() {
  const front = {
    id: "front", title: "프론트엔드 코드 지도", group: "코드 지도",
    summary: "src/app 라우팅, src/service 화면·상태·API, components와 props, Session·storage·api/client",
    html: `${p("폴더를 외우기보다 '화면 하나를 고치려면 어떤 파일 세 개를 열어야 하나'를 기억하자: <b>경로 파일</b>(<code>src/app</code>) → <b>화면 구현</b>(<code>src/service/*Screen.tsx</code>) → <b>API 호출</b>(<code>src/service/api/client.ts</code>).")}
${topic({
      id: "front.routing", title: "src/app과 라우팅",
      problem: "주소 <code>/transactions/1</code>로 들어오면 어떤 코드가 화면을 그리나?",
      basics: basic("Expo Router 규칙 네 가지", ul([
        "파일 = 화면. <code>src/app/(service)/(tabs)/home.tsx</code> → 주소 <code>/home</code>.",
        "<code>[id].tsx</code> = 주소의 변수 자리. <code>useLocalSearchParams()</code>로 꺼낸다.",
        "<code>(service)</code>, <code>(tabs)</code>처럼 괄호 폴더는 주소에 나타나지 않는 <b>묶음</b>. 묶음마다 <code>_layout.tsx</code>가 공통 틀(검사·탭 바)을 둔다.",
        "경로 파일은 <code>src/app</code>에만 둔다(AGENTS.md). 그래서 경로 파일은 대부분 한두 줄이고, 실제 화면은 <code>src/service</code>에 있다.",
      ]), true),
      role: `<pre class="code-plain">src/app/
├─ _layout.tsx                 앱 전체 틀: 세션·토스트·필수 업데이트       → {{c:RootLayout}}
├─ index.tsx                   /           시작 분기                       → {{c:StartRoute}}
├─ auth/login.tsx, signup.tsx  /auth/*     이메일 로그인·가입             → AuthScreen
├─ oauth/callback.tsx          /oauth/callback 소셜 로그인 돌아오기
├─ onboarding/*.tsx (8개)      /onboarding/* 초기 예산 설정                 → OnboardingScreen
├─ privacy.tsx, terms.tsx, support.tsx, delete-account.tsx  공개 페이지
└─ (service)/                  로그인해야 들어가는 묶음(Guard)              → {{c:ServiceLayout}}
   ├─ (tabs)/_layout.tsx       탭 묶음(Guard budget: 예산 설정 필수)        → {{c:TabsLayout}}
   │  ├─ home.tsx  transactions.tsx  analysis.tsx  my.tsx
   ├─ transactions/new.tsx     /transactions/new  거래 기록                → {{c:TxNewRoute}}
   ├─ transactions/[id].tsx    /transactions/:id  거래 상세·수정            → {{c:TxEditRoute}}
   ├─ categories.tsx  customize.tsx  web-links.tsx  account/delete.tsx</pre>`,
      code: snip("fe-route-home") + snip("fe-route-edit") + snip("fe-service-layout") + snip("fe-guard"),
      io: "주소 → 경로 파일 → (Guard 검사) → service 화면 컴포넌트",
      next: "{{v:front.service|src/service}} · 전체 화면 목록 {{v:idx-screen|화면 목록}}",
      quiz: [["<code>/transactions/new</code>와 <code>/transactions/1</code>은 같은 컴포넌트인가?", "그렇다. 둘 다 {{c:TransactionForm}}이고 <code>id</code>가 있느냐로 등록/수정을 나눈다."], ["로그인하지 않고 <code>/home</code>으로 들어오면?", "<code>(service)/_layout.tsx</code>의 <code>Guard</code>가 <code>/</code>로 보낸다."]],
    })}
${topic({
      id: "front.service", title: "src/service: 화면·상태·API 호출",
      problem: "화면 코드, 서버 호출, 로그인 상태가 한 파일에 섞이면 고치기 어렵다.",
      role: table(["파일 묶음", "하는 일", "예"], [
        ["<code>*Screen.tsx</code>, <code>TransactionForm.tsx</code>", "화면 하나. state로 입력을 들고, <code>useResource</code>로 서버 데이터를 읽고, 버튼에서 <code>api()</code>를 부른다", "{{c:HomeScreen}}, {{c:TransactionForm}}"],
        ["<code>api/client.ts</code>, <code>coinApi.ts</code>", "서버 호출(주소·헤더·오류 변환)", "{{c:apiClient}}, {{c:coinApi}}"],
        ["<code>Session.tsx</code>, <code>BudgetDraft.tsx</code>, <code>wallet.ts</code>", "여러 화면이 함께 쓰는 상태(Context)", "{{c:Session}}, {{c:BudgetDraft}}"],
        ["<code>storage.ts</code>, <code>homeStyle.ts</code>, <code>reminderSetting.ts</code>", "기기 저장", "{{c:storage}}"],
        ["<code>ui.tsx</code>", "서비스 공통(useResource, Guard, Page, 금액 표시)", "{{c:serviceUi}}"],
        ["<code>types.ts</code>", "서버 응답 타입(손으로 맞춤)", "{{c:types}}"],
      ]),
      code: snip("fe-home-top") + snip("fe-useresource"),
      io: "화면 진입 → useResource(GET) → state → 그리기 → 버튼 → api(POST/PATCH) → invalidate → 다시 GET",
      next: "{{v:front.session|Session·storage·api/client}}",
    })}
${topic({
      id: "front.components", title: "src/components와 props",
      problem: "같은 버튼·카드를 화면마다 새로 만들면 모양이 어긋난다.",
      basics: basic("props란", p("부모가 자식 컴포넌트에 넘기는 값이다. <code>&lt;Button label=\"저장하기\" disabled={busy} onPress={save} /&gt;</code>에서 <code>label</code>, <code>disabled</code>, <code>onPress</code>가 props다. 자식은 받은 대로 그리고, 눌리면 받은 함수를 부를 뿐이다.")),
      role: "AGENTS.md의 의존 방향 규칙: <b>공통 UI(<code>src/components</code>)는 값을 props로 받아 표시만 하고, 데이터는 서비스 쪽이 넘긴다</b> {{b:doc}}. 실제로 <code>src/components</code>의 파일들은 <code>api()</code>를 import하지 않는다 {{b:code}}. 예: {{c:TodayHeroView}}는 <code>todayAvailable</code>·<code>daysLeft</code>를 받아 카드만 그린다.",
      code: "{{c:componentsUi}}(Button·Field·Segment·ConfirmModal), {{c:TodayHeroView}}, <code>DayBudgets.tsx</code>, <code>Donut.tsx</code>, <code>CharacterStage.tsx</code>, {{c:SubHeader}}, <code>Toast.tsx</code>. 색·간격은 {{c:theme}}.",
      io: "서비스 화면이 받은 서버 값 → props → 공통 UI가 그림",
      next: "{{c:HomeScreen}}에서 {{c:TodayHeroView}}로 무엇을 넘기는지 보기",
    })}
${topic({
      id: "front.session", title: "Session, storage, api/client",
      problem: "로그인 토큰을 어디에 두고, 모든 요청에 어떻게 붙이고, 만료되면 어떻게 정리하나?",
      basics: basic("Context와 모듈 변수", p("{{c:Session}}은 React Context라서 화면들이 <code>useSession()</code>으로 사용자 정보를 읽는다. 토큰 문자열 자체는 {{c:apiClient}} 모듈의 변수 <code>token</code>에 들어 있어, 화면이 신경 쓰지 않아도 모든 <code>api()</code>가 헤더에 붙인다. 앱을 껐다 켜도 남도록 {{c:storage}}에도 저장한다.")),
      role: table(["언제", "Session", "storage", "api/client"], [
        ["앱 시작", "저장된 토큰을 읽어 <code>GET /me</code>", "<code>readStorage(\"flexable.service.token\")</code>", "<code>setApiSession(saved, expired)</code>"],
        ["로그인 성공", "<code>accept(auth)</code>: user 저장, revision+1", "토큰 쓰기", "<code>setApiSession(token, expired)</code> → generation+1"],
        ["저장 성공", "<code>invalidate()</code>: revision+1 → 화면들이 다시 읽음", "—", "—"],
        ["401 받음", "<code>expired()</code>: clear → <code>/</code> → '다시 로그인해 주세요'", "토큰·임시 예산 설정 지움", "같은 generation일 때만 <code>unauthorized()</code>"],
        ["로그아웃", "<code>clear()</code>", "지움", "<code>setApiSession(null)</code> → generation+1"],
      ]),
      code: snip("fe-session-restore") + snip("fe-session-accept") + snip("fe-session-clear") + snip("fe-client-session") + snip("fe-storage"),
      io: "토큰(서버) → storage + 모듈 변수 → 모든 요청 헤더",
      next: "{{v:flows.login|로그인 흐름 전체}} · {{v:design.late|늦게 온 응답}}",
      quiz: [["토큰은 앱 어디에 저장되나?", "Android는 SecureStore, 웹은 localStorage(<code>storage.ts</code>)."], ["저장 후 홈 숫자가 바뀌는 계기는?", "<code>invalidate()</code>가 <code>revision</code>을 올리고, 홈이 다시 앞에 나올 때 <code>useResource</code>가 다시 GET한다."]],
    })}
${topic({
      id: "front.state", title: "화면 상태와 서버 데이터의 관계",
      problem: "화면에 보이는 숫자와 DB 값이 달라질 수 있나?",
      role: table(["종류", "어디에", "수명", "예"], [
        ["입력 중인 값", "컴포넌트 state(<code>useState</code>)", "화면이 닫히면 사라짐", "거래 폼의 금액"],
        ["화면에 띄운 서버 데이터", "<code>useResource</code>의 state", "다시 읽을 때 교체", "홈의 <code>Today</code>, 내역 목록"],
        ["기기에 남기는 값", "SecureStore/localStorage", "지울 때까지", "토큰, 예산 설정 임시값, 홈 스타일, 알림 설정"],
        ["최종 값", "DB", "영구", "거래, 설정, 코인"],
      ]),
      code: "{{c:serviceUi|useResource}}는 화면이 <b>앞에 나올 때마다</b>(<code>useFocusEffect</code>) 그리고 <code>revision</code>이 바뀔 때 다시 읽는다. 앱은 서버 값을 직접 고치지 않는다(예: 저장 후 오늘 남은 돈을 앱에서 빼지 않는다). 예외는 예산 설정 입력 중 값({{c:BudgetDraft}})으로, 마지막 단계 전까지 서버에 보내지 않는다.",
      io: "DB(최종) → GET → 화면 state(사본) → 사용자 입력(state) → POST/PATCH → DB",
      next: "{{v:change.stale|저장 후 화면 미갱신 조사}}",
    })}`,
  };

  const back = {
    id: "back", title: "백엔드 코드 지도", group: "코드 지도",
    summary: "계층(Controller·Service·Repository·Entity·DTO), DI·어노테이션, 실제 패키지 전체, 공통 설정, JPA",
    html: `${h2("back.layers", "Controller, Service, Repository, Entity, DTO")}
${layerSvg()}
${p("요청 하나는 위 그림 순서로 지나간다. 거래 패키지로 각 역할을 보면:")}
${table(["역할", "하는 일", "하지 않는 일", "거래 패키지 파일"], [
  ["Controller", "주소·메서드를 자바 메서드에 연결, 요청 값 꺼내기, 상태 코드 정하기", "규칙·DB 접근", "{{c:TransactionController}}"],
  ["DTO", "요청·응답 JSON 모양, 입력 검증 규칙", "DB와 직접 연결", "{{c:TransactionDtos}}"],
  ["Service", "규칙(소유자·종류 검사, 재전송 처리), 트랜잭션 경계", "HTTP 세부(헤더·상태 코드)", "{{c:TransactionService}}"],
  ["Repository", "DB 질의(메서드 이름 또는 <code>@Query</code>)", "규칙", "{{c:TransactionRepository}}"],
  ["Entity", "테이블 한 행의 자바 모습, 값 바꾸는 메서드", "요청 처리", "{{c:Transaction}}"],
])}
${note("info", "예외: {{c:AnalysisController}}는 서비스 없이 컨트롤러가 리포지토리를 직접 부르고 집계한다 {{b:code}}. 계산 전용 클래스 {{c:BudgetCalculator}}·{{c:CharacterScore}}는 DB를 모르는 순수 함수다.")}
${topic({
      id: "back.di", title: "의존성 주입과 주요 어노테이션 읽는 법",
      problem: "<code>TransactionService</code>는 <code>new TransactionService(...)</code>를 하는 곳이 없는데 어떻게 만들어지나?",
      basics: basic("빈과 생성자 주입", p("스프링은 시작할 때 <code>@SpringBootApplication</code>이 있는 패키지 아래에서 <code>@RestController</code>, <code>@Service</code>, <code>@Component</code>, <code>@Configuration</code> 같은 표시가 붙은 클래스를 찾아 객체(빈)를 하나씩 만든다. 생성자에 다른 빈이 필요하다고 적혀 있으면 먼저 그것을 만들어 넣어 준다. 그래서 이 프로젝트의 클래스들은 필드를 <code>final</code>로 두고 생성자로 받는다.") + snip("be-tx-service-ctor"), true),
      role: table(["어노테이션", "뜻", "이 프로젝트 예"], [
        ["<code>@SpringBootApplication</code>", "여기서부터 빈을 찾고 자동 설정을 켠다", "{{c:ApiApplication}}"],
        ["<code>@RestController</code> + <code>@RequestMapping</code>", "HTTP 입구, 반환값을 JSON으로", "{{c:TransactionController}}"],
        ["<code>@GetMapping</code>·<code>@PostMapping</code>·<code>@PatchMapping</code>…", "메서드·주소 연결", "<code>@PatchMapping(\"/{id}\")</code>"],
        ["<code>@RequestBody</code>·<code>@PathVariable</code>·<code>@RequestParam</code>·<code>@RequestHeader</code>", "본문·주소 변수·쿼리·헤더에서 값 꺼내기", "<code>create(..., @RequestHeader Idempotency-Key, @Valid @RequestBody …)</code>"],
        ["<code>@AuthenticationPrincipal Jwt</code>", "보안 필터가 검증한 토큰 받기", "모든 사용자 API"],
        ["<code>@Valid</code> + <code>@NotNull</code>·<code>@Min</code>·<code>@Size</code>", "입력 검증", "{{c:TransactionDtos}}"],
        ["<code>@Service</code>·<code>@Component</code>", "빈으로 등록", "{{c:TransactionService}}, {{c:TokenService}}"],
        ["<code>@Transactional</code>", "메서드를 트랜잭션으로 감싸기(<code>readOnly</code>, <code>propagation</code>)", "{{c:TransactionService}} <code>update</code>, {{c:FixedExpensePoster}}"],
        ["<code>@Entity</code>·<code>@Table</code>·<code>@Column</code>·<code>@Id</code>·<code>@GeneratedValue</code>·<code>@Enumerated</code>", "클래스 ↔ 테이블, 필드 ↔ 열", "{{c:Transaction}}"],
        ["<code>@Query</code>·<code>@Modifying</code>·<code>@Lock</code>", "직접 쓴 질의, 바꾸는 질의, 잠금 조회", "{{c:SettingsRepository}}, {{c:DailyBudgetRepository}}"],
        ["<code>@Configuration</code> + <code>@Bean</code>", "직접 만든 객체를 빈으로", "{{c:SecurityConfig}}, {{c:TimeConfig}}"],
        ["<code>@ConfigurationProperties</code>", "<code>application.yml</code> 값을 record로", "{{c:AppProperties}}"],
        ["<code>@RestControllerAdvice</code> + <code>@ExceptionHandler</code>", "모든 컨트롤러의 예외를 한곳에서 JSON으로", "{{c:GlobalExceptionHandler}}"],
      ]),
      code: snip("be-app-main") + snip("be-timeconfig"),
      io: "어노테이션(표시) → 스프링이 읽음 → 빈 생성·연결 → 요청 때 호출",
      next: "{{v:back.packages|패키지 전체}}",
    })}
${h2("back.packages", "실제 패키지 전체와 기능별 진입점")}
${p("<code>backend/src/main/java</code> 아래를 직접 조사한 결과다. 기능 패키지 auth … weblink 10개와 공통 <b><code>common</code>·<code>config</code></b>가 있다. 패키지 밖에 Flyway Java 마이그레이션 <code>db.migration</code>이 하나 있다. AGENTS.md 목록도 #130에서 이에 맞췄다 {{b:code}}.")}
${table(["패키지", "진입점(컨트롤러)", "주 서비스", "주로 쓰는 테이블"], [
  ["<code>auth</code>", "{{c:AuthController}}, {{c:OAuthController}}", "{{c:AuthService}}, {{c:OAuthService}}, {{c:TokenService}}", "{{t:users}}, {{t:user_identities}}"],
  ["<code>user</code>", "(AuthController의 /me)", "{{c:AccountDeletionService}}", "{{t:users}}"],
  ["<code>budget</code>", "{{c:BudgetController}}", "{{c:BudgetService}}, {{c:SeedMoneyService}}, {{c:FixedExpensePoster}}, {{c:BudgetCalculator}}", "{{t:budget_settings}} 외 5개"],
  ["<code>transaction</code>", "{{c:TransactionController}}", "{{c:TransactionService}}", "{{t:transactions}}"],
  ["<code>category</code>", "{{c:CategoryController}}", "{{c:CategoryService}}", "{{t:categories}}"],
  ["<code>analysis</code>", "{{c:AnalysisController}}", "(컨트롤러가 직접)", "{{t:transactions}}, {{t:categories}}"],
  ["<code>coin</code>", "{{c:CoinController}}", "{{c:CoinService}}", "{{t:coin_wallets}}, {{t:coin_ledger}}"],
  ["<code>outfit</code>", "{{c:OutfitController}}", "{{c:OutfitService}}", "{{t:outfits}}, {{t:user_outfits}}"],
  ["<code>referral</code>", "{{c:ReferralController}}", "{{c:ReferralService}}", "{{t:referrals}}"],
  ["<code>weblink</code>", "{{c:WebLinkController}}, {{c:InternalWebLinkController}}", "{{c:WebLinkService}}", "{{t:web_link_codes}}, {{t:web_links}}"],
  ["<code>common</code>", "{{c:HealthController}}", "—", "오류 형식 {{c:ErrorCode}}·{{c:GlobalExceptionHandler}}, 날짜 {{c:DateRange}}·{{c:Times}}"],
  ["<code>config</code>", "—", "—", "{{c:SecurityConfig}}, {{c:ServiceKeyFilter}}, {{c:AppProperties}}, {{c:TimeConfig}}, OAuth·Outfit·WebLink 설정값"],
  ["<code>db.migration</code>", "—", "—", "{{c:V3Migration}}"],
])}
${p("서비스끼리 부르는 관계 {{b:code}}: 거래 → 카테고리(<code>requireForType</code>), 예산·시드머니 → 고정지출 자동 기록, 코인 → 예산(<code>keptBudget</code>), 코스튬 → 코인·예산(최고 단계), 추천 → 코인, 웹 연동 → 시드머니, 인증 → 카테고리(기본 생성)·탈퇴.")}
${topic({
      id: "back.common", title: "공통 설정·인증·예외 처리",
      problem: "모든 API에 공통인 일(토큰 검사, 오류 모양, 시간대)을 기능마다 쓰지 않으려면?",
      role: ul([
        "<b>보안</b>: {{c:SecurityConfig}}에 필터 체인이 두 개 있다. ① <code>@Order(1)</code> <code>/internal/**</code> → {{c:ServiceKeyFilter}}(서비스 키) ② 나머지 → JWT. 공개 경로는 가입·로그인·소셜 start/callback/exchange·health뿐이다. 세션(쿠키)을 쓰지 않으므로 STATELESS, CSRF 끔.",
        "<b>CORS</b>: <code>/api/**</code>에만 허용 출처(<code>CORS_ORIGINS</code>)를 등록. 허용 헤더는 <code>Authorization</code>, <code>Content-Type</code>, <code>Idempotency-Key</code>.",
        "<b>오류</b>: 서비스는 <code>throw new ApiException(ErrorCode.NOT_FOUND)</code>만 하고, {{c:GlobalExceptionHandler}}가 상태 코드와 JSON을 만든다.",
        "<b>시간</b>: {{c:TimeConfig}}의 <code>Clock</code>을 주입받아 쓰고, 날짜 계산은 <code>app.zone=Asia/Seoul</code>. 테스트는 시계를 바꿔 '내일'을 만든다({{x:CoinFlowTest}}).",
        "<b>설정값</b>: {{c:AppProperties}} 등 <code>@ConfigurationProperties</code> record들.",
      ]),
      code: snip("be-security-chain") + snip("be-security-internal") + snip("be-security-cors") + snip("be-error-code"),
      io: "요청 → 필터 체인 선택(경로) → 인증 → 컨트롤러 → (예외면) 공통 처리기 → JSON",
      next: "{{v:design.auth|JWT 인증 설계}} · {{v:design.errors|오류 응답과 화면}}",
    })}
${topic({
      id: "back.jpa", title: "JPA가 하는 일: 자바 객체 변경이 DB 행 변경이 되기까지",
      problem: "'JPA가 저장한다'는 말이 정확히 무슨 일인가?",
      basics: basic("한 줄씩 쪼개 보기", ol([
        "<b>트랜잭션 시작</b>: <code>@Transactional</code> 메서드에 들어가면 스프링이 커넥션 풀(Hikari)에서 DB 연결을 하나 빌리고 트랜잭션을 연다. 같은 트랜잭션 동안 쓸 <b>영속성 컨텍스트</b>(EntityManager)도 만든다.",
        "<b>조회</b>: <code>transactions.findByIdAndUserId(1, 1)</code> → Hibernate가 SQL <code>select … where id=? and user_id=?</code>를 만들어 JDBC로 보내고, 받은 행으로 <code>Transaction</code> 객체를 만든다. 이 객체와 <b>그때의 값 사본(스냅숏)</b>을 영속성 컨텍스트에 넣는다.",
        "<b>변경</b>: <code>t.update(…)</code>가 필드 <code>amount</code>를 10000으로 바꾼다. 이건 그냥 자바 객체 필드 변경이다. SQL은 아직 없다.",
        "<b>flush</b>: 메서드가 끝나 commit하기 직전, Hibernate가 관리 중인 객체마다 지금 값과 스냅숏을 비교한다(변경 감지). 다르면 <code>update transactions set … where id=?</code>를 JDBC로 보낸다.",
        "<b>commit</b>: DB에 commit을 보내 확정한다. 연결을 풀에 돌려주고 영속성 컨텍스트를 닫는다.",
      ]) + p("새 행은 조금 다르다. <code>save(new Transaction(…))</code> → persist. id를 DB가 정하는 방식(IDENTITY)이라 Hibernate는 번호를 알기 위해 INSERT를 <b>바로</b> 보낸다(commit 전).") + p("로컬 실행 로그로 확인 {{b:ran}}: 수정은 <code>Committing JPA transaction</code> 다음에 UPDATE, 등록은 commit 전에 INSERT."), true),
      role: ul([
        "<b>연관관계 없이 ID만</b>: 이 프로젝트 엔티티는 <code>@ManyToOne</code> 같은 객체 연관관계를 하나도 쓰지 않고 <code>userId</code>, <code>categoryId</code> 같은 숫자만 갖는다 {{b:code}}. 그래서 '거래의 카테고리 이름'이 필요하면 서비스가 카테고리를 따로 읽는다(<code>toResponse</code>, <code>categoryMap</code>). 장점: 조회가 눈에 보이고 의도치 않은 지연 로딩·N+1이 없다. 단점: 소유자 조건·조인을 사람이 매번 챙겨야 한다 {{b:infer}}.",
        "<code>spring.jpa.open-in-view: false</code>: 트랜잭션이 끝나면 영속성 컨텍스트도 닫힌다. 컨트롤러·JSON 변환 중에 몰래 DB를 읽지 않는다 {{b:config}}.",
        "<code>hibernate.ddl-auto: validate</code>: Hibernate가 테이블을 만들거나 고치지 않고, 엔티티와 DB가 맞는지만 확인한다. 테이블은 Flyway가 만든다 {{b:config}}.",
        "리포지토리 메서드는 각자 트랜잭션을 갖는다(Spring Data 기본). 서비스의 <code>@Transactional</code> 안에서 부르면 그 트랜잭션에 '참여'한다(로그의 <code>Participating in existing transaction</code>).",
      ]),
      code: snip("be-tx-service-update") + snip("be-tx-entity-update") + snip("cfg-app-yml"),
      io: "자바 필드 변경 → (영속성 컨텍스트) → flush: SQL → JDBC → DB 행 → commit",
      next: "{{v:flow-tx.s14|수정 14~15단계}} · {{v:db.mapping|객체와 행의 연결}}",
      quiz: [["트랜잭션 밖에서 읽은 엔티티의 필드를 바꾸면 DB가 바뀌나?", "아니다. 관리하는 영속성 컨텍스트가 없어 변경 감지가 일어나지 않는다."], ["등록의 INSERT가 commit 전에 나가는 이유는?", "<code>@GeneratedValue(IDENTITY)</code>라 DB가 id를 정하므로, id를 알려면 INSERT를 먼저 실행해야 한다."]],
    })}`,
  };
  return [front, back];
}
