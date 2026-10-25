# Flex-able 텅장관리 — Backend

앱 API 서버. Spring Boot 4.1, Java 21, MySQL 8(Flyway). API 계약은 [`docs/contracts/`](../docs/contracts/README.md)(OpenAPI, 정본), 요약은 [`docs/API.md`](../docs/API.md), 계산 규칙은 [`docs/policies.md`](../docs/policies.md).

웹사이트는 별도 서버(flexable-web `backend/`)다. 이 서버는 웹에 [앱 연동하기]용 API(앱의 연동 코드 발급, 서버 간 `/internal/v1/web-links/*`, 서비스 키 인증)만 제공한다(`weblink` 패키지. 웹에 주는 앱 정보는 회원 이메일·로그인 방법과 시드머니). 경계와 절차는 [앱·웹 서비스 경계](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/04-service-boundaries.md).

## 로컬 실행

```bash
cd backend
./gradlew test                                              # 단위·통합 테스트(H2)
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2 파일 DB로 실행
curl http://localhost:8080/api/v1/health                    # {"status":"UP"}
```

`local` 프로필은 `build/localdb/`의 H2 파일 DB(MySQL 호환 모드)와 개발용 JWT 비밀키를 쓴다(`src/main/resources/application-local.yml`). DB를 비우려면 서버를 끄고 `build/localdb/`를 지운다.

## 환경 변수

운영에서는 서버 `/opt/flexable/.env`(양식 `deploy/.env.example`)로 넣는다. 기본값은 `src/main/resources/application.yml`.

| 변수 | 내용 | 기본값 |
|---|---|---|
| `DB_URL` | MySQL JDBC 주소 | `jdbc:mysql://localhost:3306/flexable?serverTimezone=UTC&characterEncoding=UTF-8` |
| `DB_USERNAME`, `DB_PASSWORD` | MySQL 계정 | `flexable`, `flexable` |
| `JWT_SECRET` | 토큰 서명 키(HS256). **바꾸면 모든 사용자가 로그아웃된다** | 비어 있음(운영에서 반드시 설정) |
| `CORS_ORIGINS` | 허용할 웹 주소(쉼표 구분) | `http://localhost:8081` |
| `WEB_LINK_SERVICE_KEYS` | 웹 서버가 `/internal/**`을 부를 때 쓰는 키(쉼표 구분, 32자 이상, 교체 중엔 두 개) | 비어 있음(internal API 전부 401). `local` 프로필은 개발용 키 |
| `PORT` | 서버 포트 | `8080` |
| `API_DOMAIN` | Caddy가 HTTPS 인증서를 받을 도메인(`deploy/` 전용) | — |

## 구조

| 패키지 | 내용 |
|---|---|
| `auth` | 가입·로그인·로그아웃·탈퇴, JWT(HS256, 30일, `tv` 클레임으로 폐기), 로그인 실패 제한 |
| `budget` | 초기 예산 설정, `BudgetCalculator`(오늘 쓸 수 있는 돈, 서버 최종값), 시드머니(`SeedMoneyService`) |
| `category` | 기본 카테고리 생성, 사용자 카테고리 CRUD |
| `transaction` | 수동 입력 거래 CRUD, `Idempotency-Key` |
| `analysis` | 기간별 카테고리·일별 합계 |
| `user` | 사용자, 소셜 identity, 계정·데이터 일괄 삭제(`AccountDeletionService`) |
| `coin` | 앱에서만 쓰는 코인: 지갑·내역, check-in(가입 선물·어제 예산 보너스·시간 적립 시작), 보상 확인(ack), 시간 적립 모으기 |
| `outfit` | 캐릭터 코스튬 목록·구매(지갑 행 잠금)·적용, 레벨 코스튬 해금(최고 단계) |
| `referral` | 추천 코드 발급·등록(양쪽 100코인) |
| `weblink` | 웹사이트 [앱 연동하기]: 연동 코드 발급, 연동 목록·해제, 웹 서버 전용 `/internal/v1/web-links` |
| `common` | 오류 코드·응답 형식, 기간·시각 도우미, 헬스 체크 |
| `config` | 보안(JWT 검증·CORS, `/internal/**` 서비스 키), 설정값 바인딩, 시간대(Asia/Seoul) |

## API

모든 경로는 `/api/v1` 아래. 요청·응답과 규칙은 [`docs/API.md`](../docs/API.md).

| 메서드·경로 | 내용 |
|---|---|
| `POST /auth/signup`, `POST /auth/login` | 가입, 로그인(토큰 발급). 인증 없이 호출 |
| `GET /auth/oauth/providers`, `GET /auth/oauth/{provider}/start·callback`, `POST /auth/oauth/exchange` | 카카오·Google 로그인. 인증 없이 호출 |
| `POST /auth/logout` | 토큰 폐기 |
| `GET /me`, `DELETE /me` | 내 정보, 계정·데이터 삭제 |
| `GET·PUT /budget/settings` | 초기 예산 설정 조회·전체 교체 |
| `GET /budget/today` | 오늘·이번 주 쓸 수 있는 돈, 캐릭터 점수 |
| `GET /budget/seed-money`, `POST /budget/seed-money/entries` | 시드머니(모아둔 돈 + 주기마다 옮긴 돈), 수입일 전날 반영 |
| `GET·POST /categories`, `PATCH·DELETE /categories/{id}` | 카테고리 |
| `GET·POST /transactions`, `GET·PATCH·DELETE /transactions/{id}` | 거래(직접 입력). 생성은 `Idempotency-Key`로 중복 방지 |
| `GET /analysis/summary` | 기간별 카테고리·일별 합계 |
| `POST /coins/check-in`, `POST /coins/rewards/ack`, `GET /coins`, `POST /coins/collect` | 코인 지급·보상 확인·지갑·시간 적립 모으기 |
| `GET /outfits`, `POST /outfits/{id}/purchase`, `PUT /outfits/equipped` | 코스튬 목록·구매·적용 |
| `GET /referrals/me`, `POST /referrals` | 내 추천 코드, 추천 코드 등록 |
| `POST /me/web-link-codes`, `GET /me/web-links`, `DELETE /me/web-links/{id}` | 웹 연동 코드 발급, 연동 목록·해제 |
| `GET /health` | 상태 확인. 인증 없이 호출 |

웹 서버 전용 `/internal/v1/web-links/*`(서비스 키)는 [`docs/API.md`](../docs/API.md) "웹사이트 연동".

## 테스트

| 파일 | 다루는 것 |
|---|---|
| `ApiFlowTest` | 가입 검증·중복, 로그인 제한, 토큰 필수, 전체 흐름, 고정지출 자동 기록, 로그아웃 후 토큰 거절 |
| `contract/ContractTest` | 엔드포인트마다 정상·오류 응답이 `docs/contracts/*.yaml`과 같은지(정의되지 않은 필드·상태 코드도 실패) |
| `budget/BudgetPolicyTest`·`SeedMoneyPolicyTest`·`CharacterPolicyTest` | `docs/policies.md` 예시 표 = `tests/policy/*.json` |
| `budget/BudgetCalculatorTest` | 오늘 쓸 수 있는 돈 계산 |
| `budget/CharacterScoreTest` | 캐릭터 점수(하루 예산 지키면 +15, 넘기면 −50) |
| `SecurityTest` | 접근 제어: 비로그인 401, 내용을 바꾼 토큰·서명 없는 토큰 401, 다른 사용자의 거래·카테고리 접근 차단, 허용 안 된 출처의 CORS 403 |
| `auth/LoginAttemptLimiterTest` | 로그인 실패 제한과 만료 기록 정리 |
| `auth/OAuthFlowTest`·`OAuthUnavailableTest`·`MemoryOAuthStoreTest`·`RestOAuthProviderClientTest` | 카카오·Google 로그인(start·callback·exchange), 키 없을 때 안내, state·1회용 코드 저장, 공급자 HTTP 호출 |
| `budget/SeedMoneyFlowTest` | 시드머니 조회·반영(GOAL·ALL·MANUAL), 웹 연동용 시드머니 응답 |
| `coin/CoinFlowTest` | 가입 선물·어제 예산 보너스·시간 적립, 코스튬 구매·적용·레벨 해금·환급, 추천 코드 |
| `weblink/WebLinkFlowTest`·`WebLinkAttemptLimiterTest` | 웹 연동 코드 발급·연동·해제·서비스 키, 코드 실패 제한 |

## 운영 배포 (EC2 + RDS)

- 서버: EC2 Ubuntu t3.micro `ubuntu@3.36.103.99`, 경로 `/opt/flexable`
- 구성: `deploy/docker-compose.yml` — `api`(app.jar) + `caddy`(Let's Encrypt 자동 HTTPS)
- 주소: `https://flex-able-sh.duckdns.org/api/v1` (임시 DuckDNS)
- DB: RDS MySQL `database-flex`, DB `flexable`, 앱 계정 `flexable_app`(admin 미사용)
- 비밀값은 서버 `/opt/flexable/.env`(600)에만 있다. 저장소에 넣지 않는다.

최초 1회

```bash
scp -i ~/.ssh/sh-flex.pem deploy/setup-server.sh ubuntu@3.36.103.99:/tmp/ && ssh ... 'bash /tmp/setup-server.sh'
# 파일 업로드 후 서버에서 사용자가 직접: /opt/flexable/setup-db.sh  (admin 비밀번호 입력)
```

코드 변경 배포

```bash
backend/deploy/deploy.sh          # jar 빌드 → 업로드 → docker compose up -d --build
```

운영 확인

```bash
ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99 'cd /opt/flexable && docker compose ps && docker compose logs api --tail 100'
```

외부 감시: GitHub Actions `server-health.yml`이 15분마다 `https://flex-able-sh.duckdns.org/actuator/health`(앱·DB·디스크)와 HTTPS 인증서 만료일을 확인하고, 실패하면 저장소에 이슈를 연다. 자세한 내용은 [`docs/HANDOFF.md`](../docs/HANDOFF.md) §5.

도메인 변경: 서버 `.env`의 `API_DOMAIN` 수정 → `docker compose up -d` (Caddy가 새 인증서 발급) → 앱의 `EXPO_PUBLIC_API_URL`을 바꿔 다시 빌드.
DB 스키마 변경은 `src/main/resources/db/migration/V{n}__*.sql`를 추가한다(기존 파일 수정 금지). 시각 값을 넣는 데이터 변경처럼 DB 세션 시간대에 기대면 안 되는 것은 `src/main/java/db/migration/V{n}__*.java`(Flyway Java 마이그레이션, 예: V3)로 쓴다.
