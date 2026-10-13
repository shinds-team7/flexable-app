# Flex-able 텅장관리 — Frontend

Expo(React Native) + Expo Router 기반. **하나의 코드로 iOS / Android / Web** 을 동시에 빌드한다.
시연(Mock, 버전 1.1.0)은 모두 `/demo` 아래에 있고, 데이터는 `src/data/mock.ts` 에서 오늘 날짜 기준으로 생성된다.
실제 서비스(버전 1.0.0)는 `/` 이하에 구현되어 있으며 자체 API로 회원가입·예산·거래·분석·계정 삭제를 제공한다. APK 빌드 완료 후 실기기 테스트 중이다. 현재 개발환경·빌드·출시 상태는 [`../docs/HANDOFF.md`](../docs/HANDOFF.md), 분리 설계는 [`docs/DESIGN_DEMO_SERVICE_SPLIT.md`](docs/DESIGN_DEMO_SERVICE_SPLIT.md)를 따른다.

현재 백엔드는 `../backend/`의 Spring Boot·MySQL이며, 앱은 온라인 API를 사용한다. 기존 전환 설계는 [`docs/SERVICE_MIGRATION.md`](docs/SERVICE_MIGRATION.md)에 있다. 이 설계 문서의 FastAPI·SQLite는 현재 구현 상태를 뜻하지 않는다.

## 실행

```bash
cd frontend
npm ci
npm run web        # 브라우저 (http://localhost:8081)
npm start          # Expo Go 앱으로 QR 스캔 → 실제 폰에서 확인
npm run build:web  # 정적 웹 빌드 → dist/
npm run typecheck
npm run lint
```

> 패키지 추가는 `npx expo install <pkg>` 로 (SDK 호환 버전 자동 선택)

## 화면

`/demo`에 처음 접속하면 시연 온보딩이 나온다. "체험 데이터로 둘러보기"로 바로 홈 진입 가능 (웹은 완료 여부를 localStorage에 기억, 마이 → "처음 설정 다시 하기"로 초기화).

**시연 상단 네비 4탭 (`src/app/demo/(tabs)`)**

| 경로 | 화면 | 핵심 기능 |
|------|------|-----------|
| `/demo` | 홈 | 오늘 쓸 수 있는 돈(결제마다 재계산, 최근 반영 결제 표시), 오늘 예정 소비 별도 표시, 다음 수입일·남은 생활비, 이번 주 금액(→분석), 정산 요청, 이번 주 후보 거래(예상 금액 + 수정/삭제), 고액 지출 D-day |
| `/demo/plan` | 지출계획 | 고액 지출 금액 입력 → AI 추천 결제 주, `< >` 1주 단위 조정, 확정 시 홈 반영 |
| `/demo/analysis` | 소비 분석 | 이번 주 / 이번 정산 주기 도넛, AI 리포트, 카테고리별 사용 현황 |
| `/demo/transactions` | 거래내역 | 연결 계좌 거래내역(반영 제외·1/N 배지), 월 이동, 필터. 항목 선택 → `/demo/tx/[id]` |
| `/demo/home2` | 홈 B안 (비교용) | 상단 중앙에 캐릭터(Lv.1 광부 → Lv.5 왕). 이번 주기 소비 속도로 레벨 결정, 좌우 희미한 `< >`로 시연용 레벨 변경. 아래는 기존 홈과 동일 |
| `/demo/my` | 마이 | 연결 계좌, 수입·고정지출·보호 금액 수정, AI 메모리, 푸시 알림 설정(정산 요약 받는 시간 변경), 시연 메뉴 |

**시연 상세 화면**

| 경로 | 화면 |
|------|------|
| `/demo/onboarding` → `account` → `income` → `fixed` → `protect` → `analyze` | 스플래시 → 계좌 연결(오픈뱅킹 Mock) → 수입일·금액 → 고정지출 → 잔액·보호 금액 → AI 분석 & 첫 금액 공개 |
| `/demo/budget-detail` | 오늘 금액 산출 상세 (계산 항목 나열, 보호 금액 수정) |
| `/demo/schedule/new` | 예정 지출 등록 — 자연어(AI 초안, 즉시 반영 후 수정/취소), 캘린더 불러오기, 직접 입력. 큰 지출이면 `/demo/plan`으로 안내 |
| `/demo/schedule` | 후보 거래(예정 지출) 목록 — 가로 박스 좌측 예상 금액, 우측 수정·삭제 / 정산 필요 / 정산 완료 기록 |
| `/demo/settle/[id]` | 지난 일정 ↔ 실제 결제 연결, 차액 시뮬레이션 + 확인 모달, AI 메모리 학습 |
| `/demo/tx/[id]` | 거래 상세 — 최하단 [1/N] [반영 제외] (N빵·대신 결제) |
| `/demo/memory` | AI 메모리 — 항목별 1회 평균 금액 수정, 소비 습관 잊기 |
| `/demo/notifications` | 알림 센터 (아침 정산 요약, 확인 요청, 정산 요청, D-day) |

## 시뮬레이션 URL (서버가 필요한 기능은 결과 화면만)

마이 → "시연 메뉴" (`/demo/simulations`)에서 모두 실행할 수 있다. 구 주소 `/demo/pay`, `/demo/push`는 쿼리를 유지한 채 새 주소로 이동한다.

| URL | 시연 내용 |
|-----|-----------|
| `/demo/simulations/pay?merchant=스타벅스&amount=5600&category=cafe` | 결제 수신 → 오늘 쓸 수 있는 돈 재계산 → 결제 푸시(잠금화면) |
| `/demo/simulations/push?type=morning` | 아침 정산 요약 푸시 (마이에서 설정한 시간) |
| `/demo/simulations/push?type=settle` | 지난 일정 정산 요청 푸시 |
| `/demo/simulations/push?type=plan` | 고액 지출 D-7 푸시 |
| `/demo/tx/nbbang` · `/demo/tx/proxy` | 회식비 1/N · 대신 결제 반영 제외 |
| `/demo/settle/s0` | 지난 일정 ↔ 실제 결제 정산 |

> 상태는 메모리에만 있어서 URL을 직접 새로 열면 Mock 초기 상태에서 시작한다.

## 폴더 구조

```
src/
  app/          # 라우트 (파일 = 화면). 서비스 시작/인증/탭/공개 정책, demo/ = 시연 전체
  service/      # 실제 서비스 화면·API 클라이언트·세션·설정
  demo/         # 시연 경로 helper(routes.ts)·시연 버전
  components/   # UI 컴포넌트 (ui.tsx 공통, Donut, WeekCalendar, AddScheduleModal ...)
  store/        # AppStore(전역 상태), budget.ts(예산 계산·AI 추천 Mock 로직)
  data/         # Mock 데이터 (거래내역, 계좌, 카테고리)
  theme/        # 색상·폰트 토큰
  utils/        # 날짜·금액 포맷
```

## 예산 계산 로직 (Mock, `src/store/budget.ts`) — 기획서 §4

- 계산 구간: 오늘 ~ 다음 수입일 전날 (수입은 입금된 뒤 새 주기에 반영)
- **남은 일반 생활비** = 계좌 잔액 − 미납 고정지출 − 미결제 카드 이용액 − 보호 금액 − 확보한 예정 지출 − 고액 지출 적립분
- **하루 기준액** = (남은 일반 생활비 + 오늘 쓴 돈) ÷ 남은 날짜 수(오늘 포함), **오늘 남은 금액** = 하루 기준액 − 오늘 소비
- 확인 필요 거래는 "확정 기준"으로 계산(잔액에서 빠진 금액을 되돌려 두고 홈에 잠정 배지)
- 음수면 0원 + 부족액 별도 안내
- AI(Mock: `src/ai/parsePlan.ts`, `src/ai/memory.ts`)는 예정 지출 금액 **제안**만, 산술은 고정 로직
- 고액 지출 AI 추천: 하루 기준액 감소율 25% 이하가 되는 가장 빠른 주

## 배포 (Vercel)

Vercel 프로젝트 설정에서 **Root Directory = `frontend`** 로 지정하면 `vercel.json` 설정대로 빌드된다.
(Build: `npx expo export -p web`, Output: `dist`, SPA rewrite 포함)

분리 전 시연 주소(`/onboarding`, `/plan`, `/tx/:id` 등)는 `vercel.json`의 임시(307) redirect로 `/demo/...`에 연결된다. 실제 서비스가 같은 경로를 쓰기 시작하면 해당 redirect를 지운다.
