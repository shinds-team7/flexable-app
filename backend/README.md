# Flex-able 텅장관리 — Backend

서비스 1.0.0 API 서버. Spring Boot 4.1, Java 21, MySQL 8(Flyway). API 계약은 [`docs/API.md`](../docs/API.md).

## 로컬 실행

```bash
cd backend
./gradlew test                                              # 단위·통합 테스트(H2)
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2 파일 DB로 실행
curl http://localhost:8080/api/v1/health                    # {"status":"UP"}
```

## 구조

| 패키지 | 내용 |
|---|---|
| `auth` | 가입·로그인·로그아웃·탈퇴, JWT(HS256, 30일, `tv` 클레임으로 폐기), 로그인 실패 제한 |
| `budget` | 초기 예산 설정, `BudgetCalculator`(오늘 쓸 수 있는 돈, 서버 최종값) |
| `category` | 기본 카테고리 생성, 사용자 카테고리 CRUD |
| `transaction` | 수동 입력 거래 CRUD, `Idempotency-Key` |
| `analysis` | 기간별 카테고리·일별 합계 |
| `user` | 사용자, 계정·데이터 일괄 삭제 |

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
