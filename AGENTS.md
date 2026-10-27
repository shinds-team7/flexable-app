# 공통 개발 지침(flexable-app)

텅장관리(Flex-able) 앱이다. 화면은 `frontend/`(Expo·React Native, 한 코드로 Android·웹), 앱 서버는 `backend/`(Spring)다. 데스크톱 웹사이트와 시연(`/m`)은 별도 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)이고 서버·DB·계정을 따로 쓴다. 파트별 지침은 [`frontend/AGENTS.md`](frontend/AGENTS.md)·[`backend/AGENTS.md`](backend/AGENTS.md)에 있다. 이 파일에는 무엇을 읽고 어떻게 작업할지만 적고, 제품 내용은 아래 문서에 둔다.

## 기준 문서(저장소가 유일한 기준본)

| 무엇 | 어디 |
|---|---|
| 서비스 목적·사용자·기능·범위 | [docs/PRD.md](docs/PRD.md) (기능별 화면·API·확인 방법은 [docs/FEATURES.md](docs/FEATURES.md)) |
| 계산·상태 규칙과 예시 표 | [docs/policies.md](docs/policies.md) = [tests/policy/](tests/policy/) 테스트 |
| 폴더 구조·요청 경로·배포 갈래 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| API 계약(OpenAPI) | 앱 [docs/contracts/app-api.yaml](docs/contracts/app-api.yaml), 웹 연동 [docs/contracts/web-link-api.yaml](docs/contracts/web-link-api.yaml)(정본, 사용법 [README](docs/contracts/README.md)). 요약·동작 설명은 [docs/API.md](docs/API.md) |
| 코인·코스튬 규칙 | [docs/coin-plan.md](docs/coin-plan.md) |
| 결정 기록 | [docs/decisions/](docs/decisions/README.md) |
| 문서 변경 이력 | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| 배포·출시 현황·할 일 | [docs/HANDOFF.md](docs/HANDOFF.md) |
| 개인정보처리방침·이용약관 | [docs/play-store/](docs/play-store/README.md)(웹 공개 페이지와 같아야 한다, E2E가 검사) |
| 작업 방식 자체 | [docs/decisions/2026-10-25-dev-process.md](docs/decisions/2026-10-25-dev-process.md) |

회의·메신저에서 합의한 내용과 채팅에 붙여 넣은 기획은 PR로 저장소에 반영되기 전까지 개발 기준이 아니다. 저장소 문서와 다르면 저장소를 따르고 차이를 알린다. 시연(flexable-web `/m`)에만 있는 기능(계좌 연결, AI 분석, 알림 자동 기록, 예정 지출, 정산)을 서비스 기능으로 오인하지 않는다(FEATURES "미구현").

## 작업 시작 전

- 이번 Issue의 목표·참고 자료·범위·완료 조건을 읽는다. Issue가 없으면 범위와 완료 조건부터 확인한다.
- `docs/PRD.md`에서 목적과 범위를, Issue와 관련된 `docs/policies.md` 항목과 API 계약(`docs/contracts/`)을 저장소에서 직접 읽는다.
- `docs/CHANGELOG.md` 최근 항목을 확인한다.
- 구현 전에 작업 범위, 참고한 문서, 완료 조건을 요약한다.

## 작업 중

- 문서끼리 충돌하거나 정책이 없으면 임의로 확정하지 않고 알린다.
- 작업 요청 없이 `docs/` 문서를 고치지 않는다. 기능을 추가하거나 바꾸면 `docs/FEATURES.md` 표는 같은 PR에서 고친다.
- API 응답은 `docs/contracts/*.yaml`과 맞춘다(백엔드 `ContractTest`가 검사). 계약을 바꿔야 하면 구현하지 말고 먼저 알린다. 프론트 타입은 `npm run gen:api`로 만들고, 백엔드 없이 화면을 만들 때는 `npm run mock:api`(frontend/).
- 정책에 없는 결정은 PR의 "새로 내린 결정" 칸에 적는다. 다른 파트(앱 화면·앱 서버·웹)에 영향을 주면 `docs/decisions/`에 기록한다.
- 제품 공통 규칙:
  - **예산 금액은 서버(`BudgetCalculator`)가 최종값이다.** 원 단위 정수, 나눗셈은 내림. 클라이언트에서 따로 계산하지 않는다.
  - 화면 문구는 "입력한 잔액·기록 기준 추정"으로 설명한다. "계좌 연결", "최근 6개월 거래", "소비 패턴 분석"처럼 없는 기능을 암시하는 말과 개발 용어는 쓰지 않는다.
  - 약관·개인정보처리방침을 바꾸면 `docs/play-store/*.md`와 웹 화면을 같은 PR에서 고친다(E2E가 검사).
  - 웹 서버가 부르는 `/internal/v1/web-links/*`를 바꾸면 웹 저장소(flexable-web)에도 알린다.
  - 버전은 `frontend/app.json`의 `version`이다. 시연 버전은 웹 저장소에서 관리한다.
  - **공개 저장소다.** 비밀번호·키·개인 계정 정보를 코드·문서·커밋에 넣지 않는다.

## 작업 완료 시

- `tests/policy/`를 포함해 바꾼 영역의 검증 명령을 돌리고 결과를 그대로 보고한다. 실기기·배포 확인은 코드 검증과 따로 적는다.
- PR 템플릿을 채운다: Issue(`Closes #번호`), 참고한 문서, 영향받는 파트, 새로 내린 결정, 검증 결과.
- 기능·수정 PR은 같은 PR에서 `docs/HANDOFF.md` "코드에는 있지만 운영에 아직 없는 것" 끝에 한 줄을 더한다: 무엇이 바뀌었는지, PR 번호, 반영 방법(원격 업데이트·새 빌드·서버 배포), 배포 순서 제약. 위쪽 "남은 일 한눈에" 요약은 고치지 않는다(PR끼리 충돌을 줄이려고).
- 배포·실기기 확인 결과는 `HANDOFF.md`만 고치는 PR로 따로 올리지 않고 다음 작업 PR에 같이 적는다. 그날 다음 PR이 없을 때만 HANDOFF PR을 하나 올린다.
- 기준 문서·지침(`AGENTS.md`)·결정 기록을 바꾼 PR에는 `spec-change` 라벨을 붙이고 `docs/CHANGELOG.md`에 한 줄을 더한다. CI(`pr-rules`)가 검사한다.
- 브랜치는 `SXXNHU/<종류>-<내용>`(예: `SXXNHU/fix-dow-ui`), 커밋은 `feat(frontend): 한국어 요약` 형식이다. `main`에서 따서 PR로 머지하고, CI가 실패한 PR은 머지하지 않는다.

## `spec-change` PR이 병합되면

작업 브랜치를 최신 `main`에 rebase하고 CI를 확인한다. 그다음 AI 세션을 새로 시작한다. 진행 중인 세션을 이어 가야 하면 "`docs/CHANGELOG.md`의 최신 항목을 읽고, 변경된 문서를 확인해서 현재 구현과 테스트에 필요한 변경을 먼저 정리해줘"라고 요청한다.

## 검증 명령

Node 22, Java 21. PR마다 GitHub Actions(`.github/workflows/ci.yml`)가 모두 다시 돌린다(E2E는 정적 웹 빌드 + H2 백엔드).

```bash
# 프론트엔드 (frontend/)
npm ci
npm run check:api                          # 프론트 타입이 docs/contracts/app-api.yaml과 같은지
npx tsc --noEmit
npx expo lint
npm run test:unit                          # 단위 테스트(test/*.test.cjs)
npx expo export -p web                     # 웹 빌드
npx playwright test                        # 로컬 백엔드(8080)와 웹(8081)을 먼저 띄운 뒤

# 백엔드 (backend/)
./gradlew test                             # 계약(ContractTest)·정책(*PolicyTest) 테스트 포함
```

로컬 실행은 [README](README.md) "로컬에서 실행"을 본다.

## 하지 않는 것

- 운영 DB 접속·수정, 서버 `.env`·JWT 비밀키 변경
- 배포 명령 실행(EAS production 게시·빌드 제출, `deploy.sh`) — 사람이 직접 한다
- `frontend/ios/`, `frontend/android/` 직접 편집(자동 생성 폴더)
