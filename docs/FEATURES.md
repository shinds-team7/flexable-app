# 현재 기능 기준표

기준 2026-10-24, `main` `83c7981`(앱 1.4.0). 화면만 있는 것과 서버·DB까지 연결된 것을 구분한다. 코드에 있는 것과 운영에 배포된 것은 다를 수 있다. 배포·실기기 확인 기록은 [`HANDOFF.md`](HANDOFF.md)가 기준이다.
기능을 추가하거나 바꾸면 이 표를 같이 고친다. README와 HANDOFF는 이 표를 기준으로 쓴다.

구분: **서비스** = 실제 앱(Android·웹) / **시연** = 예시 데이터 웹 화면(2026-10-19부터 웹사이트 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)의 `/m`) / **미구현** = 계획만 있음

## 서비스

| 기능 | 화면·경로 | API·저장 | 확인 방법 |
|---|---|---|---|
| 시작 분기 | `/` → `src/app/index.tsx` (로그인·예산 설정 여부로 `/home`·`/onboarding`·시작 화면) | `GET /me` | E2E `expired token returns to start…` |
| 회원가입·로그인·로그아웃 | `/auth/signup`, `/auth/login` → `service/AuthScreen.tsx` | `POST /auth/signup·login·logout`. 토큰은 앱 SecureStore, 웹 localStorage(`service/storage.ts`) | 백엔드 `ApiFlowTest`(가입 검증·로그인 제한·로그아웃 폐기), E2E `real service lifecycle…` |
| 카카오·Google 로그인 | 시작 화면 `src/app/index.tsx`(`service/OAuthButtons.tsx`) → 브라우저 → `/oauth/callback`(`service/OAuthCallbackScreen.tsx`, 흐름은 `service/oauth.ts`). 앱 1.1.0부터(`expo-web-browser` 네이티브 모듈), 웹은 바로 | `GET /auth/oauth/providers`, `GET /auth/oauth/{provider}/start·callback`, `POST /auth/oauth/exchange`(1회용 코드 + verifier). 키가 없는 공급자는 "쓸 수 없어요" 안내. 같은 검증 이메일의 기존 계정이 있으면 연결해 로그인(기존 세션은 끊음). 연결된 계정에 이메일 로그인하면 비밀번호가 맞아도 "Google로 가입한 계정이에요" 안내와 해당 소셜 버튼(`service/AuthScreen.tsx`, 동작은 `service/useSocialLogin.ts`). 소셜 계정 탈퇴는 '탈퇴' 입력 | 백엔드 `OAuthFlowTest`·`MemoryOAuthStoreTest`·`RestOAuthProviderClientTest`, E2E `social login …`(교환 응답은 mock)·`email login of a google-linked account …`(로그인 응답 mock). 운영 키 설정 완료(10-19), 새 웹사이트에서 운영 로그인 확인. Android 실기기 확인 10-23(사용자, HANDOFF 0-2) |
| 초기 예산 설정 8단계 | `/onboarding/*` → `service/OnboardingScreen.tsx` (index·balance·income·fixed·card·seed(모아둔 돈)·protect(매달 저축할 돈)·done) | 입력 중에는 기기에 임시 보관(`service/BudgetDraft.tsx`), 마지막에 `PUT /budget/settings` 한 번 | E2E `real service lifecycle…` |
| 오늘 쓸 수 있는 돈 | `/home` → `service/HomeScreen.tsx`. 위에서부터 (캐릭터 홈이면) 캐릭터 영상(우측 상단 보유 코인 칩)·승급 게이지 → 오늘 금액 카드(`components/TodayHeroView.tsx`, 0원 이하면 네이비 + "오늘 예산을 다 썼어요/넘었어요" 칩. 오른쪽에 다음 카드가 살짝 보이고, 왼쪽으로 밀면 같은 크기·같은 파란 테마의 시드머니 카드(`service/SeedMoneyCard.tsx`)가 나온다 — `components/SwipePager.tsx`) → 두 장의 요약 카드 [이번 주 쓸 수 있는 돈 · 남은 N일·이번 주 쓴 돈] \| [다음 수입일까지 · 남은 생활비] → 요일별 생활비 배분(`components/DayBudgets.tsx`, 하루 예산을 모든 요일에 똑같이 나눈 '기본 배분'만 있음) → 거래가 없으면 첫 기록 안내. 거래 기록 + 버튼은 홈이 아니라 하단 탭바의 내역·분석 사이에 있어 모든 탭에서 보인다(`service/ServiceHeader.tsx`). 다음 수입일 카드는 `remaining`이 음수면 네이비 카드에 0원으로 표시한다. 이번 주 카드도 음수면 네이비로 칠하게 돼 있지만 서버 `weekAvailable`이 0 이상이라 지금 응답으로는 나타나지 않는다. 이 배치(#123)는 머지됐고 원격 업데이트 게시 기록은 아직 없다(HANDOFF 0-홈리디자인) | `GET /budget/today`. 계산은 서버(`budget/BudgetCalculator.java`)가 최종값 | 백엔드 `BudgetCalculatorTest` |
| 캐릭터 홈 / 기본 홈 | `/home`, 마이에서 전환. 캐릭터 홈은 적용 중인 코스튬을 16:9 반복 영상으로 보여 준다(`service/OutfitView.tsx`, 파일 연결은 `service/outfits.ts`). 운영 V10(10-22 17:02 KST 배포): 광부 Lv.1(`costume-lv1`)·직장냥이 Lv.2(`outfit-02`)·잭팟 Lv.3(`outfit-01`), 최고 200점. 나머지는 꺼 둠. 기존 구매자는 보유 유지·구매 코인 반환(REFUND 안내). 홈 말풍선·퍼센트 숫자 제거 | 점수는 서버(`characterPoints`, `daily_budgets` 테이블 V4), 최고 단계(peak)는 코스튬 해금용. 홈 스타일 선택은 기기 저장(`service/homeStyle.ts`) | 백엔드 `CharacterScoreTest`, E2E `signup gift, buy and apply a costume…`(홈 영상이 칸에 맞는지). Android 실기기 영상 재생 확인 10-23(사용자, HANDOFF 0-코인) |
| 코인(앱에서만 쓰는 코인) | 상점 위쪽 잔액·[모으기] (`service/CustomizeScreen.tsx`), 캐릭터 홈 영상 우측 상단 보유 코인 칩(누르면 `/coins/history` 코인 내역 → `service/CoinHistoryScreen.tsx`: 보유 코인과 적립·사용 내역 최신순, 날짜별, "+200 가입 선물"처럼 금액이 앞, 30개씩 [더 보기]. 문구는 `service/coinLedger.ts`. 보유 코인 카드 오른쪽에 같은 높이의 가게 모양 상점 버튼(접근성 이름 "상점", 받을 코인이 있으면 빨간 점) → `/customize`), 홈 보상 모달(`service/RewardModal.tsx`). check-in은 **캐릭터 홈일 때만** 홈에 들어오거나 앱이 앞으로 돌아올 때 부른다(기본 홈에서는 부르지 않음) | `POST /coins/check-in`(가입 선물 200 1회, 어제 예산 지킴 +5, 시간 적립 시작), `POST /coins/rewards/ack`, `GET /coins`, `POST /coins/collect`(1시간 1개, 하루 10개, 자정 소멸), `GET /coins/ledger`(내역, `before`로 이전 쪽). `coin/`, V8 `coin_wallets`·`coin_ledger`(지급마다 유니크 키) | 백엔드 `CoinFlowTest`(내역 최신순·쪽 나누기·남의 내역 안 보임), 단위 `test/coin-ledger.test.cjs`(문구), E2E `signup gift…`(가입 선물, 코인 칩 → 내역), `collect takes the coins…`(적립은 시간이 필요해 응답 mock) |
| 상점(코스튬 구매·적용) | 캐릭터 홈 헤더 셔츠 버튼 → `/customize` → `service/CustomizeScreen.tsx`, 구매 완료 `service/PurchaseModal.tsx` | `GET /outfits`, `POST /outfits/{id}/purchase`(지갑 행 잠금, 200코인), `PUT /outfits/equipped`. 레벨 코스튬은 최고 단계로 열림(구매 불가). 코인 상품은 V11의 선비냥이(`outfit-03`)·유령냥이(`outfit-04`) 각 200코인만 판매 중이고 나머지는 꺼져 있음. 꺼진 상품도 이미 산 사람의 목록에는 나온다. 로컬·CI는 `app.outfits.show-inactive=true`로 꺼진 상품도 보이고 살 수 있다 | 백엔드 `CoinFlowTest`, E2E `signup gift, buy and apply a costume…` |
| 추천 코드 | 마이 → 내 추천 코드·공유·입력(등록하면 입력칸 숨김) | `GET /referrals/me`, `POST /referrals`(양쪽 100, 한 번만, 내 코드 불가). 코드 주인은 다음 check-in에서 모달. `referral/` | 백엔드 `CoinFlowTest`, E2E `signup gift… a referral pays both people` |
| 시드머니·수입일 전날 반영 | 홈 시드머니 카드와 반영 창 → `service/SeedMoneyCard.tsx`. 수입일 전날 20시 기기 알림 → `service/seedReminder.ts`(앱 1.3.0부터 `expo-notifications`, 웹은 알림 없이 홈에서 창만) | `GET /budget/seed-money`, `POST /budget/seed-money/entries`(매달 저축할 돈 / 남은 돈 전부 / 직접 입력, 주기당 1번). 모아둔 돈은 `PUT /budget/settings`의 `seedBase`. 옮긴 돈은 추정 잔액에서 빠짐(`budget/SeedMoneyService.java`, V7) | 백엔드 `SeedMoneyFlowTest`, E2E `onboarding saves the money already set aside…`(반영 대기 응답은 mock). Android 실기기 알림 확인 10-23(사용자, HANDOFF 0-1) |
| 웹사이트 연동 | 설정 → 웹사이트 연동: 처리 내용 안내 → 미리 체크되지 않은 "(선택) 웹사이트 연동 개인정보 수집·이용 동의" 체크 → [웹 연동 코드 받기](받은 뒤에는 [새 코드 받기]와 재발급 확인) → 코드 표시·만료 안내, 연동 목록·새로고침·해제 확인. 화면을 다시 열면 체크가 풀린다. 앱 1.4.0으로 배포됨, 개인정보처리방침 4장(10-28 시행). 코드는 6자리·하이픈 없음(#124, 머지됐지만 **운영 미배포** — HANDOFF 0-홈리디자인). 앱 실기기 확인 10-23, 웹 서버와의 실서버 전체 흐름은 확인 기록 없음 | `POST /me/web-link-codes`, `GET·DELETE /me/web-links`, 웹 서버 전용 `/internal/v1/web-links/*`(서비스 키, 회원 정보·시드머니) | `WebLinksScreen.tsx`, `e2e/web-links.spec.ts`(API 모의 응답으로 화면 검증); 백엔드 `WebLinkFlowTest`, `SeedMoneyFlowTest.webLinkReadsConfirmedSeedMoney` |
| 고정지출 자동 기록 | 화면 없음(내역에 거래로 나타남) | 날짜가 된 고정지출을 서버가 지출 거래로 기록(`budget/FixedExpensePoster.java`) | 백엔드 `ApiFlowTest.fixedExpenses…` |
| 거래 직접 입력·수정·삭제 | `/transactions`, `/transactions/new`, `/transactions/[id]` → `service/TransactionForm.tsx` | `GET·POST·PATCH·DELETE /transactions`, 재시도 시 같은 `Idempotency-Key` | E2E `real service lifecycle…`, 백엔드 `ApiFlowTest.fullFlow` |
| 내역 달력 | `/transactions` → `service/TransactionsScreen.tsx`, 월 지출·수입 배너 아래 `components/MonthCalendar.tsx`. 그달 거래를 날짜별로 더해 지출(-)·수입(+)을 칸에 표시(만 원 이상은 "3.2만"처럼 내림), 오늘은 블루 원. 아래 전체/지출/수입 필터와 상관없이 둘 다 보인다 | 서버 변경 없음. 화면이 이미 받는 `GET /transactions?from&to` 응답을 그대로 합산(예산 계산 아님) | 화면 확인(웹·Android) |
| 기록 알림 | 화면 없음. 기기 알림을 누르면 `/transactions/new`. 예약은 `service/entryReminder.ts`(시각 계산 `entryReminderTimes.ts`, 권한·채널 `localNotifications.ts`), 마이 '기록 알림'으로 끄기(기기별). 웹은 알림 없음 | 서버 변경 없음. 가장 최근 거래의 `createdAt`(고정지출 자동 기록 포함, 거래 날짜 앞뒤 30일 `GET /transactions`), 없으면 가입 시각부터 24시간마다 알림. 22시~9시에 걸리면 9시로 미루고, 앞으로 7번까지 기기에 예약한다. 앱을 열 때·돌아올 때·화면 데이터를 다시 읽을 때(거래 저장 등) 다시 예약하고, 끄거나 로그아웃하면 취소. 웹·다른 기기에서 한 기록은 이 기기에서 앱을 열어야 반영 | 단위 `test/entry-reminder.test.cjs`(시각 계산). 알림은 웹·E2E로 확인할 수 없어 실기기 확인 필요(#143) |
| 카테고리 관리 | `/categories` → `service/CategoriesScreen.tsx` | `GET·POST·PATCH·DELETE /categories` (삭제하면 거래는 같은 종류의 기본 '기타'/'기타 수입'으로, 그 이름을 바꿔 찾지 못하면 같은 종류의 첫 기본 카테고리로) | E2E `real service lifecycle…` |
| 소비 분석 | `/analysis` → `service/AnalysisScreen.tsx` | `GET /analysis/summary` | E2E `real service lifecycle…`(분석 탭 진입) |
| 예산 다시 설정 | 마이 → 예산 설정 수정 | `PUT /budget/settings` (잔액 기준 시각을 지금으로) | E2E `re-entering the balance…` |
| 계정 삭제 | 앱 `/account/delete`, 웹 공개 `/delete-account` → `service/DeleteAccountScreen.tsx` | `DELETE /me` (`user/AccountDeletionService.java`) | E2E `public deletion…` |
| 공개 페이지 | `/privacy`, `/terms`, `/support` | 원문은 `docs/play-store/privacy-policy.md`·`terms.md` | E2E `approved legal copy…`(웹 화면과 원문 일치 검사) |
| 접근 제어 | 로그인 후 모든 API | JWT 서명·사용자·토큰 버전 확인(`config/SecurityConfig.java`), 거래·카테고리는 소유자 조건으로 조회(남의 것은 404). CORS는 서버 `.env`의 허용 출처만 | 백엔드 `SecurityTest`(비로그인 401, 위조·서명 없는 토큰 401, 다른 사용자 데이터 차단, 허용 안 된 출처 403) |
| 원격 업데이트 적용 | 안내 없이 적용: 실행 때 스플래시 3초 안에 받으면 바로, 늦으면 다음에 앱을 새로 켤 때. 켜 둔 채 돌아오면 10분 간격으로 미리 받음 → `service/LaunchUpdate.ts` (10-22 "지금 적용" 배너 삭제, 웹 해당 없음) | `expo-updates` | Android 실기기 |

## 시연 (`https://flexable-web-delta.vercel.app/m`, 이 저장소 밖)

2026-10-19에 이 저장소에서 빼서 웹사이트 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)의 `mobile-demo/`로 옮겼다. 데이터는 전부 예시이고 서버를 부르지 않는다. 화면 목록은 그 저장소의 README를 본다.
계좌 연결·AI 분석 온보딩, 예정 지출·AI 초안, 고액 지출 계획, AI 메모리, 정산·1/N, 결제·아침 요약 푸시는 시연에만 있다.

## 미구현 (서비스에 없음)

문서나 시연에 나와도 실제 앱에는 없다. 스토어 문구·앱 화면에 쓰지 않는다.

- 계좌 연결(오픈뱅킹), AI 소비 분석·추천
- 결제 알림·문자 자동 기록, 서버 푸시 알림(기기 안에서 예약하는 시드머니·기록 알림만 있음)
- 예정 지출·고액 지출 계획, 정산
- 비밀번호 찾기, 이메일 인증
- 오프라인 저장(SQLite·outbox) — 앱은 온라인 전용

## 호환 경로 결정 기록

외부에 공유된 링크·북마크는 저장소 검색으로 확인할 수 없어서, 지울 근거가 생길 때까지 남긴다.

| 경로 | 하는 일 | 결정 | 이유 |
|---|---|---|---|
| `frontend/vercel.json` redirect 11개 (`/demo`, `/demo/*`, 그리고 분리 전 `/home2`, `/plan`, `/budget-detail`, `/notifications`, `/memory`, `/schedule`, `/schedule/*`, `/tx/:id`, `/settle/:id`) | 옛 시연 주소 → `https://flexable-web-delta.vercel.app/m/...` (307 임시) | 유지 | 발표 자료 등에 예전 주소가 남아 있을 수 있음. 서비스가 같은 경로를 쓰게 되면 그 줄을 지운다. 새 웹사이트 주소가 바뀌면(10/30 도메인) 목적지도 바꾼다 |
