# 현재 기능 기준표

기준 2026-10-15, `main`. 화면만 있는 것과 서버·DB까지 연결된 것을 구분한다.
기능을 추가하거나 바꾸면 이 표를 같이 고친다. README와 HANDOFF는 이 표를 기준으로 쓴다.

구분: **서비스** = 실제 앱(Android·웹) / **시연** = `/demo` 아래 예시 데이터(웹 전용) / **미구현** = 계획만 있음

## 서비스

| 기능 | 화면·경로 | API·저장 | 확인 방법 |
|---|---|---|---|
| 시작 분기 | `/` → `src/app/index.tsx` (로그인·예산 설정 여부로 `/home`·`/onboarding`·시작 화면) | `GET /me` | E2E `expired token returns to start…` |
| 회원가입·로그인·로그아웃 | `/auth/signup`, `/auth/login` → `service/AuthScreen.tsx` | `POST /auth/signup·login·logout`. 토큰은 앱 SecureStore, 웹 localStorage(`service/storage.ts`) | 백엔드 `ApiFlowTest`(가입 검증·로그인 제한·로그아웃 폐기), E2E `real service lifecycle…` |
| 초기 예산 설정 7단계 | `/onboarding/*` → `service/OnboardingScreen.tsx` (index·balance·income·fixed·card·protect·done) | 입력 중에는 기기에 임시 보관(`service/BudgetDraft.tsx`), 마지막에 `PUT /budget/settings` 한 번 | E2E `real service lifecycle…` |
| 오늘 쓸 수 있는 돈 | `/home` → `service/HomeScreen.tsx` | `GET /budget/today`. 계산은 서버(`budget/BudgetCalculator.java`)가 최종값 | 백엔드 `BudgetCalculatorTest` |
| 캐릭터 홈 / 기본 홈 | `/home`, 마이에서 전환 | 점수는 서버(`characterPoints`, `daily_budgets` 테이블 V4). 홈 스타일 선택은 기기 저장(`service/homeStyle.ts`) | 백엔드 `CharacterScoreTest` |
| 고정지출 자동 기록 | 화면 없음(내역에 거래로 나타남) | 날짜가 된 고정지출을 서버가 지출 거래로 기록(`budget/FixedExpensePoster.java`) | 백엔드 `ApiFlowTest.fixedExpenses…` |
| 거래 직접 입력·수정·삭제 | `/transactions`, `/transactions/new`, `/transactions/[id]` → `service/TransactionForm.tsx` | `GET·POST·PATCH·DELETE /transactions`, 재시도 시 같은 `Idempotency-Key` | E2E `real service lifecycle…`, 백엔드 `ApiFlowTest.fullFlow` |
| 카테고리 관리 | `/categories` → `service/CategoriesScreen.tsx` | `GET·POST·PATCH·DELETE /categories` (삭제하면 거래는 기타로) | E2E `real service lifecycle…` |
| 소비 분석 | `/analysis` → `service/AnalysisScreen.tsx` | `GET /analysis/summary` | E2E `real service lifecycle…`(분석 탭 진입) |
| 예산 다시 설정 | 마이 → 예산 설정 수정 | `PUT /budget/settings` (잔액 기준 시각을 지금으로) | E2E `re-entering the balance…` |
| 계정 삭제 | 앱 `/account/delete`, 웹 공개 `/delete-account` → `service/DeleteAccountScreen.tsx` | `DELETE /me` (`user/AccountDeletionService.java`) | E2E `public deletion…` |
| 공개 페이지 | `/privacy`, `/terms`, `/support` | 원문은 `docs/play-store/privacy-policy.md`·`terms.md` | E2E `approved legal copy…`(웹 화면과 원문 일치 검사) |
| 원격 업데이트 안내 | 앱 탭 화면 상단 배너 → `components/UpdateBanner.tsx` (웹에서는 안 뜸) | `expo-updates` | Android 실기기 |

## 시연 (`/demo`, 웹 전용)

앱(Android·iOS)에서는 열리지 않고, 웹도 `EXPO_PUBLIC_ENABLE_DEMO=false`면 막힌다(`src/app/demo/_layout.tsx`). 데이터는 전부 `src/demo/data/mock.ts`이고 서버를 부르지 않는다. 새로 고침하면 처음 상태로 돌아간다.

| 기능 | 경로 | 비고 |
|---|---|---|
| 계좌 연결·AI 분석 온보딩 | `/demo/onboarding/*` | 오픈뱅킹 Mock. 실제 서비스에는 없음 |
| 홈·캐릭터 홈(B안) | `/demo`, `/demo/home2` | 캐릭터 단계는 소비 속도로 계산(`demo/components/CharacterHero.tsx`) |
| 예정 지출·AI 초안 | `/demo/schedule`, `/demo/schedule/new` | 자연어 파싱 Mock(`demo/ai/parsePlan.ts`) |
| 고액 지출 계획 | `/demo/plan` | AI 추천 결제 주 Mock |
| AI 메모리 | `/demo/memory` | `demo/ai/memory.ts` |
| 정산·1/N·대신 결제 | `/demo/settle/[id]`, `/demo/tx/[id]` | |
| 결제·아침 요약 푸시 | `/demo/simulations/*` | 잠금화면 모양만 보여줌. 실제 푸시 없음 |

## 미구현 (서비스에 없음)

문서나 시연에 나와도 실제 앱에는 없다. 스토어 문구·앱 화면에 쓰지 않는다.

- 계좌 연결(오픈뱅킹), AI 소비 분석·추천
- 결제 알림·문자 자동 기록, 푸시 알림
- 예정 지출·고액 지출 계획, 정산
- 비밀번호 찾기, 이메일 인증
- 오프라인 저장(SQLite·outbox) — 앱은 온라인 전용
- 수입일 공휴일 처리(토·일만 다음 월요일로 미룸)

## 호환 경로 결정 기록

외부에 공유된 링크·북마크는 저장소 검색으로 확인할 수 없어서, 지울 근거가 생길 때까지 남긴다.

| 경로 | 하는 일 | 결정 | 이유 |
|---|---|---|---|
| `frontend/vercel.json` redirect 9개 (`/home2`, `/plan`, `/budget-detail`, `/notifications`, `/memory`, `/schedule`, `/schedule/*`, `/tx/:id`, `/settle/:id`) | 분리 전 시연 주소 → `/demo/...` (307 임시) | 유지 | 발표 자료 등에 예전 주소가 남아 있을 수 있음. 서비스가 같은 경로를 쓰게 되면 그 줄을 지운다 |
| `src/app/demo/pay.tsx`, `src/app/demo/push.tsx` | `/demo/pay`·`/demo/push` → `/demo/simulations/...` (쿼리 유지) | 유지 | 위와 같음 |
