# Flex-able 서비스 API v1 (MVP)

서비스 1.0.0 비공개 테스트(Google Play 12명)용 최소 API. 서버 코드는 `backend/`(Spring Boot 4.1, Java 21, MySQL 8).
이 문서가 프론트·백엔드 사이의 계약이다. 바꿀 때는 이 문서를 먼저 고친다.

웹사이트 API는 웹 서버(flexable-web `backend/`)에 있고 이 문서에 적지 않는다. 이 문서에는 웹 연동용 API만 적는다([웹사이트 연동](#웹사이트-연동)). 절차는 [앱·웹 서비스 경계](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/04-service-boundaries.md).

## 공통

- Base URL: `${EXPO_PUBLIC_API_URL}/api/v1` (예: `https://api.example.com/api/v1`, 로컬 `http://localhost:8080/api/v1`)
- 요청·응답은 JSON(UTF-8). 인증이 필요한 요청은 `Authorization: Bearer <accessToken>`.
- **금액은 원 단위 정수**(`long`). 소수·문자열 금액 금지. 거래 금액은 항상 양수이고 부호는 `type`으로 구분한다.
- 날짜 `YYYY-MM-DD`, 일시 ISO-8601 offset 포함(`2026-10-13T12:32:00+09:00`). 서버의 "오늘"은 `Asia/Seoul` 기준.
- 이번 MVP는 온라인 전용이다(SQLite·outbox 없음). 거래 생성만 `Idempotency-Key`로 중복 재전송을 막는다.

### 오류 형식

```json
{ "code": "INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호가 맞지 않아요" }
```

| HTTP | code | 의미 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 입력 형식 오류. `fields: { "email": "이메일 형식을 확인해 주세요" }` 추가 |
| 401 | `UNAUTHORIZED` | 토큰 없음·만료·탈퇴 계정 → 로그인 화면으로 |
| 401 | `INVALID_CREDENTIALS` | 로그인·탈퇴 시 이메일/비밀번호 불일치 |
| 401 | `SOCIAL_ACCOUNT` | 카카오·Google이 붙은 계정에 이메일 로그인 시도. 본문에 `provider`(`kakao`·`google`) |
| 401 | `OAUTH_CODE_INVALID` | 일회용 코드 없음·만료·재사용·verifier 불일치. "로그인 시간이 지났어요. 다시 시도해 주세요" |
| 404 | `NOT_FOUND` | 리소스 없음(남의 리소스도 404) |
| 404 | `BUDGET_NOT_SET` | 초기 예산 미설정 |
| 409 | `EMAIL_UNAVAILABLE` | 가입 불가 이메일(이미 가입 등) |
| 409 | `CATEGORY_DUPLICATE` | 같은 종류에 같은 이름 카테고리 존재 |
| 409 | `CATEGORY_DEFAULT` | 기본 카테고리는 삭제 불가 |
| 409 | `SEED_NOT_PENDING` | 시드머니 반영: 이미 반영했거나 그 주기를 반영할 수 있는 기간이 지남 |
| 409 | `OUTFIT_NOT_FOR_SALE` | 코스튬 구매: 레벨 코스튬이거나 판매하지 않는 상품 |
| 409 | `OUTFIT_OWNED` | 코스튬 구매: 이미 가진 상품 |
| 409 | `OUTFIT_LOCKED` | 코스튬 적용: 사지 않았거나 레벨이 안 된 코스튬 |
| 409 | `COINS_NOT_ENOUGH` | 코스튬 구매: 코인 부족 |
| 400 | `REFERRAL_CODE_INVALID` | 추천 코드 없음·내 코드 |
| 409 | `REFERRAL_ALREADY` | 추천 코드를 이미 등록함 |
| 400 | `LINK_CODE_INVALID` | 웹 연동 코드 없음·만료·이미 사용(웹 서버 전용 API) |
| 404 | `LINK_NOT_FOUND` | 웹 연동이 해제됐거나 앱 계정이 탈퇴함(웹 서버 전용 API) |
| 429 | `TOO_MANY_ATTEMPTS` | 로그인 연속 실패(10분 내 5회)·실패 기록 저장 상한, 웹 연동 코드 실패(서비스 전체 10분 내 30회). `retryAfterSeconds` 추가 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

화면 문구는 `message`를 그대로 써도 되도록 한국어 존댓말로 내려준다. 분기는 반드시 `code`로 한다.

## 인증

### `POST /auth/signup` (공개)

```json
{ "email": "a@b.com", "password": "abcd1234", "agreeTerms": true, "agreePrivacy": true }
```

- 비밀번호 8~64자, 영문·숫자 각 1자 이상. 두 동의 값은 `true`여야 한다.
- 201 → `AuthResponse`. 가입 시 기본 카테고리가 자동 생성된다.
- 소셜 계정 이메일과 중복되어도 409 `EMAIL_UNAVAILABLE`.

### `POST /auth/login` (공개)

```json
{ "email": "a@b.com", "password": "abcd1234" }
```

200 → `AuthResponse`

이메일 로그인 실패 기록은 단일 API 서버 메모리에 예약을 포함해 이메일 최대 10,000개, 이메일당 실패 최대 5개를 보관한다. 비밀번호 확인 전에 기록 공간을 예약하며, 실패가 없는 예약은 10분 뒤 만료된다. 로그인 시도·실패 기록 시 10분 주기로 만료 항목을 정리하며, 상한에 도달하면 다음 만료 시점에도 정리한다. 정리 후에도 가득 차면 기록이 없는 이메일은 **비밀번호 확인 전** 429 `TOO_MANY_ATTEMPTS`로 일시 차단한다. `retryAfterSeconds`는 가장 이른 기록·예약 만료까지의 시간(최소 1초)이다. 기존 이메일의 실패 제한은 유지하고, 이미 기록이 있는 차단되지 않은 이메일은 정상 로그인 시 기록을 지운다. 서버 재시작 시 기록은 초기화된다.

카카오·Google identity가 하나라도 붙은 계정은 비밀번호가 맞든 틀리든 401 `SOCIAL_ACCOUNT`를 받는다. 이메일 가입 후 소셜 로그인으로 연결된 계정도 같다(비밀번호는 남아 있지만 쓰지 않음). 로그인 시도 제한에는 실패로 센다.

```json
{ "code": "SOCIAL_ACCOUNT", "message": "Google로 가입한 계정이에요. Google로 로그인해 주세요", "provider": "google" }
```

`provider`는 가장 먼저 붙은 identity다. 앱은 이 안내와 함께 해당 소셜 로그인 버튼을 보여 준다.

```json
{
  "accessToken": "eyJ...",
  "expiresAt": "2026-11-12T10:00:00+09:00",
  "user": { "id": 1, "email": "a@b.com", "onboarded": false, "createdAt": "2026-10-13T10:00:00+09:00", "provider": "email", "hasPassword": true }
}
```

- 토큰 유효기간 30일, refresh token 없음. 만료·401이면 로그인 화면으로 보낸다.
- 앱은 `expo-secure-store`, 웹은 `localStorage`에 저장한다.
- `onboarded=false`면 초기 예산 설정(`/onboarding`)으로, `true`면 홈으로 보낸다.

### 소셜 로그인 (카카오·Google, 공개)

클라이언트는 무작위 32바이트 base64url `codeVerifier`를 보관하고 `codeChallenge = base64url(SHA-256(codeVerifier))`(패딩 없음)를 생성한다. 브라우저 start 이동 → callback 코드 수신 → exchange 순서다. JWT는 리다이렉트 URL에 넣지 않는다.

#### `GET /auth/oauth/providers` → 200

`{ "providers": ["kakao", "google"] }` — client id가 설정된 공급자만 포함한다. 모두 미설정이면 빈 배열이다.

#### `GET /auth/oauth/{provider}/start?redirectUri=&codeChallenge=` → 302

- provider: `kakao` 또는 `google`. 그 외는 404 JSON `NOT_FOUND`.
- `redirectUri`는 `app.oauth.allowed-redirect-uris`와 **정확히 일치**해야 한다. 누락·불일치는 400 JSON `VALIDATION_FAILED`(field `redirectUri`), 리다이렉트 없음.
- `codeChallenge`: 정규식 `^[A-Za-z0-9_-]{43}$`. 누락·형식 오류는 `{redirectUri}?error=failed`.
- client id 미설정은 `{redirectUri}?error=provider_unavailable`.
- 정상 요청은 무작위 32바이트 base64url state(provider·redirectUri·codeChallenge 포함, 10분)를 저장하고 authorize URL로 이동한다.
- 카카오: `https://kauth.kakao.com/oauth/authorize`, 파라미터 `client_id, redirect_uri, response_type=code, state`. scope 기본 없음, `KAKAO_SCOPE` 설정 시에만 추가.
- Google: `https://accounts.google.com/o/oauth2/v2/auth`, 위 파라미터와 `scope=openid%20email`, `prompt=select_account`.
- 공급자에 넘기는 `redirect_uri`: `{OAUTH_CALLBACK_BASE_URL}/api/v1/auth/oauth/{provider}/callback`.

#### `GET /auth/oauth/{provider}/callback?code=&state=&error=` → 302

- state는 조회 즉시 삭제한다. 없음·만료·재사용·provider 불일치는 **400 HTML 한 줄**: "로그인 요청이 만료됐어요. 처음 화면으로 돌아가 다시 시도해 주세요." (리다이렉트 없음).
- 공급자 `error=access_denied`만 `{redirectUri}?error=cancelled`. 그 밖의 공급자 오류는 `error=failed`로 이동하고 provider·오류 코드(최대 64자)를 warn 로그에 남긴다. 토큰 교환·프로필 조회 실패·타임아웃도 `error=failed`. 외부 HTTP 오류는 상태 코드만 추가로 기록하며 응답 본문·토큰·이메일은 기록하지 않는다. 외부 연결 3초·읽기 5초 제한.
- 기존 `(provider, providerUserId)` identity가 있으면 해당 사용자로 로그인한다.
- 신규 identity의 **검증된 이메일**이 기존 users.email과 같으면 그 계정에 identity를 붙이고 로그인한다. 비밀번호는 지우지 않지만, 이후 이메일 로그인은 `SOCIAL_ACCOUNT`로 돌려보낸다. 이메일 가입은 메일 인증을 하지 않으므로(남의 주소로 선가입 가능), 기존 계정에 비밀번호가 있으면 `token_version`을 올려 기존 세션도 끊는다.
- 그 계정에 같은 공급자의 다른 identity가 이미 있으면 연결하지 않고 `error=email_in_use`.
- 카카오 검증: `is_email_valid && is_email_verified`, Google 검증: `email_verified`.
- 신규 사용자: email은 검증 이메일 또는 NULL, password_hash는 NULL, agreed_at은 현재 시각. 기본 카테고리와 identity도 생성한다. 미검증 이메일은 저장하지 않는다.
- 성공하면 무작위 32바이트 base64url loginCode(userId·codeChallenge 포함, 2분 유효)를 발급하고 `{redirectUri}?code={loginCode}`로 이동한다.
- redirectUri에 쿼리가 있으면 `&`로 추가하며 값은 URL 인코딩한다.

#### `POST /auth/oauth/exchange` → 200 `AuthResponse`

```json
{ "code": "callback의 일회용 코드", "codeVerifier": "클라이언트가 보관한 verifier" }
```

코드는 조회 즉시 삭제한다. 없음·만료·재사용 또는 verifier의 SHA-256 base64url 값 불일치는 모두 401 `OAUTH_CODE_INVALID`. 잘못된 verifier 시도 후에도 코드를 재사용할 수 없다. 성공 응답은 이메일 로그인과 같다.

state와 loginCode는 주입 Clock 기준 메모리 저장소에 보관하고 만료 항목을 정리한다. 각각 최대 10,000개이며, 정리 후에도 상한이면 새 항목을 발급하지 않고 start·callback은 `error=failed`로 이동한다. 상한 로그에는 개수만 기록한다. 서버 재시작 시 진행 중 로그인은 다시 시작해야 한다. 여러 인스턴스 운영 전 공유 저장소로 교체한다.

설정 환경변수: `OAUTH_CALLBACK_BASE_URL`, `OAUTH_ALLOWED_REDIRECT_URIS`(쉼표 구분), `KAKAO_CLIENT_ID`(REST API 키), `KAKAO_CLIENT_SECRET`(선택), `KAKAO_ADMIN_KEY`(탈퇴 연결 끊기용, 선택), `KAKAO_SCOPE`(선택), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. 키 값은 서버 환경변수에만 넣는다.
로컬 기본값: callback base `http://localhost:8080`, redirect 허용 목록 `flexable://oauth/callback,http://localhost:8081/oauth/callback`.
운영 설정: callback base `https://flex-able-sh.duckdns.org`, redirect 허용 목록 `flexable://oauth/callback,https://project2-flex-sh.vercel.app/oauth/callback,http://localhost:8081/oauth/callback`.

### `POST /auth/logout` → 204

서버가 이 사용자의 기존 토큰을 모두 무효화한다(모든 기기 로그아웃). 클라이언트는 응답과 무관하게 토큰을 지운다.

### `GET /me` → 200 `User`

`User`는 `id, email, onboarded, createdAt, provider, hasPassword`를 반환한다. `email`은 null 가능. `provider`는 identity가 있으면 첫 identity의 `kakao` 또는 `google`, 없으면 `email`이다. `hasPassword`는 비밀번호로 로그인할 수 있는지(`provider=email`이고 비밀번호가 있음)다. `AuthResponse.user`도 같은 형식이다.

### `DELETE /me` → 204 (계정·데이터 삭제)

```json
{ "password": "abcd1234" }
```

- 요청 body: `{ "password"?: string, "confirm"?: string }`.
- `hasPassword=true`: password 필수(누락 시 400, field `password`), 틀리면 401 `INVALID_CREDENTIALS`.
- 사용자 행을 잠근 뒤 토큰의 `tv`를 다시 비교한다. 인증 후 연결·로그아웃으로 폐기된 토큰이면 401 `UNAUTHORIZED`.
- `hasPassword=false`: `{ "confirm": "탈퇴" }` 필수. 누락·불일치는 400 `VALIDATION_FAILED`, field `confirm`, "확인 문구 '탈퇴'를 입력해 주세요".
- 카카오 identity와 `KAKAO_ADMIN_KEY`가 있으면 삭제 전 카카오 연결 끊기를 시도한다. 실패해도 탈퇴는 진행하고 로그만 남긴다.
- 성공하면 사용자·소셜 identity·예산 설정·카테고리·거래를 **즉시 영구 삭제**하고 이후 기존 토큰은 401을 받는다.
- 이메일 계정은 이메일 로그인, 소셜 계정은 소셜 로그인으로 인증한 뒤 `DELETE /me`를 호출한다.

## 초기 예산 설정

### `GET /budget/settings` → 200 `BudgetSettings` | 404 `BUDGET_NOT_SET`

### `PUT /budget/settings` → 200 `BudgetSettings` (전체 교체, 성공 시 `user.onboarded=true`)

```json
{
  "balance": 1250000,
  "balanceAt": "2026-10-13T10:12:00+09:00",
  "payday": 25,
  "incomeAmount": 2400000,
  "cardUnpaid": 0,
  "fixedExpenses": [{ "name": "월세", "amount": 450000, "day": 1 }],
  "protectedItems": [{ "name": "적금", "amount": 300000 }],
  "seedBase": 500000
}
```

| 필드 | 규칙 |
|---|---|
| `balance` | 0 이상 1조 미만. `balanceAt` 시점의 통장 잔액 |
| `balanceAt` | 생략 시 서버 현재 시각. 이 시각 **이후** 거래만 잔액에 더하고 뺀다 |
| `payday` | 1~31. 31은 "매달 말일"(달마다 말일로 맞춤). 그날이 토·일이면 다음 월요일에 들어온 것으로 계산(공휴일은 반영 안 함) |
| `incomeAmount`, `cardUnpaid` | 0 이상 |
| `fixedExpenses[]` | 0~30개. `day` 1~31(31=말일), `amount` 1 이상 |
| `protectedItems[]` | **매달 저축할 돈**(화면 이름. 예전 이름 '보호 금액'). 0~30개, `amount` 1 이상. 합계를 오늘 쓸 수 있는 돈에서 미리 빼고, 수입일 전날 시드머니 반영의 기준 금액이 된다 |
| `seedBase` | 모아둔 돈(시드머니 시작 금액, 생활비 잔액과 별도). 0 이상 1조 미만. **생략하면 저장된 값을 유지**(1.3.0 이전 앱 호환) |

응답은 같은 모양에 `fixedExpenses[].id`, `protectedItems[].id`, `updatedAt`이 붙고 `seedBase`는 항상 온다(설정 전 기본 0).
잔액만 다시 맞출 때도 PUT으로 전체를 보낸다(`balanceAt`을 지금으로).

### `GET /budget/today` → 200 | 404 `BUDGET_NOT_SET`

```json
{
  "date": "2026-10-13",
  "nextPayday": "2026-10-26",
  "daysLeft": 13,
  "estimatedBalance": 1180000,
  "reservedFixed": 450000,
  "cardUnpaid": 0,
  "protectedTotal": 300000,
  "remaining": 430000,
  "todaySpent": 12000,
  "dailyBudget": 34000,
  "todayAvailable": 22000,
  "shortage": 0,
  "weekSpent": 54000,
  "weekDaysLeft": 6,
  "weekAvailable": 192000,
  "cycleStart": "2026-09-25",
  "hasTransactions": true,
  "characterPoints": 130,
  "characterDelta": 15
}
```

계산(서버가 최종값, 원 단위 정수, 나눗셈은 내림):

- `estimatedBalance` = `balance` + (`balanceAt` 이후 수입 합) − (`balanceAt` 이후 지출 합) − (`balanceAt` 이후 시드머니로 옮긴 돈 합, 아래 "시드머니")
- `nextPayday` = 오늘 이후(오늘 제외) 가장 가까운 수입일(토·일이면 다음 월요일. 예: 25일이 일요일이면 26일), `daysLeft` = 오늘부터 수입일 전날까지 날짜 수(오늘 포함, 최소 1)
- `reservedFixed` = 내일 ~ 수입일 전날 사이에 날짜가 오는 고정지출 합. 오늘까지 날짜가 된 고정지출은 지출 거래로 자동 기록되어 `estimatedBalance`에서 빠진다(아래 "고정지출 자동 기록")
- `remaining` = `estimatedBalance` − `reservedFixed` − `cardUnpaid` − `protectedTotal`
- `dailyBudget` = max(0, `remaining` + `todaySpent`) ÷ `daysLeft`
- `todayAvailable` = `dailyBudget` − `todaySpent`(오늘 예산을 넘으면 넘은 만큼 음수. 1.3.0 앱 홈은 마이너스로, 그 전 앱은 0원으로 보여 준다), `shortage` = `remaining` < 0이면 −`remaining`, 아니면 max(0, `todaySpent` − `dailyBudget`)
- `todaySpent`, `weekSpent` = 오늘 / 이번 주(월~일) 지출 합. 고정지출 자동 기록(`fromFixed`)은 넣지 않는다. `cycleStart` = 직전 수입일
- `weekDaysLeft` = 오늘부터 이번 주 일요일과 수입일 전날 중 빠른 날까지 날짜 수(오늘 포함, 최소 1)
- `weekAvailable` = max(0, `dailyBudget` × `weekDaysLeft` − `todaySpent`) — 오늘 포함 이번 주 남은 날에 쓸 수 있는 돈
- `hasTransactions` = 지금까지 거래를 한 건이라도 기록했는지(기간 무관). 홈 빈 상태 판단용
- 캐릭터 단계 점수(`characterPoints`, 0~400, 100점이 한 단계: 0~99 Lv.1 … 400 Lv.5):
  - 이 요청마다 오늘의 `dailyBudget`을 날짜별로 저장한다(`daily_budgets`, 같은 날은 덮어씀 → 그날 마지막 값).
  - 처음 저장한 날 0점(Lv.1 0%)에서 시작해 그날부터 **어제까지** 하루씩 반영한다. 그날 지출 합(고정지출 자동 기록 제외)이 그날 하루 예산 이하면 +15, 넘으면 −50(0~400으로 자름). 저장이 없는 날(앱을 안 연 날)은 그 전 마지막 하루 예산으로 판단한다. 오늘은 내일 반영한다.
  - `characterDelta` = 어제 하루의 점수 변화(반영한 날이 없으면 0)

화면 문구는 "입력한 잔액·기록 기준 추정"으로 설명한다(실제 은행 잔액과 다를 수 있음).

## 시드머니

시드머니 = 모아둔 돈(`seedBase`) + 정산 주기마다 옮긴 돈의 합. 수입일 전날 앱이 기기 알림(20시, 서버 없음)으로 반영을 권하고, 홈에서 반영 창을 띄운다.

- **반영할 주기(`pending`)**: 오늘이 수입일 전날이면 오늘 끝나는 주기, 아니면 직전 수입일 전날에 끝난 주기. 그 주기 마지막 날 **전에** 앱을 쓰기 시작했고(`daily_budgets` 첫 날짜) 아직 반영하지 않았을 때만 있다. 응답하지 않으면 다음 수입일 전날까지 기다리고, 그날이 되면 지난 주기는 반영 없이 넘어간다. 수입일은 `/budget/today`와 같은 규칙(31=말일, 토·일이면 다음 월요일)
- **반영 방법**: `GOAL` = 매달 저축할 돈(`protectedItems` 합), `ALL` = 그 주기 마지막 날까지의 기록 기준 남은 돈 전부 = max(0, 그날 추정 잔액 − 카드 미결제액). 수입일 전날에는 남은 고정지출 예정액이 0이므로 '매달 저축할 돈 + 남은 생활비'와 같다. `MANUAL` = 직접 입력(0원 가능)
- 옮긴 돈은 생활비 통장에서 빠진 것으로 보고 `estimatedBalance`에서 뺀다(잔액을 다시 입력하면 그 시각 이후 것만 뺀다). 소비 분석·오늘 쓴 돈에는 넣지 않는다

### `GET /budget/seed-money` → 200 | 404 `BUDGET_NOT_SET`

```json
{
  "base": 500000,
  "saved": 950000,
  "total": 1450000,
  "monthlyGoal": 300000,
  "pending": { "cycleEnd": "2026-11-25", "payday": "2026-11-26", "goalAmount": 300000, "allAmount": 820000 },
  "entries": [{ "cycleEnd": "2026-10-25", "choice": "ALL", "amount": 950000, "createdAt": "2026-10-28T12:00:00+09:00" }]
}
```

- `pending`은 없으면 null. `entries`는 최근 12개, 최신순

### `POST /budget/seed-money/entries` → 201 (응답은 GET과 같음)

```json
{ "cycleEnd": "2026-11-25", "choice": "MANUAL", "amount": 200000 }
```

- `cycleEnd`는 지금 `pending.cycleEnd`와 같아야 한다. 다르거나 이미 반영했으면 409 `SEED_NOT_PENDING`
- `GOAL`·`ALL`의 금액은 서버가 정한다(보낸 `amount`는 무시). `MANUAL`은 `amount` 필수(0 이상, 없으면 400 field `amount`)
- 주기당 한 번만 반영된다(설정 행 잠금 + `(user_id, cycle_end)` 고유 키)

## 카테고리

`Category`

```json
{ "id": 3, "name": "식비", "type": "EXPENSE", "color": "#12B76A", "icon": "restaurant", "isDefault": true }
```

- `type`: `EXPENSE` | `INCOME`. `icon`은 Ionicons 이름, `color`는 `#RRGGBB`.
- 가입 시 기본 생성(`isDefault=true`):
  - 지출: 식비 `#12B76A restaurant`, 카페·간식 `#F79009 cafe`, 쇼핑 `#7A5AF8 bag-handle`, 교통 `#2E90FA bus`, 문화·여가 `#EE46BC film`, 생활·마트 `#15B79E cart`, 고정지출 `#667085 repeat`, 기타 `#98A2B3 ellipsis-horizontal`
  - 수입: 급여 `#2E90FA cash`, 용돈 `#12B76A gift`, 기타 수입 `#98A2B3 add-circle`

| 요청 | 설명 |
|---|---|
| `GET /categories?type=EXPENSE` | 목록(`type` 생략 시 전체). 기본 → 사용자 생성 순, 생성 순 |
| `POST /categories` `{ "name", "type", "color"?, "icon"? }` | 201. 이름 1~20자. 색·아이콘 생략 시 `#98A2B3`/`pricetag` |
| `PATCH /categories/{id}` `{ "name"?, "color"?, "icon"? }` | 200. `type`은 변경 불가. 기본 카테고리도 이름·색 변경 가능 |
| `DELETE /categories/{id}` | 204. 기본은 409 `CATEGORY_DEFAULT`. 쓰던 거래는 같은 종류의 "기타"/"기타 수입"으로 옮겨진다 |

## 거래(수동 입력)

`Transaction`

```json
{
  "id": 10,
  "type": "EXPENSE",
  "amount": 8500,
  "categoryId": 3,
  "category": { "id": 3, "name": "식비", "color": "#12B76A", "icon": "restaurant" },
  "title": "김밥천국",
  "memo": null,
  "occurredAt": "2026-10-13T12:32:00+09:00",
  "createdAt": "2026-10-13T12:33:10+09:00",
  "fromFixed": false
}
```

고정지출 자동 기록: `GET /budget/today`, `GET /transactions`, `GET /analysis/summary`를 부르면 먼저 잔액 기준일(`balanceAt`의 날짜) ~ 오늘 사이에 날짜가 된 고정지출을 지출 거래로 만든다.

- 카테고리 기본 "고정지출"(이름을 바꿨으면 아이콘 `repeat`인 기본, 없으면 "기타"), `title` = 고정지출 이름, `memo` = "고정지출 자동 기록", `fromFixed` = true, `occurredAt` = 그 날짜 0시(잔액 기준일 당일이면 기준 시각 직후)
- 날짜·항목(일자·이름·순번)마다 한 번만 만든다. 사용자가 거래를 지우거나 설정을 다시 저장해도 같은 날짜는 다시 만들지 않는다
- 같은 날 같은 이름·금액의 지출을 이미 직접 기록했으면 만들지 않는다(직접 기록 한 건이 고정지출 한 건을 대신한다)
- 이 기능 도입 전에 예산을 설정한 사용자는 도입 시점 이후 날짜부터 기록한다(지난 날짜를 소급해 빼지 않는다)
- 일반 거래처럼 수정·삭제할 수 있다. 다른 카테고리로 옮기면 `fromFixed`가 false가 되어 일반 지출로 센다

| 요청 | 설명 |
|---|---|
| `GET /transactions?from=2026-10-01&to=2026-10-31&type=&categoryId=` | `{ "items": Transaction[] }`, `occurredAt` 내림차순. `from`/`to` 필수(포함), 최대 366일 |
| `POST /transactions` | 201. 헤더 `Idempotency-Key: <uuid>` 권장 — 같은 키 재전송 시 처음 만든 거래를 200으로 돌려준다 |
| `GET /transactions/{id}` | 200 |
| `PATCH /transactions/{id}` | 200. 보낸 필드만 수정 |
| `DELETE /transactions/{id}` | 204 |

POST 본문:

```json
{ "type": "EXPENSE", "amount": 8500, "categoryId": 3, "title": "김밥천국", "memo": "점심", "occurredAt": "2026-10-13T12:32:00+09:00" }
```

- `amount` 1 이상 1조 미만, `title` 1~40자, `memo` 0~200자, `occurredAt` 생략 시 지금.
- `categoryId`는 본인 카테고리이고 `type`이 같아야 한다(아니면 400 `VALIDATION_FAILED`).

## 소비 분석

### `GET /analysis/summary?from=2026-10-01&to=2026-10-31`

```json
{
  "from": "2026-10-01",
  "to": "2026-10-31",
  "expenseTotal": 412000,
  "incomeTotal": 2400000,
  "expenseCount": 31,
  "byCategory": [
    { "categoryId": 3, "name": "식비", "color": "#12B76A", "icon": "restaurant", "amount": 180000, "count": 14, "ratio": 0.437 }
  ],
  "daily": [{ "date": "2026-10-01", "expense": 12000, "income": 0 }]
}
```

- `byCategory`는 **지출만**, 금액 내림차순. `ratio`는 지출 합 대비(소수 3자리).
- `daily`는 `from`~`to` 모든 날짜를 0 포함해 채운다. 최대 366일.
- 이번 주/이번 정산 주기 탭은 클라이언트가 기간을 계산해 호출한다(정산 주기 시작은 `/budget/today.cycleStart`).

## 코인·코스튬

앱 안에서만 쓰는 코인(현금 가치 없음)과 캐릭터 코스튬. 잔액·지급·해금은 모두 서버가 정한다. 지급 규칙과 작업 범위는 [`coin-plan.md`](coin-plan.md). 코인은 정수.

`CoinWallet`:

```json
{
  "balance": 215,
  "passive": { "collectable": 3, "collectedToday": 4, "dailyLimit": 10, "nextAt": "2026-10-21T15:12:00+09:00" },
  "equippedOutfitId": "outfit-03"
}
```

- `passive.collectable` = 지금 [모으기]로 받을 수 있는 개수. `nextAt` = 다음 1개가 쌓이는 시각(오늘 10개가 다 쌓였거나 오늘 check-in 전이면 `null`)
- `equippedOutfitId` = 적용 중인 코스튬. `null`이면 기본 캐릭터(`costume-lv1`)

### `POST /coins/check-in` → 200

앱을 열 때·앞으로 돌아올 때 부른다(여러 번 불러도 안전). 서버는 이 요청에서 ① 가입 선물 200(1회) ② 어제 예산을 지켰으면 +5(어제 하루치만) ③ 오늘 첫 요청이면 시간 적립 시작을 처리한다.

```json
{
  "wallet": { "...": "CoinWallet" },
  "rewards": [
    { "id": 31, "reason": "SIGNUP_GIFT", "amount": 200, "refDate": null, "createdAt": "2026-10-21T09:03:00+09:00" },
    { "id": 32, "reason": "BUDGET_BONUS", "amount": 5, "refDate": "2026-10-20", "createdAt": "2026-10-21T09:03:00+09:00" },
    { "id": 33, "reason": "REFERRAL_INVITER", "amount": 100, "refDate": null, "createdAt": "2026-10-21T08:40:00+09:00" }
  ]
}
```

- `rewards` = 아직 모달로 보여 주지 않은 보상(`notified_at`이 없는 내역), 오래된 순. 앱은 이 순서대로 모달을 띄우고 닫을 때 ack한다. ack 전에 다시 check-in하면 같은 보상이 또 온다(지급은 한 번).
- `reason`: `SIGNUP_GIFT`(가입 선물) · `BUDGET_BONUS`(`refDate`의 예산을 지킴) · `REFERRAL_INVITER`(내 코드로 친구가 등록)
- 초기 예산을 설정하기 전이면 ②는 건너뛴다(오류 아님).

### `POST /coins/rewards/ack` → 204

```json
{ "ids": [31, 32] }
```

내 내역이 아닌 id는 무시한다.

### `GET /coins` → 200 `CoinWallet`

### `POST /coins/collect` → 200

```json
{ "collected": 3, "wallet": { "...": "CoinWallet" } }
```

받을 게 없으면 `collected: 0`(오류 아님).

### `GET /outfits` → 200 `OutfitList`

```json
{
  "balance": 215,
  "equippedOutfitId": null,
  "peakLevel": 2,
  "items": [
    { "id": "costume-lv1", "name": "광부", "price": null, "unlockLevel": 1, "owned": true, "equipped": true },
    { "id": "costume-lv3", "name": "Lv.3 코스튬", "price": null, "unlockLevel": 3, "owned": false, "equipped": false },
    { "id": "outfit-01", "name": "잭팟", "price": 200, "unlockLevel": null, "owned": false, "equipped": false }
  ]
}
```

- `items`는 `sort_order` 순. 레벨 코스튬이 먼저, 상점 상품이 뒤. `active=false` 상품은 빠진다(로컬·CI는 `app.outfits.show-inactive=true`로 모두 보인다).
- 레벨 코스튬의 `owned` = `peakLevel` ≥ `unlockLevel`. `peakLevel` = 지금까지 도달한 최고 캐릭터 단계(1~5, `/budget/today`와 같은 점수 규칙). 레벨이 내려가도 한 번 열린 코스튬은 그대로다. 초기 예산 설정 전이면 1.
- 상점 상품의 `owned` = 샀는지. `equipped`는 한 개만 `true`(`equippedOutfitId`가 `null`이면 `costume-lv1`).

### `POST /outfits/{id}/purchase` → 200 `OutfitList`

잔액에서 `price`를 빼고 상품을 준다. 409: `OUTFIT_NOT_FOR_SALE`(레벨 코스튬·비활성·없는 상품), `OUTFIT_OWNED`, `COINS_NOT_ENOUGH`. 산다고 바로 적용되지는 않는다.

### `PUT /outfits/equipped` → 200 `OutfitList`

```json
{ "outfitId": "outfit-01" }
```

`null`이면 기본 캐릭터. 가지지 않은 코스튬은 409 `OUTFIT_LOCKED`.

### `GET /referrals/me` → 200

```json
{ "code": "K7PQ2MXA", "invitedCount": 2, "registered": false, "rewardAmount": 100 }
```

- `code`는 처음 부를 때 만든다(영문 대문자·숫자 8자, 헷갈리는 `0 O 1 I L` 제외). `registered` = 내가 다른 사람 코드를 등록했는지.

### `POST /referrals` → 200

```json
{ "code": "K7PQ2MXA" }
```

→ `{ "amount": 100, "wallet": { "...": "CoinWallet" } }`

- 등록한 사람(`REFERRAL_INVITEE`, 바로 표시하므로 ack 불필요)과 코드 주인(`REFERRAL_INVITER`, 다음 check-in에서 모달)에게 각각 100.
- 대소문자·앞뒤 공백 무시. 기간·인원 제한 없음. 400 `REFERRAL_CODE_INVALID`(없는 코드·내 코드), 409 `REFERRAL_ALREADY`(이미 등록함).

## 웹사이트 연동

웹사이트(flexable-web)는 계정·서버·DB가 따로다. 사용자가 앱에서 받은 코드를 웹에 입력하면 웹 서버가 이 서버에서 연동을 만들고, 이후 `linkId`로 앱 회원 정보를 읽는다. 앱 로그아웃은 연동에 영향이 없고, 앱 탈퇴하면 연동도 함께 지워진다. 거래 목록 같은 원본 기록은 넘기지 않는다.

### 앱 사용자 API (사용자 토큰)

- `POST /me/web-link-codes` → 201 `{ "code": "K7M2Q9XB", "expiresAt": "2026-10-20T16:40:00+09:00" }`. 8자리(영문 대문자·숫자, 헷갈리는 0·1·I·L·O 제외), **10분 유효, 한 번만 사용**. 새로 받으면 이전 코드는 무효. 서버는 해시만 저장한다. 화면에는 `K7M2-Q9XB`처럼 끊어 보여 줘도 된다
- `GET /me/web-links` → 200 `[{ "id": 3, "createdAt": "..." }]` 최신순
- `DELETE /me/web-links/{id}` → 204. 남의 것·없는 것은 404 `NOT_FOUND`

### 웹 서버 전용 API (`/internal/v1`, 서비스 키)

- 경로가 `/api/v1`이 아니라 `/internal/v1`이다. 헤더 `X-Service-Key`로 인증하고 사용자 토큰으로는 열리지 않는다. 키가 없거나 틀리면 401 `UNAUTHORIZED`. CORS를 열지 않는다(서버끼리만 호출)
- 키는 서버 환경변수 `WEB_LINK_SERVICE_KEYS`(쉼표 구분, 32자 이상만 사용). 교체할 때는 새 키를 더해 두 개로 두고, 웹 서버를 새 키로 바꾼 뒤 옛 키를 뺀다. 비어 있으면 이 API는 모두 401
- `POST /internal/v1/web-links` `{ "code": "k7m2-q9xb" }` → 201 `{ "linkId": "<43자 임의 값>", "profile": AppProfile }`. 대소문자·공백·하이픈은 무시한다. 코드 없음·만료·재사용은 400 `LINK_CODE_INVALID`. 실패가 서비스 전체로 10분 내 30회면 429(웹 사용자별 제한은 웹 서버가 한다). `linkId`는 응답에서 한 번만 주고 서버는 해시만 저장한다
- `GET /internal/v1/web-links/{linkId}/profile` → 200 `AppProfile`
- `DELETE /internal/v1/web-links/{linkId}` → 204
- 연동이 없으면(해제·앱 탈퇴) 위 둘은 404 `LINK_NOT_FOUND` → 웹은 연동을 끊고 저장한 앱 정보를 지운다
- `AppProfile` = `{ "email": string|null, "provider": "email"|"kakao"|"google" }`. 앱에는 닉네임이 없다. 소셜 계정은 `email`이 null일 수 있다
- `GET /internal/v1/web-links/{linkId}/seed-money` → 200. 기존 `total`, `base`, `monthlyGoal`, `lastEntry`, `updatedAt`을 유지하며 `startedOn`, `entries`를 추가한다. 앱에서 예산 설정을 아직 안 했으면 404 `BUDGET_NOT_SET`, 없는·해제된 연동은 404 `LINK_NOT_FOUND`, 서비스 키 없음·오류는 401 `UNAUTHORIZED`로 기존과 같다.

```json
{
  "total": 1450000,
  "base": 500000,
  "monthlyGoal": 300000,
  "lastEntry": {
    "cycleEnd": "2026-09-25",
    "choice": "ALL",
    "amount": 950000,
    "createdAt": "2026-09-26T20:10:00+09:00"
  },
  "updatedAt": "2026-09-26T20:10:00+09:00",
  "startedOn": "2026-08-26",
  "entries": [
    {
      "cycleEnd": "2026-09-25",
      "choice": "ALL",
      "amount": 950000,
      "totalAfter": 1450000,
      "createdAt": "2026-09-26T20:10:00+09:00"
    }
  ]
}
```

- `entries`는 `POST /budget/seed-money/entries`로 저장된 **확정 기록 전부**, `cycleEnd` 오름차순이다. 앱 사용자 API(`GET /budget/seed-money`)의 최근 12건·최신순과 다르다. `choice`는 `GOAL` / `ALL` / `MANUAL`, `amount`는 저장된 원 단위 정수, `createdAt`은 실제 반영 시각(Asia/Seoul, `+09:00`)이다. `cycleEnd`는 주기 종료일이며 실제 반영일은 그 이후일 수 있다.
- 사용자가 `MANUAL`로 **0원 반영을 완료한 기록도 포함**한다. 미반영 주기는 만들거나 0원으로 채우지 않는다. 기록이 없으면 `entries: []`, `lastEntry: null`, `total == base`다. 반영 대기(`pending`), 반영 후보 금액(`goalAmount`·`allAmount`), 거래 기록은 제공하지 않는다.
- `totalAfter`는 **조회 시점의 `base` + 해당 주기까지 확정 금액의 합**이다. `total`은 같은 `base` + 전체 확정 금액의 합이므로 마지막 `totalAfter == total`이다. `base`는 `PUT /budget/settings`의 `seedBase`로 수정할 수 있다. 수정 후에는 모든 `totalAfter`를 현재 `base`로 다시 계산한다(반영 당시 base의 스냅숏이 아님). 저장된 `amount`·`choice`·`cycleEnd`·`createdAt`은 바꾸지 않는다. 웹은 누적 금액을 따로 계산하지 않는다.
- `startedOn`은 사용자의 **`daily_budgets` 첫 `budget_date`**다. 설정의 `updatedAt`·잔액 기준일은 수정할 수 있고 설정 생성일은 별도로 저장하지 않아 선택하지 않았다. 첫 하루 예산 조회 전에는 `null`이고, 이후 설정·모아둔 돈을 고쳐도 시작일은 유지된다. 웹은 `null`이면 시작점 없이 표시한다. 조회로 하루 예산이나 반영 기록을 생성하지 않는다.
- `lastEntry`는 마지막 주기의 기존 4개 필드를 그대로 유지한다. `updatedAt`은 기존과 같이 마지막 반영 또는 예산 설정 저장 시각 중 늦은 것이다. 그래프의 시작점은 (`startedOn`, `base`), 이후 점들은 (`cycleEnd`, `totalAfter`)를 쓴다.

배포 후 전달 자료와 개인정보 제공 항목 협의안은 [주기별 반영 기록 인수인계](web-seed-entries-handoff.md).

## 기타

- `GET /api/v1/health` (공개) → `{ "status": "UP" }`. 앱이 떠 있는지만 본다(Docker 헬스체크용)
- `GET /actuator/health` (공개, 운영 감시용) → 앱·DB·디스크(남은 공간 300MB 미만이면 DOWN)를 함께 보고, 하나라도 DOWN이면 503. `components`에 항목별 상태만 있고 세부값은 없다
- 개인정보처리방침·고객지원·웹 계정 삭제는 프론트 정적 페이지(`/privacy`, `/support`, `/delete-account`)다. 서버 API는 위의 인증·`DELETE /me`를 쓴다.
- CORS 허용 Origin은 서버 환경변수 `CORS_ORIGINS`(쉼표 구분, 예: `https://project2-flex-sh.vercel.app,http://localhost:8081`).
