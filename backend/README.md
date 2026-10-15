# Flex-able 텅장관리 — Backend

서비스 1.0.0 API 서버. Spring Boot 4.1, Java 21, MySQL 8(Flyway). API 계약은 [`docs/API.md`](../docs/API.md).

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
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | MySQL 접속 | `localhost:3306/flexable`, `flexable` |
| `JWT_SECRET` | 토큰 서명 키(HS256). **바꾸면 모든 사용자가 로그아웃된다** | 비어 있음(운영에서 반드시 설정) |
| `CORS_ORIGINS` | 허용할 웹 주소(쉼표 구분) | `http://localhost:8081` |
| `PORT` | 서버 포트 | `8080` |
| `API_DOMAIN` | Caddy가 HTTPS 인증서를 받을 도메인(`deploy/` 전용) | — |

## 구조

| 패키지 | 내용 |
|---|---|
| `auth` | 가입·로그인·로그아웃·탈퇴, JWT(HS256, 30일, `tv` 클레임으로 폐기), 로그인 실패 제한 |
| `budget` | 초기 예산 설정, `BudgetCalculator`(오늘 쓸 수 있는 돈, 서버 최종값) |
| `category` | 기본 카테고리 생성, 사용자 카테고리 CRUD |
| `transaction` | 수동 입력 거래 CRUD, `Idempotency-Key` |
| `analysis` | 기간별 카테고리·일별 합계 |
| `user` | 사용자, 계정·데이터 일괄 삭제 |
| `common` | 오류 코드·응답 형식, 기간·시각 도우미, 헬스 체크 |
| `config` | 보안(JWT 검증·CORS), 설정값 바인딩, 시간대(Asia/Seoul) |

## API

모든 경로는 `/api/v1` 아래. 요청·응답과 규칙은 [`docs/API.md`](../docs/API.md).

| 메서드·경로 | 내용 |
|---|---|
| `POST /auth/signup`, `POST /auth/login` | 가입, 로그인(토큰 발급). 인증 없이 호출 |
| `POST /auth/logout` | 토큰 폐기 |
| `GET /me`, `DELETE /me` | 내 정보, 계정·데이터 삭제 |
| `GET·PUT /budget/settings` | 초기 예산 설정 조회·전체 교체 |
| `GET /budget/today` | 오늘·이번 주 쓸 수 있는 돈, 캐릭터 점수 |
| `GET·POST /categories`, `PATCH·DELETE /categories/{id}` | 카테고리 |
| `GET·POST /transactions`, `GET·PATCH·DELETE /transactions/{id}` | 거래(직접 입력). 생성은 `Idempotency-Key`로 중복 방지 |
| `GET /analysis/summary` | 기간별 카테고리·일별 합계 |
| `GET /health` | 상태 확인. 인증 없이 호출 |

## 테스트

| 파일 | 다루는 것 |
|---|---|
| `ApiFlowTest` | 가입 검증·중복, 로그인 제한, 토큰 필수, 전체 흐름, 고정지출 자동 기록, 로그아웃 후 토큰 거절 |
| `budget/BudgetCalculatorTest` | 오늘 쓸 수 있는 돈 계산 |
| `budget/CharacterScoreTest` | 캐릭터 점수(하루 예산 지키면 +15, 넘기면 −50) |

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

도메인 변경: 서버 `.env`의 `API_DOMAIN` 수정 → `docker compose up -d` (Caddy가 새 인증서 발급) → 앱의 `EXPO_PUBLIC_API_URL`을 바꿔 다시 빌드.
DB 스키마 변경은 `src/main/resources/db/migration/V{n}__*.sql`를 추가한다(기존 파일 수정 금지). 시각 값을 넣는 데이터 변경처럼 DB 세션 시간대에 기대면 안 되는 것은 `src/main/java/db/migration/V{n}__*.java`(Flyway Java 마이그레이션, 예: V3)로 쓴다.
