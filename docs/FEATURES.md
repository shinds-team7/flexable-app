# 현재 기능 기준표

기준 2026-10-21, `main` + 코인·코스튬 PR(1.4.0). 화면만 있는 것과 서버·DB까지 연결된 것을 구분한다.
기능을 추가하거나 바꾸면 이 표를 같이 고친다. README와 HANDOFF는 이 표를 기준으로 쓴다.

구분: **서비스** = 실제 앱(Android·웹) / **시연** = 예시 데이터 웹 화면(2026-10-19부터 웹사이트 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)의 `/m`) / **미구현** = 계획만 있음

## 서비스

| 기능 | 화면·경로 | API·저장 | 확인 방법 |
|---|---|---|---|
| 시작 분기 | `/` → `src/app/index.tsx` (로그인·예산 설정 여부로 `/home`·`/onboarding`·시작 화면) | `GET /me` | E2E `expired token returns to start…` |
| 회원가입·로그인·로그아웃 | `/auth/signup`, `/auth/login` → `service/AuthScreen.tsx` | `POST /auth/signup·login·logout`. 토큰은 앱 SecureStore, 웹 localStorage(`service/storage.ts`) | 백엔드 `ApiFlowTest`(가입 검증·로그인 제한·로그아웃 폐기), E2E `real service lifecycle…` |
| 카카오·Google 로그인 | 시작 화면 `src/app/index.tsx`(`service/OAuthButtons.tsx`) → 브라우저 → `/oauth/callback`(`service/OAuthCallbackScreen.tsx`, 흐름은 `service/oauth.ts`). 앱 1.1.0부터(`expo-web-browser` 네이티브 모듈), 웹은 바로 | `GET /auth/oauth/providers`, `GET /auth/oauth/{provider}/start·callback`, `POST /auth/oauth/exchange`(1회용 코드 + verifier). 키가 없는 공급자는 "쓸 수 없어요" 안내. 같은 검증 이메일의 기존 계정이 있으면 연결해 로그인(기존 세션은 끊음). 연결된 계정에 이메일 로그인하면 비밀번호가 맞아도 "Google로 가입한 계정이에요" 안내와 해당 소셜 버튼(`service/AuthScreen.tsx`, 동작은 `service/useSocialLogin.ts`). 소셜 계정 탈퇴는 '탈퇴' 입력 | 백엔드 `OAuthFlowTest`·`MemoryOAuthStoreTest`·`RestOAuthProviderClientTest`, E2E `social login …`(교환 응답은 mock)·`email login of a google-linked account …`(로그인 응답 mock). 운영 키 설정 완료(10-19), 새 웹사이트에서 운영 로그인 확인. **Android 실기기 확인 전**(1.2.0 빌드로) |
| 초기 예산 설정 8단계 | `/onboarding/*` → `service/OnboardingScreen.tsx` (index·balance·income·fixed·card·seed(모아둔 돈)·protect(매달 저축할 돈)·done) | 입력 중에는 기기에 임시 보관(`service/BudgetDraft.tsx`), 마지막에 `PUT /budget/settings` 한 번 | E2E `real service lifecycle…` |
| 오늘 쓸 수 있는 돈 | `/home` → `service/HomeScreen.tsx` | `GET /budget/today`. 계산은 서버(`budget/BudgetCalculator.java`)가 최종값 | 백엔드 `BudgetCalculatorTest` |
| 캐릭터 홈 / 기본 홈 | `/home`, 마이에서 전환. 캐릭터 홈은 적용 중인 코스튬을 16:9 반복 영상으로 보여 준다(`service/OutfitView.tsx`, 파일 연결은 `service/outfits.ts`). 지금 운영에 보이는 코스튬은 광부(`costume-lv1`)와 잭팟(`outfit-01`, 상점 200코인, 원래 Lv.4를 임시 판매) 2개. 나머지는 V8에서 꺼 둠 | 점수는 서버(`characterPoints`, `daily_budgets` 테이블 V4), 최고 단계(peak)는 코스튬 해금용. 홈 스타일 선택은 기기 저장(`service/homeStyle.ts`) | 백엔드 `CharacterScoreTest`, E2E `signup gift, buy and apply a costume…`(홈 영상이 칸에 맞는지). **Android 실기기 영상 재생 확인 전**(1.4.0 빌드로) |
| 코인(앱에서만 쓰는 코인) | 상점 위쪽 잔액·[모으기](`service/CustomizeScreen.tsx`), 캐릭터 홈 헤더 상점 버튼(받을 코인이 있으면 빨간 점, `service/ServiceHeader.tsx`), 홈 보상 모달(`service/RewardModal.tsx`) | `POST /coins/check-in`(가입 선물 200 1회, 어제 예산 지킴 +5, 시간 적립 시작), `POST /coins/rewards/ack`, `GET /coins`, `POST /coins/collect`(1시간 1개, 하루 10개, 자정 소멸). `coin/`, V8 `coin_wallets`·`coin_ledger`(지급마다 유니크 키) | 백엔드 `CoinFlowTest`, E2E `signup gift…`(가입 선물), `collect takes the coins…`(적립은 시간이 필요해 응답 mock) |
| 상점(코스튬 구매·적용) | 캐릭터 홈 헤더 셔츠 버튼 → `/customize` → `service/CustomizeScreen.tsx`, 구매 완료 `service/PurchaseModal.tsx` | `GET /outfits`, `POST /outfits/{id}/purchase`(지갑 행 잠금, 200코인), `PUT /outfits/equipped`. 레벨 코스튬은 최고 단계로 열림(구매 불가). 상점 상품 10개는 V8에서 꺼져 있음(로컬·CI만 `app.outfits.show-inactive=true`로 보임) | 백엔드 `CoinFlowTest`, E2E `signup gift, buy and apply a costume…` |
| 추천 코드 | 마이 → 내 추천 코드·공유·입력(등록하면 입력칸 숨김) | `GET /referrals/me`, `POST /referrals`(양쪽 100, 한 번만, 내 코드 불가). 코드 주인은 다음 check-in에서 모달. `referral/` | 백엔드 `CoinFlowTest`, E2E `signup gift… a referral pays both people` |
| 시드머니·수입일 전날 반영 | 홈 시드머니 카드와 반영 창 → `service/SeedMoneyCard.tsx`. 수입일 전날 20시 기기 알림 → `service/seedReminder.ts`(앱 1.3.0부터 `expo-notifications`, 웹은 알림 없이 홈에서 창만) | `GET /budget/seed-money`, `POST /budget/seed-money/entries`(매달 저축할 돈 / 남은 돈 전부 / 직접 입력, 주기당 1번). 모아둔 돈은 `PUT /budget/settings`의 `seedBase`. 옮긴 돈은 추정 잔액에서 빠짐(`budget/SeedMoneyService.java`, V7) | 백엔드 `SeedMoneyFlowTest`, E2E `onboarding saves the money already set aside…`(반영 대기 응답은 mock). **Android 실기기 알림 확인 전** |
| 웹사이트 연동 | 설정 → 웹사이트 연동: 코드 발급·재발급·만료, 연동 목록·새로고침·해제 확인 구현. 배포·실기기 확인 전, 방침 결정·실서버 연동 확인 필요 | `POST /me/web-link-codes`, `GET·DELETE /me/web-links`, 웹 서버 전용 `/internal/v1/web-links/*`(서비스 키, 회원 정보·시드머니) | `WebLinksScreen.tsx`, `e2e/web-links.spec.ts`(API 모의 응답으로 화면 검증); 백엔드 `WebLinkFlowTest`, `SeedMoneyFlowTest.webLinkReadsConfirmedSeedMoney` |
| 고정지출 자동 기록 | 화면 없음(내역에 거래로 나타남) | 날짜가 된 고정지출을 서버가 지출 거래로 기록(`budget/FixedExpensePoster.java`) | 백엔드 `ApiFlowTest.fixedExpenses…` |
| 거래 직접 입력·수정·삭제 | `/transactions`, `/transactions/new`, `/transactions/[id]` → `service/TransactionForm.tsx` | `GET·POST·PATCH·DELETE /transactions`, 재시도 시 같은 `Idempotency-Key` | E2E `real service lifecycle…`, 백엔드 `ApiFlowTest.fullFlow` |
| 카테고리 관리 | `/categories` → `service/CategoriesScreen.tsx` | `GET·POST·PATCH·DELETE /categories` (삭제하면 거래는 기타로) | E2E `real service lifecycle…` |
| 소비 분석 | `/analysis` → `service/AnalysisScreen.tsx` | `GET /analysis/summary` | E2E `real service lifecycle…`(분석 탭 진입) |
| 예산 다시 설정 | 마이 → 예산 설정 수정 | `PUT /budget/settings` (잔액 기준 시각을 지금으로) | E2E `re-entering the balance…` |
| 계정 삭제 | 앱 `/account/delete`, 웹 공개 `/delete-account` → `service/DeleteAccountScreen.tsx` | `DELETE /me` (`user/AccountDeletionService.java`) | E2E `public deletion…` |
| 공개 페이지 | `/privacy`, `/terms`, `/support` | 원문은 `docs/play-store/privacy-policy.md`·`terms.md` | E2E `approved legal copy…`(웹 화면과 원문 일치 검사) |
| 접근 제어 | 로그인 후 모든 API | JWT 서명·사용자·토큰 버전 확인(`config/SecurityConfig.java`), 거래·카테고리는 소유자 조건으로 조회(남의 것은 404). CORS는 서버 `.env`의 허용 출처만 | 백엔드 `SecurityTest`(비로그인 401, 위조·서명 없는 토큰 401, 다른 사용자 데이터 차단, 허용 안 된 출처 403) |
| 원격 업데이트 안내 | 앱 탭 화면 상단 배너 → `components/UpdateBanner.tsx` (웹에서는 안 뜸) | `expo-updates` | Android 실기기 |

## 시연 (`https://flexable-web-delta.vercel.app/m`, 이 저장소 밖)

2026-10-19에 이 저장소에서 빼서 웹사이트 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)의 `mobile-demo/`로 옮겼다. 데이터는 전부 예시이고 서버를 부르지 않는다. 화면 목록은 그 저장소의 README를 본다.
계좌 연결·AI 분석 온보딩, 예정 지출·AI 초안, 고액 지출 계획, AI 메모리, 정산·1/N, 결제·아침 요약 푸시는 시연에만 있다.

## 미구현 (서비스에 없음)

문서나 시연에 나와도 실제 앱에는 없다. 스토어 문구·앱 화면에 쓰지 않는다.

- 계좌 연결(오픈뱅킹), AI 소비 분석·추천
- 결제 알림·문자 자동 기록, 서버 푸시 알림(기기 안에서 예약하는 시드머니 알림만 있음)
- 예정 지출·고액 지출 계획, 정산
- 비밀번호 찾기, 이메일 인증
- 오프라인 저장(SQLite·outbox) — 앱은 온라인 전용
- 수입일 공휴일 처리(토·일만 다음 월요일로 미룸)

## 호환 경로 결정 기록

외부에 공유된 링크·북마크는 저장소 검색으로 확인할 수 없어서, 지울 근거가 생길 때까지 남긴다.

| 경로 | 하는 일 | 결정 | 이유 |
|---|---|---|---|
| `frontend/vercel.json` redirect 11개 (`/demo`, `/demo/*`, 그리고 분리 전 `/home2`, `/plan`, `/budget-detail`, `/notifications`, `/memory`, `/schedule`, `/schedule/*`, `/tx/:id`, `/settle/:id`) | 옛 시연 주소 → `https://flexable-web-delta.vercel.app/m/...` (307 임시) | 유지 | 발표 자료 등에 예전 주소가 남아 있을 수 있음. 서비스가 같은 경로를 쓰게 되면 그 줄을 지운다. 새 웹사이트 주소가 바뀌면(10/30 도메인) 목적지도 바꾼다 |
