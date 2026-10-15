# Flex-able 텅장관리

사회초년생을 위한 생활비 관리 앱 — 잔액·수입일·고정지출과 직접 기록한 거래로
**오늘 쓸 수 있는 돈**을 계산해 보여준다.

신한 DS 금융SW아카데미 7팀

- 웹: https://project2-flex-sh.vercel.app (시연: `/demo`)
- Android: Google Play 비공개 테스트 중

## 주요 기능

- 이메일 가입·로그인
- 초기 예산 설정: 잔액, 수입일·수입액, 고정지출, 카드 미결제액, 보호 금액
- 홈: 오늘·이번 주 쓸 수 있는 돈, 다음 수입일까지 남은 생활비, 예산을 지킨 만큼 성장하는 캐릭터
- 거래 직접 기록·수정·삭제, 카테고리 관리, 고정지출 자동 기록
- 소비 분석(기간별 카테고리 합계), 계정·데이터 삭제

계좌 연결, AI 분석, 알림 자동 기록은 시연(`/demo`)에만 있다. 전체 목록과 구현 근거는 [`docs/FEATURES.md`](docs/FEATURES.md).

## 구성

```text
Android 앱 ─┐
            ├─ HTTPS ─▶ API 서버 (Spring Boot, EC2 + Docker + Caddy) ─▶ MySQL (RDS)
웹 (Vercel) ┘           https://flex-able-sh.duckdns.org/api/v1
```

| 영역 | 기술 | 디렉토리 |
|---|---|---|
| 앱·웹 | Expo SDK 57, React Native 0.86, Expo Router, TypeScript | [`frontend/`](frontend/README.md) |
| API | Spring Boot 4.1, Java 21, Spring Security(JWT), JPA, Flyway | [`backend/`](backend/README.md) |
| DB | MySQL 8 (로컬은 H2) | `backend/src/main/resources/db/migration` |
| 배포 | Vercel(웹), EAS Build·Update(앱), EC2 + RDS(API) | [`docs/HANDOFF.md`](docs/HANDOFF.md) |

"오늘 쓸 수 있는 돈"은 서버가 계산한 값이 최종값이다(계산식은 [`docs/API.md`](docs/API.md) `GET /budget/today`).

## 로컬에서 실행

JDK 21, Node 22 이상이 필요하다.

```bash
# 1) API 서버 — MySQL 없이 H2 파일 DB로 뜬다 (http://localhost:8080)
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'

# 2) 웹 — 다른 터미널에서 (http://localhost:8081)
cd frontend
npm ci
cp .env.example .env.local      # API 주소 = http://localhost:8080
npm run web
```

검증 명령(타입 검사, 린트, 백엔드 테스트, E2E)은 [`AGENTS.md`](AGENTS.md) "검증 명령".

## 처음 보는 사람이 읽는 순서

1. [`docs/FEATURES.md`](docs/FEATURES.md) — 지금 되는 기능, 시연에만 있는 기능, 아직 없는 기능
2. [`AGENTS.md`](AGENTS.md) — 폴더 구조, 의존 방향, 검증 명령, 작업 규칙 (AI 도구도 이 파일을 읽는다)
3. [`docs/API.md`](docs/API.md) — API와 "오늘 쓸 수 있는 돈" 계산식
4. [`frontend/README.md`](frontend/README.md), [`backend/README.md`](backend/README.md) — 영역별 실행·구조
5. [`docs/HANDOFF.md`](docs/HANDOFF.md) — 배포·출시 현황과 다음 할 일

| 문서 | 내용 |
|---|---|
| [`docs/play-store/`](docs/play-store/README.md) | Google Play 제출 자료, 개인정보처리방침·이용약관 원문 |
| [`docs/bug-transaction-edit-blank-screen.md`](docs/bug-transaction-edit-blank-screen.md) | Android 저장 후 빈 화면 버그 분석과 재발 방지 규칙 |
