# 문서 변경 이력

기준 문서(`AGENTS.md`·`frontend/AGENTS.md`·`backend/AGENTS.md`·`docs/PRD.md`·`docs/policies.md`·`docs/contracts/`·`docs/decisions/`·`tests/policy/`)를 바꾼 PR은 여기에 한 줄을 더한다. 최신이 위다. `spec-change` 라벨 PR이 병합되면 작업 브랜치를 rebase하고 AI 세션을 새로 시작한다([작업 방식](decisions/2026-10-25-dev-process.md), 정본은 [웹 저장소](https://github.com/shinds-team7/flexable-web/blob/main/docs/decisions/2026-10-25-dev-process.md) §7).

형식: `- [#PR] 무엇이 바뀌었나 — 영향: 앱 화면·앱 서버·웹·전체`

## 2026-10-27

- [#192] 요일별 생활비 배분 추가: 하루 예산을 남은 날의 요일 비중대로 나눈다(policies §2 식 변경, §5 새로 — 프리셋 기본·내 기록 기준(최대 3개월, 7일·3개 요일 이상)·주말·평일, 요일 비중 5~30, 직접 조정). `GET·PUT /budget/day-weights`와 `Today.dayPreset`·`dayBudgets`를 `app-api.yaml`에 추가했다. 비중을 정하지 않은 사용자는 기본 배분이라 기존 금액과 같다([결정](decisions/2026-10-27-day-weights.md)) — 영향: 앱 서버(아카데미 배포, 마이그레이션 V12)·앱 화면(#183 반영 후 runtime 1.5.0 새 빌드에 포함, 서버 먼저)
- [#183] 거래 입력에서 시각 입력을 없애고 날짜만 고르게 했다(오늘은 지금 시각, 다른 날은 한국 시간 12:00). 스크린샷 가져오기 추가: 탭 바 + → 이미지 업로드, 기기 안(ML Kit)에서 토스·카카오뱅크·카카오페이 거래내역 화면을 읽어 검토 후 기존 `POST /transactions`로 기록한다. PRD §3 "거래·카테고리"와 FEATURES를 고쳤고 API 계약·정책은 그대로다. 앱 1.5.0(네이티브 변경 — 새 빌드 필요) — 영향: 앱 화면
- [#190] 기능·수정 PR은 같은 PR에서 `docs/HANDOFF.md` "코드에는 있지만 운영에 아직 없는 것"에 한 줄(반영 방법·배포 순서)을 더하고, 배포·실기기 확인 결과는 다음 작업 PR에 같이 적는다는 규칙을 `AGENTS.md` "작업 완료 시"와 PR 템플릿에 추가했다. HANDOFF만 고치는 PR은 그날 다음 PR이 없을 때만 올린다 — 영향: 전체(작업 방식)
- [#189] 웹 연동 `PUT /internal/v1/web-links/{linkId}/seed-money` `{total}`을 `web-link-api.yaml`에 추가했다. 웹에서 고친 시드머니 총액이 되도록 모아둔 돈(seedBase)을 총액 − 반영한 돈 합으로 바꾸고, 반영한 돈보다 작으면 400으로 거절한다([결정](decisions/2026-10-27-web-seed-money-write.md), policies §3). 기존 응답은 바뀌지 않았다 — 영향: 앱 서버(`deploy.sh`, 마이그레이션 없음)·웹(`RestAppApiClient`)

## 2026-10-26

- [#175] 코인 내역 API `GET /coins/ledger?before=&limit=`(최신순, `nextBefore`로 다음 쪽, `limit` 1~100 기본 30, `LedgerEntry`에 `outfitId`)를 `app-api.yaml`에 추가하고, 홈 코인 칩 → 코인 내역 화면을 만들었다. 기존 응답은 바뀌지 않았다 — 영향: 앱 화면(원격 업데이트로 반영)·앱 서버(`deploy.sh`, 마이그레이션 없음)

## 2026-10-25

- [#146] 기록 알림 추가: 거래 기록이 24시간 없으면 기기 안에서 예약한 알림을 보낸다(가장 최근 거래 `createdAt` 또는 가입 시각부터 24시간마다, 22시~9시면 9시, 7번까지 예약, 마이에서 끄기). PRD §3·§5와 FEATURES "미구현"의 "기기 안에서 예약하는 알림"에 기록 알림을 더했다. 서버 푸시는 여전히 없다 — 영향: 앱 화면(Android, 원격 업데이트로 반영)
- [#140] `main` 보호 규칙 설정 완료(PR 필수, 백엔드·프론트·E2E CI와 `issue-link`·`spec-change` 통과 필수, CODEOWNERS 경로 리드 승인, 관리자 우회)를 작업 방식 결정 기록에 반영했다. 승인·병합은 리드만 하고(리드 본인 PR은 CI 통과 후 관리자 우회), gowon0은 절차에서 제외했다. 웹 연동 스펙을 바꿀 때 웹 `RestAppApiClient`도 같이 맞춘다고 계약 README에 적었다 — 영향: 전체(이제 `main`에 직접 push 불가, PR에 Issue 번호 필요)
- [#136] API 계약을 OpenAPI로 옮겼다: `docs/contracts/app-api.yaml`(앱 화면 ↔ 앱 서버), `web-link-api.yaml`(웹 서버가 부르는 `/internal/v1/web-links/*`). `docs/API.md`는 요약이 됐다. 백엔드 `ContractTest`가 응답을 검사하고, 프론트 타입(`npm run gen:api`, CI `check:api`)·목 서버(`npm run mock:api`)를 추가했다. 응답 형식은 바뀌지 않았다 — 영향: 앱 화면·앱 서버(응답을 바꿀 때 스펙 먼저), 웹(`web-link-api.yaml`이 웹 백엔드 `applink`의 기준)
- [#134] `docs/PRD.md`(목표·사용자·기능 현재 상태·범위·하지 않는 것)와 `docs/policies.md`(수입일·정산 주기, 오늘 쓸 수 있는 돈, 시드머니 반영, 캐릭터 점수 규칙 + 예시 표)를 추가하고, 예시 표를 `tests/policy/*.json` + `BudgetPolicyTest`·`SeedMoneyPolicyTest`·`CharacterPolicyTest`로 묶었다. `docs/API.md`의 계산식은 policies로 옮기고 링크만 남겼다. 계산 규칙 자체는 바뀌지 않았다. 예정 지출·취소·정산(1/N)은 서비스에 없어 정책을 적지 않았다 — 영향: 앱 서버·앱 화면(참고 문서)
- [#132] 작업 방식 도입: 루트 `AGENTS.md`를 작업 시작 전·중·완료 시 형식으로 다시 쓰고(구조·배포 갈래는 `docs/ARCHITECTURE.md`로), `backend/AGENTS.md`를 추가하고 `frontend/AGENTS.md`를 명령·컨벤션으로 줄였다. Issue·PR 템플릿, `CODEOWNERS`, `spec-change`·`no-issue` 라벨, PR 규칙 검사(`pr-rules`), `docs/decisions/`, 이 파일을 추가했다 — 영향: 전체(새 AI 세션 필요)
