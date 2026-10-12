# Flex-able 서비스 API v1 (MVP)

서비스 1.0.0 비공개 테스트(Google Play 12명)용 최소 API. 서버 코드는 `backend/`(Spring Boot 4.1, Java 21, MySQL 8).
이 문서가 프론트·백엔드 사이의 계약이다. 바꿀 때는 이 문서를 먼저 고친다.

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
| 404 | `NOT_FOUND` | 리소스 없음(남의 리소스도 404) |
| 404 | `BUDGET_NOT_SET` | 초기 예산 미설정 |
| 409 | `EMAIL_UNAVAILABLE` | 가입 불가 이메일(이미 가입 등) |
| 409 | `CATEGORY_DUPLICATE` | 같은 종류에 같은 이름 카테고리 존재 |
| 409 | `CATEGORY_DEFAULT` | 기본 카테고리는 삭제 불가 |
| 429 | `TOO_MANY_ATTEMPTS` | 로그인 연속 실패(10분 내 5회). `retryAfterSeconds` 추가 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

화면 문구는 `message`를 그대로 써도 되도록 한국어 존댓말로 내려준다. 분기는 반드시 `code`로 한다.

## 인증

### `POST /auth/signup` (공개)

```json
{ "email": "a@b.com", "password": "abcd1234", "agreeTerms": true, "agreePrivacy": true }
```

- 비밀번호 8~64자, 영문·숫자 각 1자 이상. 두 동의 값은 `true`여야 한다.
- 201 → `AuthResponse`. 가입 시 기본 카테고리가 자동 생성된다.

### `POST /auth/login` (공개)

```json
{ "email": "a@b.com", "password": "abcd1234" }
```

200 → `AuthResponse`

```json
{
  "accessToken": "eyJ...",
  "expiresAt": "2026-11-12T10:00:00+09:00",
  "user": { "id": 1, "email": "a@b.com", "onboarded": false, "createdAt": "2026-10-13T10:00:00+09:00" }
}
```

- 토큰 유효기간 30일, refresh token 없음. 만료·401이면 로그인 화면으로 보낸다.
- 앱은 `expo-secure-store`, 웹은 `localStorage`에 저장한다.
- `onboarded=false`면 초기 예산 설정(`/onboarding`)으로, `true`면 홈으로 보낸다.

### `POST /auth/logout` → 204

서버가 이 사용자의 기존 토큰을 모두 무효화한다(모든 기기 로그아웃). 클라이언트는 응답과 무관하게 토큰을 지운다.

### `GET /me` → 200 `User`

### `DELETE /me` → 204 (계정·데이터 삭제)

```json
{ "password": "abcd1234" }
```

- 비밀번호가 틀리면 401 `INVALID_CREDENTIALS`.
- 성공하면 사용자·예산 설정·카테고리·거래를 **즉시 영구 삭제**하고 이후 기존 토큰은 401을 받는다.
- 웹 계정 삭제 페이지(`/delete-account`)는 `POST /auth/login` → `DELETE /me` 순서로 호출한다.

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
  "protectedItems": [{ "name": "비상금", "amount": 300000 }]
}
```

| 필드 | 규칙 |
|---|---|
| `balance` | 0 이상 1조 미만. `balanceAt` 시점의 통장 잔액 |
| `balanceAt` | 생략 시 서버 현재 시각. 이 시각 **이후** 거래만 잔액에 더하고 뺀다 |
| `payday` | 1~31. 31은 "매달 말일"(달마다 말일로 맞춤) |
| `incomeAmount`, `cardUnpaid` | 0 이상 |
| `fixedExpenses[]` | 0~30개. `day` 1~31(31=말일), `amount` 1 이상 |
| `protectedItems[]` | 0~30개. `amount` 1 이상 |

응답은 같은 모양에 `fixedExpenses[].id`, `protectedItems[].id`, `updatedAt`이 붙는다.
잔액만 다시 맞출 때도 PUT으로 전체를 보낸다(`balanceAt`을 지금으로).

### `GET /budget/today` → 200 | 404 `BUDGET_NOT_SET`

```json
{
  "date": "2026-10-13",
  "nextPayday": "2026-10-25",
  "daysLeft": 12,
  "estimatedBalance": 1180000,
  "reservedFixed": 450000,
  "cardUnpaid": 0,
  "protectedTotal": 300000,
  "remaining": 430000,
  "todaySpent": 12000,
  "dailyBudget": 36833,
  "todayAvailable": 24833,
  "shortage": 0,
  "weekSpent": 54000,
  "weekDaysLeft": 6,
  "weekAvailable": 208998,
  "cycleStart": "2026-09-25",
  "hasTransactions": true
}
```

계산(서버가 최종값, 원 단위 정수, 나눗셈은 내림):

- `estimatedBalance` = `balance` + (`balanceAt` 이후 수입 합) − (`balanceAt` 이후 지출 합)
- `nextPayday` = 오늘 이후(오늘 제외) 가장 가까운 수입일, `daysLeft` = 오늘부터 수입일 전날까지 날짜 수(오늘 포함, 최소 1)
- `reservedFixed` = 오늘 ~ 수입일 전날 사이에 날짜가 오는 고정지출 합(지난 날짜는 이미 나간 것으로 봄)
- `remaining` = `estimatedBalance` − `reservedFixed` − `cardUnpaid` − `protectedTotal`
- `dailyBudget` = max(0, `remaining` + `todaySpent`) ÷ `daysLeft`
- `todayAvailable` = max(0, `dailyBudget` − `todaySpent`), `shortage` = `remaining` < 0이면 −`remaining`, 아니면 max(0, `todaySpent` − `dailyBudget`)
- `weekSpent` = 이번 주(월~일) 지출 합, `cycleStart` = 직전 수입일
- `weekDaysLeft` = 오늘부터 이번 주 일요일과 수입일 전날 중 빠른 날까지 날짜 수(오늘 포함, 최소 1)
- `weekAvailable` = max(0, `dailyBudget` × `weekDaysLeft` − `todaySpent`) — 오늘 포함 이번 주 남은 날에 쓸 수 있는 돈
- `hasTransactions` = 지금까지 거래를 한 건이라도 기록했는지(기간 무관). 홈 빈 상태 판단용

화면 문구는 "입력한 잔액·기록 기준 추정"으로 설명한다(실제 은행 잔액과 다를 수 있음).

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
  "createdAt": "2026-10-13T12:33:10+09:00"
}
```

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

## 기타

- `GET /api/v1/health` (공개) → `{ "status": "UP" }`
- 개인정보처리방침·고객지원·웹 계정 삭제는 프론트 정적 페이지(`/privacy`, `/support`, `/delete-account`)다. 서버 API는 위의 인증·`DELETE /me`를 쓴다.
- CORS 허용 Origin은 서버 환경변수 `CORS_ORIGINS`(쉼표 구분, 예: `https://project2-flex-sh.vercel.app,http://localhost:8081`).
