# 작업 방식: 저장소 기준본·Issue 단위·spec-change 절차

- 날짜: 2026-10-25 · 결정한 사람: SXXNHU · 관련: Issue #131
- 영향: 전체(앱 화면·앱 서버·웹 연동·각자의 AI 세션)

## 결정

웹 저장소에서 정한 [작업 방식](https://github.com/shinds-team7/flexable-web/blob/main/docs/decisions/2026-10-25-dev-process.md)을 앱 저장소에도 그대로 쓴다. 규칙(기준본은 저장소 하나, Issue 단위 작업, PR 템플릿·CODEOWNERS·`spec-change`, 문서가 바뀌었을 때의 절차, 개발 중 결정의 기록)은 그 문서가 정본이고, 여기에는 앱 저장소에서 달라지는 경로만 적는다.

## 이유

앱 서버는 웹 서버에 회원 정보·시드머니를 주는 쪽이라 두 저장소의 계약·정책이 맞아야 한다. 같은 절차를 쓰면 어느 쪽 문서가 바뀌었는지, 어느 구현이 어느 문서 버전을 기준으로 했는지 같은 방식으로 추적할 수 있다.

## 바뀌는 것(문서·코드·설정)

| 웹 문서 §2의 항목 | 앱 저장소 | 상태 |
|---|---|---|
| 공통 `AGENTS.md`(`CLAUDE.md`는 `@AGENTS.md`) | 루트 `AGENTS.md`. 구조·요청 경로·배포 갈래는 [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)로 옮김 | 1단계 #132 |
| 파트별 `AGENTS.md` | `frontend/AGENTS.md`(Expo 명령·컨벤션), `backend/AGENTS.md` | 1단계 #132 |
| Issue·PR 템플릿, CODEOWNERS(리드 @SXXNHU), 라벨 `spec-change`·`no-issue`, `pr-rules` | `.github/`. `pr-rules`의 기준 문서 경로에 `frontend/AGENTS.md`를 더함 | 1단계 #132 |
| `docs/CHANGELOG.md`, `docs/decisions/` | 같은 경로 | 1단계 #132 |
| `docs/PRD.md` | `docs/FEATURES.md`를 근거로 요약 | 2단계 #134 |
| `docs/policies.md` + `tests/policy/` | `docs/API.md`의 예산 계산식을 옮기고 백엔드 `BudgetPolicyTest`·`SeedMoneyPolicyTest`·`CharacterPolicyTest`가 검사 | 2단계 #134 |
| `docs/contracts/*.yaml` | `app-api.yaml`(앱 화면 ↔ 앱 서버), `web-link-api.yaml`(웹 서버가 부르는 `/internal/v1/web-links/*`). 백엔드 `ContractTest`, 프론트 `gen:api`·`check:api`·`mock:api` | 3단계 #136 |
| `main` 보호 | 저장소 규칙 "main 보호"(웹과 같은 구성). `main` 직접 push·강제 push·삭제 금지, PR 필수, CI `백엔드 테스트`·`프론트엔드 타입 검사·린트`·`웹 빌드·E2E`·`issue-link`·`spec-change` 통과 필수, CODEOWNERS 경로는 리드(@SXXNHU) 승인 필수(그 밖은 승인 없이 CI만 통과하면 병합), 저장소 관리자(SXXNHU·gowon0)는 우회 가능 | 4단계 설정 완료(10-25) |

- 프론트 타입 생성기 `openapi-typescript`는 TypeScript 5만 지원한다고 선언해 앱(TypeScript 6) 의존성에 넣지 않고 `npx`로 버전을 고정해 실행한다(EAS `npm ci`가 peer 불일치로 깨지지 않게, HANDOFF §3).
- `web-link-api.yaml`은 웹 백엔드(`applink.AppApiClient`)가 기대하는 계약이라, 바꿀 때는 웹 저장소에도 알린다.
