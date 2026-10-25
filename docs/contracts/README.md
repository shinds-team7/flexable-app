# API 계약(OpenAPI)

| 파일 | 무엇 | 검사 |
|---|---|---|
| [`app-api.yaml`](app-api.yaml) | 앱 화면(`frontend/`) ↔ 앱 서버 `/api/v1` | 백엔드 `contract.ContractTest`(실제 응답의 상태 코드·필드), CI `npm run check:api`(프론트 타입이 최신인지) |
| [`web-link-api.yaml`](web-link-api.yaml) | 웹 서버(flexable-web `applink.AppApiClient`) → 앱 서버 `/internal/v1/web-links/*` | 백엔드 `contract.ContractTest` |

[`docs/API.md`](../API.md)는 요약과 동작 설명(소셜 로그인 절차, 고정지출 자동 기록, 삭제 범위 등)이고, 요청·응답 형식의 정본은 이 스펙이다. 계산 규칙은 [`docs/policies.md`](../policies.md).

## 쓰는 법

- **프론트 타입**: `cd frontend && npm run gen:api` → `src/service/api/schema.d.ts`(직접 고치지 않음). 사용 예: `import type { components } from '@/service/api/schema'; type Today = components['schemas']['Today'];`
  - `openapi-typescript`는 TypeScript 5만 지원한다고 선언해 앱(TypeScript 6)의 의존성에 넣으면 `npm ci`가 깨진다. 그래서 `npx --yes openapi-typescript@7.13.0`으로 버전을 고정해 따로 실행한다.
- **목 서버(백엔드 없이 화면 개발)**: `cd frontend && npm run mock:api`(Prism, http://localhost:4010) → `.env.local`의 `EXPO_PUBLIC_API_URL=http://localhost:4010`으로 바꾸고 `npm run web`. 응답은 스펙의 `example`이 있으면 그 값(오늘 쓸 수 있는 돈·시드머니), 없으면 형식에 맞는 임의 값이다. Prism은 스펙의 `servers`(`/api/v1`)를 경로에 쓰지 않아서, `scripts/mock-api.cjs`가 경로 앞에 `/api/v1`을 붙인 임시 사본을 띄운다.
- **백엔드 계약 테스트**: `cd backend && ./gradlew test --tests "*ContractTest"`(CI의 `./gradlew test`에 포함). 스펙에 없는 필드·상태 코드가 응답에 나오면 실패한다.

## 바꾸는 순서

1. 이 폴더의 스펙을 먼저 고치는 PR을 올린다(`spec-change` 라벨 + `docs/CHANGELOG.md` 한 줄, CODEOWNERS 리뷰). 같은 PR에서 `npm run gen:api` 결과도 커밋한다.
2. 백엔드는 `ContractTest`가 통과하도록 구현하고, 프론트는 새 타입·목 서버로 동시에 작업한다.
3. `web-link-api.yaml`을 바꿀 일이 생기면 구현 전에 이 스펙 PR(`spec-change`)부터 올리고 웹 저장소(flexable-web)에도 알린다. 웹 백엔드 `applink.AppApiClient`(구현 `applink/http/RestAppApiClient`)가 이 형식을 기대하므로 같이 맞춰야 한다. 웹 쪽 문서도 이 파일을 계약으로 가리킨다(웹 #73).
4. 형식은 OpenAPI 3.0.3이다. 비어 있을 수 있는 값은 `nullable: true`, 응답 객체는 `additionalProperties: false`로 적는다.
