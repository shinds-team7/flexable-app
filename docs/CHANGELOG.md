# 문서 변경 이력

기준 문서(`AGENTS.md`·`frontend/AGENTS.md`·`backend/AGENTS.md`·`docs/PRD.md`·`docs/policies.md`·`docs/contracts/`·`docs/decisions/`·`tests/policy/`)를 바꾼 PR은 여기에 한 줄을 더한다. 최신이 위다. `spec-change` 라벨 PR이 병합되면 작업 브랜치를 rebase하고 AI 세션을 새로 시작한다([작업 방식](decisions/2026-10-25-dev-process.md), 정본은 [웹 저장소](https://github.com/shinds-team7/flexable-web/blob/main/docs/decisions/2026-10-25-dev-process.md) §7).

형식: `- [#PR] 무엇이 바뀌었나 — 영향: 앱 화면·앱 서버·웹·전체`

## 2026-10-25

- [#140] `main` 보호 규칙 설정 완료(PR 필수, 백엔드·프론트·E2E CI와 `issue-link`·`spec-change` 통과 필수, CODEOWNERS 경로 리드 승인, 관리자 우회)를 작업 방식 결정 기록에 반영했다. 웹 연동 스펙을 바꿀 때 웹 `RestAppApiClient`도 같이 맞춘다고 계약 README에 적었다 — 영향: 전체(이제 `main`에 직접 push 불가, PR에 Issue 번호 필요)
- [#136] API 계약을 OpenAPI로 옮겼다: `docs/contracts/app-api.yaml`(앱 화면 ↔ 앱 서버), `web-link-api.yaml`(웹 서버가 부르는 `/internal/v1/web-links/*`). `docs/API.md`는 요약이 됐다. 백엔드 `ContractTest`가 응답을 검사하고, 프론트 타입(`npm run gen:api`, CI `check:api`)·목 서버(`npm run mock:api`)를 추가했다. 응답 형식은 바뀌지 않았다 — 영향: 앱 화면·앱 서버(응답을 바꿀 때 스펙 먼저), 웹(`web-link-api.yaml`이 웹 백엔드 `applink`의 기준)
- [#134] `docs/PRD.md`(목표·사용자·기능 현재 상태·범위·하지 않는 것)와 `docs/policies.md`(수입일·정산 주기, 오늘 쓸 수 있는 돈, 시드머니 반영, 캐릭터 점수 규칙 + 예시 표)를 추가하고, 예시 표를 `tests/policy/*.json` + `BudgetPolicyTest`·`SeedMoneyPolicyTest`·`CharacterPolicyTest`로 묶었다. `docs/API.md`의 계산식은 policies로 옮기고 링크만 남겼다. 계산 규칙 자체는 바뀌지 않았다. 예정 지출·취소·정산(1/N)은 서비스에 없어 정책을 적지 않았다 — 영향: 앱 서버·앱 화면(참고 문서)
- [#132] 작업 방식 도입: 루트 `AGENTS.md`를 작업 시작 전·중·완료 시 형식으로 다시 쓰고(구조·배포 갈래는 `docs/ARCHITECTURE.md`로), `backend/AGENTS.md`를 추가하고 `frontend/AGENTS.md`를 명령·컨벤션으로 줄였다. Issue·PR 템플릿, `CODEOWNERS`, `spec-change`·`no-issue` 라벨, PR 규칙 검사(`pr-rules`), `docs/decisions/`, 이 파일을 추가했다 — 영향: 전체(새 AI 세션 필요)
