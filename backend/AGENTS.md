# 백엔드(Spring) 지침

루트 `AGENTS.md`의 공통 지침에 더해 `backend/`에서만 지킬 것.

- 빌드·테스트: `./gradlew test`(CI와 같음), 로컬 실행 `./gradlew bootRun --args='--spring.profiles.active=local'`(MySQL 없이 H2 파일 DB). Java 21, Spring Boot 4, Gradle. 테스트 DB는 H2 메모리. 테스트별 범위는 [README "테스트"](README.md#테스트).
- API 계약: [`docs/contracts/app-api.yaml`](../docs/contracts/app-api.yaml)·[`web-link-api.yaml`](../docs/contracts/web-link-api.yaml)이 정본이고, `contract.ContractTest`가 실제 응답을 스펙으로 검사한다(정의되지 않은 필드·상태 코드도 실패). 응답·오류 코드를 바꾸려면 먼저 스펙을 고치는 PR(`spec-change`)을 올리고, `cd ../frontend && npm run gen:api`로 프론트 타입도 다시 만든다. 새 엔드포인트·상태 코드는 `ContractTest`에도 호출을 더한다. 오류는 `{ code, message, ... }`(검증 실패는 `fields` 추가), 시각은 `+09:00`이 붙은 ISO-8601, 서버의 "오늘"은 `Asia/Seoul`이다. `/internal/v1/web-links/*`는 웹 서버(flexable-web `applink.AppApiClient`)가 부르므로 바꾸면 웹 저장소에도 알린다.
- 금액은 원 단위 정수(`long`), 나눗셈은 내림. 예산·시드머니·캐릭터 점수 계산은 `budget/BudgetCalculator`·`SeedMoneyService`·`CharacterScore`에만 둔다.
- 정책 테스트: `tests/policy/*.json`을 `budget/*PolicyTest`가 읽는다. 계산을 바꾸면 [`docs/policies.md`](../docs/policies.md) 표와 JSON을 함께 고친다(`spec-change`).
- DB 변경은 Flyway 새 버전 파일(`src/main/resources/db/migration/V{n}__*.sql`)로만 한다. 이미 있는 마이그레이션(SQL과 Java `src/main/java/db/migration/V3__fixed_posting_cutover.java`)은 고치거나 지우지 않는다. 번호는 `main`과 열린 PR의 마이그레이션 번호를 확인하고 정한다. DB 세션 시간대에 기대면 안 되는 데이터 변경은 Java 마이그레이션(`src/main/java/db/migration/`)으로 쓴다.
- 외부 호출이 실패해도 핵심 기능은 동작해야 한다.
  - 카카오·Google 로그인: 연결 3초·읽기 5초 제한. 토큰 교환·프로필 조회 실패·시간 초과는 `{redirectUri}?error=failed`로 보낸다. 로그에는 상태 코드만 남기고 응답 본문·토큰·이메일은 남기지 않는다.
  - 탈퇴 때 카카오 연결 끊기 실패: 탈퇴는 그대로 진행하고 경고 로그만 남긴다.
  - 고정지출 자동 기록 실패: 거래 내역·소비 분석 조회는 경고 로그만 남기고 계속한다. 오늘 쓸 수 있는 돈과 시드머니 조회·반영은 같은 트랜잭션이라 함께 실패한다(`docs/API.md` "고정지출 자동 기록").
- 비밀 값은 서버 `/opt/flexable/.env`(양식 `deploy/.env.example`)에만 둔다. 로그에 토큰·비밀번호·연동 코드·`linkId`를 남기지 않는다.
