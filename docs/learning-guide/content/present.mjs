// 발표 모드 장면. 학습 내용과 같은 그림·숫자를 쓴다(숫자는 시뮬레이터, 그림은 diagrams.mjs).
import { archSvg, laneSvg, erdSvg, deploySvg } from "./diagrams.mjs";

export function build({ SC }) {
  const n = (x) => x.toLocaleString("ko-KR");
  const c = SC.created, b = SC.before;
  return [
    {
      id: "p1", title: "해결하려는 문제와 실제 구현 범위", time: "1분",
      big: `<p class="pbig">“오늘 얼마까지 써도 되지?”</p><p class="pmid">입력한 잔액·수입일·고정지출·거래로 <b>서버가 계산</b>해 보여 준다</p>`,
      points: ["사용자: 사회초년생. 통장 연결 없이 직접 입력", "실제 앱: 가입·예산 설정·거래 기록·오늘/이번 주 쓸 수 있는 돈·분석(집계)·시드머니·코인", "없는 것: 계좌 연결, AI 소비 분석, 결제 알림 자동 기록(시연에만)"],
      notes: {
        say: "우리 앱이 '추정'이라는 점을 먼저 말한다. 계산의 재료는 전부 사용자가 넣은 값이다.",
        point: "{{v:home.real|실제/시연 구분 표}}, {{a:budget-today}}",
        expect: "분석 탭은 AI인가? / 은행 잔액과 다르면?",
        answer: "분석은 기간 합계(AnalysisController) {{b:code}}. 잔액이 틀어지면 사용자가 다시 입력하고, 기준 시각 이후 거래만 다시 계산한다({{v:design.balanceat|잔액 기준 시각}}).",
      },
      jumps: [["실제·시연 구분", "home.real"], ["입력값과 계산값", "arch.inputs"], ["기능 목록", "idx-feature"]],
    },
    {
      id: "p2", title: "전체 아키텍처와 EC2·RDS 역할", time: "2분",
      diagram: archSvg(),
      points: ["Expo 한 코드 → Android 앱 + 웹(Vercel)", "EC2: Caddy(HTTPS) → API 컨테이너(Spring Boot, app.jar)", "RDS MySQL: Flyway가 앱 시작 때 스키마 적용 · 별도 웹사이트는 internal API로만"],
      notes: {
        say: "화살표에 무엇이 오가는지 읽어 준다: HTTPS·JSON, 내부 HTTP, SQL과 조회 결과.",
        point: "{{p:backend/deploy/docker-compose.yml}}, {{p:backend/deploy/Caddyfile}}",
        expect: "왜 서버에서 빌드하지 않나? / DB는 밖에서 접속되나?",
        answer: "Dockerfile 주석: t3.micro에서 Gradle 빌드를 피하려고 PC에서 만든 jar만 올린다 {{b:config}}. RDS는 EC2에서만 접근(HANDOFF {{b:doc}}), api 컨테이너는 포트를 밖에 열지 않는다(<code>expose</code>) {{b:config}}.",
      },
      jumps: [["배포 구성", "arch.deploy"], ["EC2와 RDS", "arch.ec2rds"], ["웹 서버·WAS·DB", "arch.servers"], ["웹사이트 경계", "arch.web"]],
    },
    {
      id: "p3", title: "대표 요청: 거래 등록·수정이 지나는 길", time: "3분",
      diagram: laneSvg(),
      points: [`점심 9,000원 → 오늘 쓸 수 있는 돈 ${n(b.todayAvailable)} → ${n(c.todayAvailable)}`, "userId는 토큰에서 · 남의 거래는 findByIdAndUserId로 404", "수정은 save() 없이 변경 감지 → commit 직전 UPDATE · 등록 재시도는 Idempotency-Key + UNIQUE"],
      notes: {
        say: "번호를 짚으며 층을 내려간다. 5단계(토큰 확인), 7단계(키·카테고리), 15단계(flush·commit) 세 곳에서 멈춘다.",
        point: "{{c:TransactionForm}} <code>save()</code>, {{c:TransactionService}} <code>create</code>·<code>update</code>",
        expect: "save() 없이 왜 저장되나? / 같은 요청이 두 번 오면?",
        answer: "로컬 로그: 'Committing JPA transaction' 다음에 update {{b:ran}}. 동시 6건 → 201 하나·200 다섯({{x:ApiFlowTest}}) {{b:ran}}.",
      },
      jumps: [["16단계 전체", "flow-tx"], ["질문 8개", "flow-tx.faq"], ["Idempotency 설계", "design.idem"], ["JPA가 하는 일", "back.jpa"]],
    },
    {
      id: "p4", title: "핵심 ERD", time: "1.5분",
      diagram: erdSvg(),
      points: ["17개 테이블, 거의 모두 user_id → users(ON DELETE CASCADE)", "거래 → 카테고리는 삭제 제한 · 고정지출 기록·적용 코스튬은 FK 없는 논리 관계", "Flyway V1~V11(V3만 Java) · 계산값(오늘 쓸 돈·점수)은 저장하지 않음"],
      notes: {
        say: "users 하나에 기능별 묶음이 매달린 모양이라고 설명하고, 거래·카테고리 선을 짚는다.",
        point: "{{t:transactions}}, {{t:fixed_expense_postings}}, {{p:backend/src/main/resources/db/migration}}",
        expect: "엔티티에 연관관계가 없는 이유? / 카테고리를 지우면 거래는?",
        answer: "연관관계 대신 ID만 저장 {{b:code}}(이유는 문서에 없음, SQL을 드러내려는 선택으로 추정 {{b:infer}}). 카테고리 삭제 전에 거래를 기본 '기타'로 옮긴다({{c:CategoryService}} <code>delete</code>).",
      },
      jumps: [["ERD와 FK 표", "db.erd"], ["테이블 목록", "idx-table"], ["Flyway 이력", "db.flyway"], ["직접 SELECT", "db-lab.sql"]],
    },
    {
      id: "p5", title: "주요 설계와 핵심 코드", time: "1.5분",
      big: `<div class="pgrid"><div><b>계산은 서버 한 곳</b><span>BudgetCalculator 순수 함수 · 테스트 11개 + 정책 예시 표 13개</span></div><div><b>JWT + token_version</b><span>요청마다 DB 확인 → 로그아웃 즉시 반영</span></div><div><b>잠금 + UNIQUE</b><span>설정 행·지갑 행 FOR UPDATE, 지급·반영은 유일 키</span></div><div><b>늦은 응답 무시</b><span>세션 generation으로 이전 세션 401 무시</span></div></div>`,
      points: [`하루 예산 = (남은 생활비 + 오늘 쓴 돈) ÷ 남은 날 → 시나리오 ${n(c.dailyBudget)}원`, "고정지출 자동 기록은 예약 작업이 아니라 조회 때", "모든 오류는 { code, message } 한 모양"],
      notes: {
        say: "네 가지를 각 한 문장으로. 질문이 오면 해당 설계 절로 간다.",
        point: "{{c:BudgetCalculator}} <code>compute</code>, {{c:SecurityConfig}} <code>converter</code>, {{c:CoinService}} <code>post</code>",
        expect: "앱에서 계산하면 더 빠르지 않나? / 동시 구매는?",
        answer: "AGENTS.md 규칙: 서버가 최종값 {{b:doc}}. 동시 구매 2번 → 200·409({{x:CoinFlowTest}}) {{b:ran}}.",
      },
      jumps: [["계산식·시뮬레이터", "design.calc"], ["JWT", "design.auth"], ["코인 동시성", "design.coin"], ["늦은 응답", "design.late"]],
    },
    {
      id: "p6", title: "현재 제약과 멘토님께 여쭐 점", time: "1분",
      big: `<ol class="plist"><li>조회 API가 쓰기를 한다(고정지출 기록·하루 예산 저장)</li><li>서버 메모리 상태(로그인 실패 제한·소셜 state) → 서버 한 대 전제</li><li>고정지출 이름 변경 중복 기록: #129 머지 완료, 운영 반영은 백엔드 배포 필요</li><li>테스트는 H2, 운영은 MySQL</li></ol>`,
      points: ["성능·사용자 수는 측정하지 않았다", "질문은 '현재 → 효과·한계 → 질문' 형식으로 준비"],
      notes: {
        say: "약점을 먼저 말하고 각각 근거(코드·로그)를 짚는다. 측정하지 않은 것은 주장하지 않는다.",
        point: "{{v:design.limits|제약 표}}, {{v:design.fixed|#129 수정과 남은 한계}}",
        expect: "지금 당장 고쳐야 할 것은?",
        answer: "#129에서 회귀 테스트와 수정을 완료했고 CI도 통과했다. 머지는 완료했고 운영 반영은 별도 백엔드 배포가 필요하다. 항목 id가 저장마다 바뀌어 수정과 추가를 구분하지 못하는 설계는 검토할 만하다 {{b:suggest}}.",
      },
      jumps: [["멘토 질문 8개", "mentor.questions"], ["제약 표", "design.limits"], ["미확인 사항", "scope.unknown"]],
    },
  ];
}
