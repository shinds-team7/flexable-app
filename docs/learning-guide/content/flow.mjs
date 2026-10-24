// 대표 요청 추적: "점심 9,000원을 기록하고 10,000원으로 고친다". 등록(POST) 1~11단계, 수정(PATCH) 12~16단계.
// 요청·응답 JSON은 API 계약(docs/API.md, DTO)에 맞춘 가상 예시이고, 로그는 2026-10-24 로컬 H2 실행에서 캡처한 것이다(날짜가 다르다).

const LOG_POST = `[보안 필터: 토큰의 사용자 확인 — 별도 읽기 전용 트랜잭션]
Creating new transaction with name [...SimpleJpaRepository.findById]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT,readOnly
Hibernate: select u1_0.id,u1_0.agreed_at,u1_0.created_at,u1_0.email,u1_0.onboarded,u1_0.password_hash,u1_0.token_version from users u1_0 where u1_0.id=?
Committing JPA transaction

[TransactionService.create — TransactionTemplate가 연 트랜잭션]
Creating new transaction with name [null]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT
Hibernate: select t1_0.id, ... from transactions t1_0 where t1_0.user_id=? and t1_0.idempotency_key=?
Participating in existing transaction
Hibernate: select c1_0.id, ... from categories c1_0 where c1_0.id=? and c1_0.user_id=?
Participating in existing transaction
Hibernate: insert into transactions (amount,category_id,created_at,from_fixed,idempotency_key,memo,occurred_at,title,type,updated_at,user_id,id) values (?,?,?,?,?,?,?,?,?,?,?,default)
Initiating transaction commit
Committing JPA transaction`;

const LOG_RETRY = `[같은 Idempotency-Key로 한 번 더 POST]
Creating new transaction with name [null]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT
Hibernate: select t1_0.id, ... from transactions t1_0 where t1_0.user_id=? and t1_0.idempotency_key=?   ← 이번엔 찾음
Hibernate: select c1_0.id, ... from categories c1_0 where c1_0.id=?                                      ← 응답에 넣을 카테고리
Committing JPA transaction                                                                               ← INSERT 없음 → HTTP 200`;

const LOG_PATCH = `[보안 필터] select ... from users u1_0 where u1_0.id=?   (생략)

Creating new transaction with name [com.flexable.api.transaction.TransactionService.update]: PROPAGATION_REQUIRED,ISOLATION_DEFAULT
Hibernate: select t1_0.id, ... from transactions t1_0 where t1_0.id=? and t1_0.user_id=?
Participating in existing transaction
Hibernate: select c1_0.id, ... from categories c1_0 where c1_0.id=? and c1_0.user_id=?
Participating in existing transaction
Committing JPA transaction on EntityManager [SessionImpl(...)]
Hibernate: update transactions set amount=?,category_id=?,created_at=?,from_fixed=?,idempotency_key=?,memo=?,occurred_at=?,title=?,type=?,updated_at=?,user_id=? where id=?`;

const LOG_ROLLBACK = `[다른 사용자의 토큰으로 PATCH /transactions/1 → 404]
Creating new transaction with name [com.flexable.api.transaction.TransactionService.update]
Hibernate: select ... from transactions t1_0 where t1_0.id=? and t1_0.user_id=?    ← 0행
Rolling back JPA transaction

[지출 거래에 수입 카테고리(급여)로 PATCH → 400]
Creating new transaction with name [com.flexable.api.transaction.TransactionService.update]
Hibernate: select ... from transactions ... where t1_0.id=? and t1_0.user_id=?
Participating in existing transaction
Hibernate: select ... from categories ... where c1_0.id=? and c1_0.user_id=?
Participating transaction failed - marking existing transaction as rollback-only
Rolling back JPA transaction`;

export function build() {
  const steps = [
    {
      n: 1, track: "create", title: "화면 진입과 입력 상태",
      where: "{{s:txnew}} → {{c:TxNewRoute}} → {{c:TransactionForm}}의 <code>Form</code>",
      snips: ["fe-route-new", "fe-form-wrapper", "fe-form-state"],
      body: `<p>홈의 + 버튼은 <code>router.push("/transactions/new")</code>를 부른다. Expo Router는 주소를 보고 <code>src/app/(service)/transactions/new.tsx</code>를 찾아 그 파일이 내보낸 컴포넌트를 그린다. 그 파일은 <code>&lt;TransactionForm /&gt;</code> 한 줄이다. <code>id</code>가 없으니 서버에서 읽을 거래가 없고(<code>useResource(null)</code>), 빈 폼이 뜬다.</p>
<p>폼 안의 값은 모두 <b>React state</b>다. 사용자가 금액칸에 9000을 치면 <code>setAmount("9000")</code>가 불리고 화면이 다시 그려진다. 이 값은 앱 메모리에만 있고 서버·DB와 아무 관계가 없다. 동시에 <code>useResource("/categories?type=EXPENSE")</code>가 카테고리 목록을 읽어 와 버튼으로 보여 준다.</p>`,
      input: "사용자 입력: 금액 9000, 카테고리 '식비'(id 1), 내용 '점심', 시각 12:30",
      output: "state: <code>type=\"EXPENSE\"</code>, <code>amount=\"9000\"</code>(문자열), <code>categoryId=1</code>, <code>title=\"점심\"</code>, <code>occurredAt=\"2026-10-13T12:30:00+09:00\"</code>",
      memory: "앱 메모리(state)만 바뀜", db: "변화 없음",
      next: "저장 버튼을 누르면 <code>onPress={save}</code>가 실행된다.",
    },
    {
      n: 2, track: "create", title: "저장 버튼 → save() 이벤트 함수",
      where: "{{c:TransactionForm}} <code>save()</code>",
      snips: ["fe-form-save"],
      body: `<p><code>save()</code>는 다섯 가지를 차례로 한다.</p>
<ol><li><b>연타 막기</b>: <code>lock.current</code>가 true면 바로 끝낸다. state가 아니라 ref라서 값을 바꿔도 화면을 다시 그리지 않고, 두 번째 클릭이 즉시 막힌다.</li>
<li><b>앱에서 먼저 검사</b>: 금액이 1 이상 1조 미만 정수인지, 카테고리·시각이 있는지. 서버도 같은 검사를 하지만(4·6단계) 요청을 보내기 전에 알려 주려는 것이다.</li>
<li><b>재시도 키 만들기</b>: <code>if (!key.current) key.current = randomUUID()</code>. <b>처음 한 번만</b> 만든다. 응답을 못 받아 다시 누르면 같은 키가 간다.</li>
<li><b>본문 만들기</b>: <code>amount: Number(amount)</code>로 문자열을 숫자로 바꾼다. 내용이 비면 카테고리 이름을 쓴다. 만든 본문은 <code>pending.current</code>에 보관해 재시도 때 그대로 보낸다.</li>
<li><b>보내기</b>: <code>existing</code>이 없으니 <code>POST /transactions</code>, 키를 함께 넘긴다.</li></ol>`,
      input: "state 값들", output: "<code>api(\"/transactions\", { method: \"POST\", body, key })</code> 호출",
      memory: "<code>lock=true</code>, <code>busy=true</code>(버튼이 '처리 중…'), <code>key</code>·<code>pending</code> 저장", db: "변화 없음",
      next: "모든 요청은 {{c:apiClient}}의 <code>api()</code> 하나를 지난다.",
    },
    {
      n: 3, track: "create", title: "API 클라이언트 api()",
      where: "{{c:apiClient}} <code>api()</code>, <code>apiUrl()</code>",
      snips: ["fe-client-url", "fe-client-api"],
      body: `<p><code>api()</code>는 화면이 몰라도 되는 일을 대신한다.</p>
<ul><li>주소: 환경변수 <code>EXPO_PUBLIC_API_URL</code> + <code>/api/v1</code> + <code>/transactions</code>. 로컬은 <code>http://localhost:8080</code>, 운영 앱은 EAS 환경변수, 운영 웹은 <code>.env.production</code>에서 온다(값은 빌드할 때 번들에 들어간다).</li>
<li>헤더: <code>Content-Type: application/json</code>, 저장된 토큰이 있으면 <code>Authorization: Bearer …</code>, 키가 있으면 <code>Idempotency-Key</code>.</li>
<li>본문: <code>JSON.stringify(body)</code>로 글자로 바꾼다.</li>
<li>15초가 지나면 <code>AbortController</code>로 끊는다.</li>
<li>보내기 직전 <code>started = generation</code>을 기억한다(16단계·설계 편의 '늦게 온 응답').</li></ul>`,
      input: "path, method, body(자바스크립트 객체), key", output: "<code>fetch(url, { method, headers, body })</code>",
      memory: "변화 없음(요청 대기)", db: "변화 없음",
      next: "이제 네트워크로 HTTP 요청이 나간다.",
    },
    {
      n: 4, track: "create", title: "HTTP 요청이 실제로 나가는 모양",
      where: "앱 → (운영: HTTPS → EC2의 Caddy) → API 컨테이너 8080",
      snips: [],
      body: `<p>네트워크로 가는 것은 아래 글자 덩어리다. 메서드·주소·헤더·본문이 전부다.</p>
<pre class="code-plain" data-copy>POST /api/v1/transactions HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6Ii4uLiJ9.eyJzdWIiOiIxIiwidHYiOjAsImV4cCI6Li4ufQ.(서명)
Idempotency-Key: 6f1c2b7e-3d4a-4e8f-9b2a-1c5d7e9f0a12

{"type":"EXPENSE","amount":9000,"categoryId":1,"title":"점심","memo":"","occurredAt":"2026-10-13T12:30:00+09:00"}</pre>
<p><b>userId가 본문에 없다</b>는 점을 보자. 서버는 '누구의 거래인지'를 본문이 아니라 토큰에서 꺼낸다(5·6단계). 토큰 가운데 부분을 풀면 <code>{"sub":"1","tv":0,"exp":…,"iat":…}</code>이다(로컬 실행에서 받은 토큰을 직접 풀어 확인 {{b:ran}}).</p>
<p>운영에서는 이 요청이 HTTPS로 EC2의 Caddy(443)에 먼저 닿고, Caddy가 같은 Docker 네트워크의 <code>api:8080</code>으로 넘긴다 {{b:config}}. 로컬에서는 앱이 <code>localhost:8080</code>으로 바로 보낸다.</p>`,
      input: "JS 객체", output: "HTTP 요청(글자)",
      memory: "—", db: "변화 없음",
      next: "서버 쪽 첫 관문은 컨트롤러가 아니라 보안 필터다.",
    },
    {
      n: 5, track: "create", title: "서버 진입: 보안 필터가 토큰을 검사",
      where: "{{c:SecurityConfig}} <code>filterChain</code>·<code>converter</code>, {{c:TokenService}}",
      snips: ["be-security-chain", "be-security-converter"],
      body: `<p>Tomcat이 요청을 받으면 Spring Security 필터들이 먼저 돈다. 경로 <code>/api/v1/transactions</code>는 공개 목록에 없으므로 <code>anyRequest().authenticated()</code>에 걸린다.</p>
<ol><li><code>Authorization</code> 헤더에서 <code>Bearer</code> 뒤 문자열을 꺼낸다.</li>
<li><code>tokens.decoder()</code>(HS256 비밀키)로 <b>서명</b>과 <b>만료 시각</b>을 확인한다. 서명이 안 맞거나 만료면 여기서 끝: 401 <code>{"code":"UNAUTHORIZED",…}</code>.</li>
<li><code>converter()</code>가 <code>sub</code>를 숫자로 바꾸고 <b>DB에서 사용자를 읽어</b> <code>token_version</code>이 토큰의 <code>tv</code>와 같은지 본다. 로그아웃했거나 탈퇴했으면 다르거나 없으므로 401.</li></ol>
<p>로컬 실행 로그를 보면 실제로 <b>모든 인증 요청마다</b> <code>select … from users where id=?</code>가 컨트롤러보다 먼저 나간다 {{b:ran}}. 로그아웃이 즉시 반영되는 대신 요청마다 조회가 한 번 늘어나는 선택이다.</p>`,
      input: "HTTP 헤더의 토큰", output: "검증된 <code>Jwt</code> 객체(요청 동안 보관)",
      memory: "SecurityContext에 인증 정보", db: "<code>users</code> 읽기만(읽기 전용 트랜잭션)",
      next: "통과하면 DispatcherServlet이 주소에 맞는 컨트롤러 메서드를 찾는다.",
      evidence: LOG_POST,
    },
    {
      n: 6, track: "create", title: "Controller: 요청을 자바 값으로 받기",
      where: "{{c:TransactionController}} <code>create()</code>, {{c:TransactionDtos}} <code>CreateRequest</code>, {{c:CurrentUser}}",
      snips: ["be-tx-controller-create", "be-tx-dto-create", "be-currentuser"],
      body: `<p><code>@PostMapping</code> + 클래스의 <code>@RequestMapping("/api/v1/transactions")</code>가 이 메서드를 고른다. 매개변수마다 어디서 값을 꺼낼지가 어노테이션으로 적혀 있다.</p>
<ul><li><code>@AuthenticationPrincipal Jwt jwt</code>: 5단계에서 검증한 토큰. <code>CurrentUser.id(jwt)</code> → <b>userId = 1</b>.</li>
<li><code>@RequestHeader("Idempotency-Key")</code>: 헤더 값(없어도 됨).</li>
<li><code>@Valid @RequestBody CreateRequest req</code>: Jackson이 JSON을 record로 바꾸고, <code>@Valid</code>가 <code>@NotNull</code>·<code>@Min(1)</code>·<code>@Size(max=40)</code>를 검사한다. 어기면 메서드에 들어오지도 않고 {{c:GlobalExceptionHandler}}가 400 <code>VALIDATION_FAILED</code>와 <code>fields</code>를 만든다(로컬에서 <code>amount: 0</code>으로 확인 {{b:ran}}).</li></ul>
<p>컨트롤러는 서비스를 부르고, 결과의 <code>replayed</code>에 따라 201(새로 만듦) 또는 200(같은 키 재전송)을 고른다. 계산이나 DB 접근은 하지 않는다.</p>`,
      input: "JSON 글자 + 헤더 + 토큰", output: "<code>service.create(1, req, \"6f1c…\")</code>",
      memory: "<code>CreateRequest(type=EXPENSE, amount=9000, categoryId=1, title=\"점심\", memo=\"\", occurredAt=2026-10-13T12:30+09:00)</code>", db: "변화 없음",
      next: "규칙은 서비스에 있다.",
    },
    {
      n: 7, track: "create", title: "Service: 키 확인 → 카테고리 검사 → 엔티티 만들기",
      where: "{{c:TransactionService}} <code>create()</code>·<code>createOnce()</code>, {{c:CategoryService}} <code>requireForType()</code>",
      snips: ["be-tx-service-create", "be-category-require"],
      body: `<p><code>create()</code>는 <code>TransactionTemplate</code>으로 트랜잭션을 직접 열고 그 안에서 <code>createOnce()</code>를 실행한다.</p>
<ol><li><b>같은 키로 이미 만든 거래가 있나?</b> <code>findByUserIdAndIdempotencyKey(1, "6f1c…")</code>. 있으면 그것을 <code>replayed=true</code>로 돌려주고 끝(재전송).</li>
<li><b>카테고리 검사</b>: <code>requireForType(1, 1, EXPENSE)</code>가 <code>WHERE id=1 AND user_id=1</code>로 찾는다. 남의 카테고리이거나 수입 카테고리면 400 <code>categoryId</code>.</li>
<li><b>값 다듬기</b>: 제목 앞뒤 공백 제거(빈 문자열이면 400), 빈 메모는 null, 시각이 없으면 지금.</li>
<li><b>엔티티 만들기</b>: <code>new Transaction(1, 1, EXPENSE, 9000, "점심", null, occurredAt, key, now)</code>. 아직 메모리 속 자바 객체일 뿐이다.</li></ol>`,
      input: "userId=1, CreateRequest, key", output: "저장할 <code>Transaction</code> 객체",
      memory: "트랜잭션 열림, 영속성 컨텍스트 생성", db: "SELECT 두 번(키, 카테고리)",
      next: "리포지토리의 <code>save()</code>로 DB에 넣는다.",
    },
    {
      n: 8, track: "create", title: "Repository·Entity: 객체를 행으로",
      where: "{{c:TransactionRepository}} <code>save()</code>, {{c:Transaction}}",
      snips: ["be-tx-entity", "be-tx-repo"],
      body: `<p><code>TransactionRepository</code>는 구현이 없는 인터페이스다. <code>JpaRepository</code>를 상속했으니 <code>save()</code>는 Spring Data가 제공한다. <code>save()</code>는 새 엔티티(id가 null)를 JPA <code>persist</code>로 넘긴다.</p>
<p>엔티티의 어노테이션이 열 이름을 정한다: <code>userId</code> → <code>user_id</code>, <code>occurredAt</code>(Instant) → <code>occurred_at</code>(DATETIME), <code>type</code>(enum) → 문자열 <code>'EXPENSE'</code>(<code>@Enumerated(STRING)</code>). <code>@GeneratedValue(IDENTITY)</code>라서 DB가 번호를 붙이므로, Hibernate는 번호를 알기 위해 <b>commit을 기다리지 않고 INSERT를 바로 보낸다</b>.</p>
<p>엔티티는 카테고리를 객체로 들고 있지 않고 <code>categoryId</code> 숫자만 갖는다. 이 프로젝트 엔티티 전체가 그렇다(<code>@ManyToOne</code> 같은 연관관계 어노테이션이 하나도 없음 {{b:code}}). 응답에 카테고리 이름이 필요하면 서비스가 따로 읽어 붙인다.</p>`,
      input: "<code>Transaction</code>(id=null)", output: "<code>Transaction</code>(id=1) — 영속성 컨텍스트가 관리",
      memory: "엔티티가 '관리 중' 상태", db: "INSERT 한 줄(아직 commit 전이라 다른 연결에는 안 보임)",
      next: "Hibernate가 JDBC로 SQL을 보낸다.",
    },
    {
      n: 9, track: "create", title: "JPA → JDBC → SQL → DB 행",
      where: "Hibernate → HikariCP 연결 → MySQL(운영) / H2(로컬·테스트) → {{t:transactions}}",
      snips: ["mig-v1-tx"],
      body: `<p>Hibernate가 만든 SQL은 실제로 이렇다(로컬 실행 로그 {{b:ran}}): <code>insert into transactions (amount,category_id,created_at,from_fixed,idempotency_key,memo,occurred_at,title,type,updated_at,user_id,id) values (?,?,?,?,?,?,?,?,?,?,?,default)</code>. <code>?</code> 자리에 값이 따로 들어가므로(PreparedStatement) 사용자 입력이 SQL 문장을 바꿀 수 없다.</p>
<p>DB는 행을 넣기 전에 제약을 검사한다: <code>user_id</code>가 {{t:users}}에 있나(FK), <code>category_id</code>가 {{t:categories}}에 있나(FK), <code>(user_id, idempotency_key)</code>가 겹치지 않나(UNIQUE). 하나라도 어기면 INSERT가 실패하고 자바에는 <code>DataIntegrityViolationException</code>이 올라온다.</p>
<table class="mini"><tr><th>id</th><th>user_id</th><th>category_id</th><th>type</th><th>amount</th><th>title</th><th>memo</th><th>occurred_at</th><th>idempotency_key</th><th>from_fixed</th></tr>
<tr><td>1</td><td>1</td><td>1</td><td>EXPENSE</td><td>9000</td><td>점심</td><td>NULL</td><td>2026-10-13 03:30:00.000000</td><td>6f1c2b7e-…</td><td>FALSE</td></tr></table>
<p class="note"><code>occurred_at</code>은 운영 설정(JVM·JDBC·Hibernate 모두 UTC)으로 보아 UTC로 저장된다고 추론한다 {{b:infer}}(12:30 KST = 03:30 UTC). 로컬 H2(이 PC의 JVM 시간대가 Asia/Seoul)에서는 한국 시각 그대로 보였다 {{b:ran}}. 운영 DB는 확인하지 않았다 {{b:unknown}}.</p>`,
      input: "SQL + 값", output: "새 행(id=1)",
      memory: "—", db: "<b>transactions에 행 추가</b>(commit 전)",
      next: "메서드가 정상으로 끝나면 트랜잭션이 commit된다.",
    },
    {
      n: 10, track: "create", title: "트랜잭션 종료(commit)와 응답",
      where: "{{c:TransactionService}} → {{c:TransactionController}} → Jackson",
      snips: ["be-tx-dto-response"],
      body: `<p><code>tx.execute(...)</code> 안의 함수가 예외 없이 끝나면 TransactionTemplate이 <b>commit</b>한다. 이때부터 다른 요청도 이 행을 본다. 예외가 나면 rollback해서 INSERT도 없던 일이 된다.</p>
<p>서비스는 엔티티를 그대로 내보내지 않고 <code>TransactionResponse.of(saved, CategoryRef.of(category), zone)</code>로 응답 DTO를 만든다. <code>Instant</code>는 <code>Asia/Seoul</code>로 바꿔 <code>+09:00</code>을 붙인다. 컨트롤러가 <code>ResponseEntity.status(201)</code>로 감싸고 Jackson이 JSON 글자로 만든다.</p>
<pre class="code-plain" data-copy>HTTP/1.1 201 Created
Content-Type: application/json

{"id":1,"type":"EXPENSE","amount":9000,"categoryId":1,
 "category":{"id":1,"name":"식비","color":"#12B76A","icon":"restaurant"},
 "title":"점심","memo":null,"occurredAt":"2026-10-13T12:30:00+09:00",
 "createdAt":"2026-10-13T12:30:05+09:00","fromFixed":false}</pre>
<p class="note">빈 메모 <code>""</code>는 서버에서 <code>null</code>이 된다(<code>cleanMemo</code>). 로컬 실행 응답에서도 <code>"memo":null</code>이었다 {{b:ran}}.</p>`,
      input: "저장된 엔티티", output: "HTTP 201 + JSON",
      memory: "영속성 컨텍스트 닫힘", db: "<b>commit — 행이 확정됨</b>",
      next: "응답이 앱의 <code>await api(...)</code>로 돌아온다.",
    },
    {
      n: 11, track: "create", title: "앱: 성공 처리 → 화면 이동 → 홈이 다시 읽기",
      where: "{{c:TransactionForm}} <code>done()</code> → {{c:Session}} <code>invalidate()</code> → {{c:serviceUi|useResource}} → {{c:HomeScreen}}",
      snips: ["fe-form-done", "fe-useresource"],
      body: `<p>응답이 2xx면 <code>api()</code>가 JSON을 돌려주고 <code>done("거래를 기록했어요")</code>가 실행된다.</p>
<ol><li><code>session.invalidate()</code>: 세션의 <code>revision</code> 숫자를 1 올린다. 서버 데이터를 읽는 <code>useResource</code>들이 이 숫자를 의존값으로 갖고 있다.</li>
<li>토스트를 띄우고 <code>goBack()</code>으로 이전 화면(홈)으로 돌아간다. 성공했을 때는 <code>busy</code>를 다시 false로 만들지 않는다. 빠지는 화면을 다시 그리면 Android에서 빈 화면이 났기 때문이다(코드 주석, {{p:docs/bug-transaction-edit-blank-screen.md}}).</li>
<li>홈이 다시 앞에 나오면 <code>useFocusEffect</code>가 돌고, <code>revision</code>도 바뀌었으니 <code>GET /budget/today</code>를 다시 부른다.</li>
<li>서버가 새 거래를 반영해 다시 계산한다(설계 편 {{v:design.calc|계산식}}).</li></ol>
<table class="mini"><tr><th></th><th>저장 전</th><th>9,000원 저장 후</th></tr>
<tr><td>추정 잔액</td><td>{{n:before.estimatedBalance}}</td><td>{{n:created.estimatedBalance}}</td></tr>
<tr><td>남은 생활비(remaining)</td><td>{{n:before.remaining}}</td><td>{{n:created.remaining}}</td></tr>
<tr><td>하루 예산(dailyBudget)</td><td>{{n:before.dailyBudget}}</td><td>{{n:created.dailyBudget}}</td></tr>
<tr><td><b>오늘 쓸 수 있는 돈</b></td><td>{{n:before.todayAvailable}}</td><td><b>{{n:created.todayAvailable}}</b></td></tr>
<tr><td>이번 주 쓸 수 있는 돈</td><td>{{n:before.weekAvailable}}</td><td>{{n:created.weekAvailable}}</td></tr></table>
<p class="note">숫자는 이 가이드의 계산 시뮬레이터(서버 <code>BudgetCalculator</code>를 옮긴 것, 테스트 기대값 55개와 일치 확인)로 낸 가상 시나리오 값이다. 하루 예산은 그대로이고 오늘 남은 돈만 줄어든다: 하루 예산 = (남은 생활비 + <b>오늘 쓴 돈</b>) ÷ 남은 날이라, 오늘 쓴 돈이 오늘 예산을 줄이지는 않는다. 로컬 실행에서도 같은 현상(하루 예산 475,000 유지, 오늘 남은 돈만 9,000 감소)을 확인했다 {{b:ran}}.</p>`,
      input: "HTTP 201 JSON", output: "홈 화면의 새 금액",
      memory: "<code>revision+1</code>, 홈의 <code>Today</code> state 교체", db: "<code>GET /budget/today</code>가 오늘 {{t:daily_budgets}} 행을 덮어씀",
      next: "이제 내역에서 이 거래를 눌러 10,000원으로 고친다.",
    },
    {
      n: 12, track: "edit", title: "수정 화면: 서버에서 거래를 읽어 폼 채우기",
      where: "{{s:txedit}} → {{c:TxEditRoute}} → {{c:TransactionForm}}",
      snips: ["fe-route-edit", "fe-form-wrapper"],
      body: `<p>내역에서 항목을 누르면 <code>router.push("/transactions/1")</code>. 파일 이름 <code>[id].tsx</code>의 대괄호 자리가 <code>1</code>이 되고 <code>useLocalSearchParams()</code>로 꺼낸다.</p>
<p><code>TransactionForm</code>은 <code>id</code>가 있으니 <code>useResource("/transactions/1")</code>로 먼저 서버에서 읽는다(서버: <code>findByIdAndUserId(1, 1)</code>). 읽는 동안 <code>&lt;Loading /&gt;</code>, 실패하면 오류와 다시 시도. 받으면 <code>&lt;Form key="1" existing={거래} /&gt;</code>로 그리고, <code>useState(existing?.amount ?? …)</code>처럼 <b>받은 값으로 state를 채운다</b>. 금액칸에 10000을 친다.</p>`,
      input: "주소의 id=1", output: "state: amount=\"10000\", 나머지는 서버 값",
      memory: "state 채움", db: "SELECT(내 거래인지 함께 확인)",
      next: "저장을 누르면 같은 <code>save()</code>가 이번엔 PATCH를 보낸다.",
    },
    {
      n: 13, track: "edit", title: "PATCH 요청: 등록과 다른 점",
      where: "{{c:TransactionForm}} <code>save()</code> → {{c:apiClient}}",
      snips: [],
      body: `<p>같은 <code>save()</code>지만 <code>existing</code>이 있으니 셋이 다르다.</p>
<ul><li>메서드·주소: <code>PATCH /api/v1/transactions/1</code></li>
<li><code>key: existing ? undefined : …</code> → <b>Idempotency-Key를 보내지 않는다.</b> 같은 수정을 두 번 보내도 결과가 같으므로(금액을 10000으로 '정하는' 요청) 키가 필요 없다.</li>
<li>본문은 폼의 모든 필드를 보낸다(바뀐 금액만 보내는 것이 아니다). 서버 PATCH는 보낸 필드만 바꾸는 규칙이지만, 이 앱은 화면 값을 통째로 보낸다.</li></ul>
<pre class="code-plain" data-copy>PATCH /api/v1/transactions/1 HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJ…

{"type":"EXPENSE","amount":10000,"categoryId":1,"title":"점심","memo":"","occurredAt":"2026-10-13T12:30:00+09:00"}</pre>
<p>서버 입구(보안 필터 → 컨트롤러 <code>@PatchMapping("/{id}")</code> → <code>@Valid UpdateRequest</code>)는 5·6단계와 같다. <code>@PathVariable long id</code>가 주소의 1을 꺼낸다.</p>`,
      input: "state", output: "HTTP PATCH",
      memory: "<code>lock</code>·<code>busy</code>", db: "변화 없음",
      next: "서비스의 <code>update()</code>.",
      extraSnips: ["be-tx-controller-patch", "be-tx-dto-update"],
    },
    {
      n: 14, track: "edit", title: "Service.update: 찾기 → 검사 → 엔티티 고치기",
      where: "{{c:TransactionService}} <code>update()</code>·<code>find()</code>, {{c:Transaction}} <code>update()</code>",
      snips: ["be-tx-service-update", "be-tx-service-find", "be-tx-entity-update"],
      body: `<p><code>@Transactional</code>이 붙어 있어서 메서드가 시작될 때 스프링이 트랜잭션을 연다(등록은 코드로 열었고, 수정은 어노테이션으로 연다).</p>
<ol><li><code>find(1, 1)</code> = <code>findByIdAndUserId(1, 1)</code> → <code>WHERE id=1 AND user_id=1</code>. <b>남의 거래는 여기서 0행 → 404</b>(존재 여부도 알려 주지 않음). 로컬에서 다른 사용자 토큰으로 확인 {{b:ran}}.</li>
<li>읽어 온 엔티티는 영속성 컨텍스트가 <b>읽은 순간의 값(스냅숏)과 함께</b> 기억한다.</li>
<li>종류나 카테고리가 왔으면 바뀐 조합으로 <code>requireForType</code> 다시 검사(앱이 늘 보내므로 늘 검사된다).</li>
<li><code>t.update(...)</code>: null이 아닌 필드만 엔티티에 넣는다. <code>amount</code>가 9000 → 10000, <code>updatedAt</code>은 지금. 카테고리가 바뀌면 <code>fromFixed=false</code>.</li>
<li><code>return toResponse(t)</code>. <b>save()를 부르지 않는다.</b></li></ol>`,
      input: "userId=1, id=1, UpdateRequest", output: "고쳐진 엔티티(메모리)",
      memory: "엔티티 필드 amount=10000(스냅숏은 9000)", db: "SELECT 두 번. 아직 UPDATE 없음",
      next: "UPDATE는 언제 나가나? 메서드가 끝나 commit할 때다.",
    },
    {
      n: 15, track: "edit", title: "변경 감지 → flush → UPDATE → commit",
      where: "스프링 트랜잭션 관리자 + Hibernate 영속성 컨텍스트",
      snips: [],
      body: `<p><code>update()</code>가 예외 없이 끝나면 스프링이 commit을 시작한다. commit 직전 Hibernate가 <b>flush</b>를 한다: 관리 중인 엔티티의 지금 값과 스냅숏을 비교해(변경 감지) 달라진 엔티티마다 UPDATE를 만들어 DB에 보낸다. 그다음 DB에 commit을 보낸다.</p>
<p>로컬 실행 로그에서 순서가 그대로 보인다 {{b:ran}}: <code>Committing JPA transaction</code> 줄 <b>다음에</b> <code>update transactions set …</code>가 찍힌다. 수정 코드에 <code>save()</code>가 없어도 DB가 바뀌는 이유다.</p>
<p>UPDATE가 <b>모든 열</b>을 다시 쓴다(<code>set amount=?, category_id=?, …, user_id=? where id=?</code>)는 점도 로그에서 확인된다. Hibernate 기본 동작이고, 이 프로젝트는 <code>@DynamicUpdate</code>를 쓰지 않는다. {{c:UserRepository}} 주석이 같은 이유로 사용자 행은 잠금 조회로 읽으라고 적어 두었다. 거래 행에는 잠금·버전이 없으므로, 같은 거래를 두 기기에서 거의 동시에 고치면 나중 요청이 앞 요청을 덮는다 {{b:infer}}.</p>
<pre class="code-plain">update transactions set amount=10000, category_id=1, created_at=…, from_fixed=false, idempotency_key='6f1c…',
  memo=NULL, occurred_at='2026-10-13 03:30:00', title='점심', type='EXPENSE', updated_at=…, user_id=1 where id=1</pre>
<p class="note">위 SQL은 값을 넣어 보여 주려는 <b>개념 예시</b>다. 실제 로그에는 값 대신 <code>?</code>가 찍힌다.</p>`,
      input: "관리 중인 엔티티", output: "UPDATE 1행 → commit",
      memory: "영속성 컨텍스트 닫힘", db: "<b>transactions.id=1의 amount 9000 → 10000, updated_at 갱신</b>",
      next: "응답 200 → 앱.",
      evidence: LOG_PATCH,
    },
    {
      n: 16, track: "edit", title: "앱: 내역으로 돌아가 다시 읽기",
      where: "{{c:TransactionForm}} <code>done(\"거래를 수정했어요\")</code> → {{c:TransactionsScreen}}·{{c:HomeScreen}}",
      snips: [],
      body: `<p>11단계와 같다. <code>invalidate()</code> → 내역으로 돌아가면 <code>GET /transactions?from=…&amp;to=…</code>를 다시 읽어 10,000원으로 보이고, 홈에 가면 <code>GET /budget/today</code>를 다시 읽는다.</p>
<table class="mini"><tr><th></th><th>9,000원일 때</th><th>10,000원으로 수정 후</th></tr>
<tr><td>추정 잔액</td><td>{{n:created.estimatedBalance}}</td><td>{{n:edited.estimatedBalance}}</td></tr>
<tr><td>오늘 쓴 돈</td><td>{{n:created.todaySpent}}</td><td>{{n:edited.todaySpent}}</td></tr>
<tr><td><b>오늘 쓸 수 있는 돈</b></td><td>{{n:created.todayAvailable}}</td><td><b>{{n:edited.todayAvailable}}</b></td></tr>
<tr><td>이번 주 쓸 수 있는 돈</td><td>{{n:created.weekAvailable}}</td><td>{{n:edited.weekAvailable}}</td></tr></table>
<p>앱은 이 숫자를 직접 고쳐 쓰지 않는다. 화면에 보이는 값은 언제나 서버가 다시 계산해 준 값이다(AGENTS.md "클라이언트에서 따로 계산하지 않는다").</p>
<p><b>늦게 온 응답</b>: 저장하는 사이 로그아웃·다른 계정 로그인이 일어나면 <code>generation</code>이 바뀐다. 그 뒤 도착한 이전 세션 요청의 401은 새 세션을 끊지 않는다({{x:unitApiSession}}, 직접 실행 통과 {{b:ran}}).</p>`,
      input: "HTTP 200 JSON", output: "내역·홈의 새 값",
      memory: "<code>revision+1</code>", db: "다시 읽기(+오늘 하루 예산 덮어쓰기)",
      next: "끝. 아래 질문으로 이해했는지 확인해 보자.",
    },
  ];

  const faq = [
    { id: "q-userid", q: "userId는 어디서 오는가?", a: "요청 본문이 아니라 <b>토큰</b>에서 온다. 로그인 때 {{c:TokenService}}가 <code>sub=\"1\"</code>을 넣어 서명하고, 요청마다 보안 필터가 서명을 확인한 뒤, 컨트롤러가 <code>CurrentUser.id(jwt)</code>로 꺼낸다. 본문에 다른 userId를 넣어도 DTO에 그 필드가 없어서 무시된다. {{snip:be-currentuser}}" },
    { id: "q-other", q: "남의 거래 수정은 어디서 막는가?", a: "서비스의 <code>find(userId, id)</code>가 <code>findByIdAndUserId</code>로 <b>id와 user_id를 함께</b> 조건에 넣는다. 남의 거래면 0행 → <code>ApiException(NOT_FOUND)</code> → 404. '있지만 권한 없음(403)'이 아니라 '없음(404)'이라서 다른 사람의 거래 번호가 있는지도 알 수 없다. 카테고리도 <code>findByIdAndUserId</code>. 테스트: {{x:SecurityTest}} <code>otherUsersTransactionsAndCategoriesAreBlocked</code>. {{snip:t-security-other}}" },
    { id: "q-dto", q: "DTO, Entity, DB 행은 어떻게 다른가?", a: "<b>DTO</b>(<code>CreateRequest</code>, <code>TransactionResponse</code>)는 HTTP로 오가는 JSON 모양이다. 검증 규칙이 붙고, 응답 DTO에는 카테고리 이름처럼 다른 테이블 값도 들어간다. <b>Entity</b>(<code>Transaction</code>)는 DB 한 행의 자바 모습이다. <code>idempotencyKey</code>, <code>updatedAt</code>처럼 API에 안 나가는 필드도 있다. <b>DB 행</b>은 실제 저장된 값이다(시각은 UTC 추정, 금액은 BIGINT). 세 가지를 나눠 두면 DB 열을 바꿔도 API 계약이 바로 깨지지 않고, 받아서는 안 되는 값(userId)을 요청에서 받지 않는다." },
    { id: "q-save", q: "save()가 없는 수정 코드가 DB에 반영되는 이유는?", a: "트랜잭션 안에서 리포지토리로 읽은 엔티티는 영속성 컨텍스트가 관리한다. 필드를 바꾸면 commit 직전 flush에서 Hibernate가 처음 값과 비교해(변경 감지) UPDATE를 보낸다. 로컬 로그에서 <code>Committing JPA transaction</code> 다음에 <code>update transactions …</code>가 찍힌 것으로 확인했다 {{b:ran}}. 반대로 <code>@Transactional</code>이 없는 곳에서 읽은 엔티티를 고치면 아무 일도 일어나지 않는다." },
    { id: "q-flush", q: "flush와 commit은 어떻게 다른가?", a: "<b>flush</b> = 메모리에 쌓인 변경을 SQL로 DB에 보내기. 보내도 트랜잭션은 열려 있어 rollback하면 취소된다. <b>commit</b> = DB에 '확정'을 보내기. 이후 다른 연결도 그 값을 본다. 등록의 INSERT는 IDENTITY 때문에 <code>save()</code> 순간 바로 나갔지만(commit 전), 확정은 메서드가 끝난 뒤 commit에서 일어났다." },
    { id: "q-rollback", q: "오류가 나면 무엇이 rollback되는가?", a: "그 트랜잭션 안에서 보낸 SQL 전부. 예: 수정 중 카테고리 검사에서 400이 나면 로그에 <code>Participating transaction failed - marking existing transaction as rollback-only</code> → <code>Rolling back JPA transaction</code>이 찍힌다 {{b:ran}}. 같은 요청이라도 <b>다른 트랜잭션</b>은 따로다: 보안 필터의 사용자 조회는 이미 끝난 별도 트랜잭션이고, 내역 조회 전 고정지출 자동 기록(<code>postDue</code>)은 <code>REQUIRES_NEW</code>로 먼저 commit되므로 뒤의 조회가 실패해도 남는다. 앱 쪽은 rollback 개념이 없고, 실패하면 <code>unlock()</code>으로 입력값을 그대로 둔 채 다시 시도할 수 있게 한다.<pre class=\"code-plain\">" + LOG_ROLLBACK.replace(/</g, "&lt;") + "</pre>" },
    { id: "q-idem", q: "같은 등록 요청을 재시도하면 중복 저장을 어떻게 막는가?", a: "세 겹이다. ① 앱: 응답을 못 받으면(<code>NETWORK</code>·<code>INTERNAL_ERROR</code>) <code>uncertain</code> 상태로 입력을 잠그고, '다시 시도'는 <b>같은 본문·같은 키</b>를 보낸다. ② 서버: 트랜잭션 안에서 먼저 <code>(user_id, key)</code>로 찾아 있으면 그 거래를 200으로 돌려준다. ③ DB: 두 요청이 동시에 와서 둘 다 '없음'을 보고 INSERT하면 UNIQUE <code>uk_transactions_idem</code>이 하나를 거절하고, 진 쪽은 rollback 뒤 <b>새 트랜잭션</b>에서 이긴 쪽 거래를 찾아 200으로 준다. 테스트: 동시 6개 → 201 하나·200 다섯({{x:ApiFlowTest}}, 직접 실행 통과 {{b:ran}}), E2E가 응답을 일부러 끊고 같은 키로 재시도({{x:e2eService}}, 읽기만 함). {{snip:t-idem-race}}<pre class=\"code-plain\">" + LOG_RETRY.replace(/</g, "&lt;") + "</pre>" },
    { id: "q-refresh", q: "저장 후 화면과 예산 값은 실제로 어떻게 갱신되는가?", a: "앱이 숫자를 고쳐 쓰지 않는다. <code>session.invalidate()</code>가 <code>revision</code>을 올리고, 화면이 다시 앞에 나오면 <code>useResource</code>가 서버에서 다시 읽는다. 홈은 <code>GET /budget/today</code>, 내역은 <code>GET /transactions</code>. 서버가 그때마다 거래를 다시 모아 계산한다. 그래서 저장 직후 앱이 꺼져도 다음에 열면 맞는 값이 보인다." },
  ];
  return { steps, faq, scenario: "가상 사용자 learner@example.com, 2026-10-13(화) 10:00 잔액 1,250,000원, 수입일 25일, 15일 월세 450,000원, 매달 저축 300,000원." };
}
