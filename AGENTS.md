# AGENTS.md

이 저장소에서 일하는 AI(Claude·Codex·Cursor·Gemini 등)와 사람이 먼저 읽는 안내. `frontend/` 안에서는 [`frontend/AGENTS.md`](frontend/AGENTS.md)(Expo 규칙)도 함께 따른다.

## 무엇을 만드는가

텅장관리(Flex-able): 사회초년생용 생활비 관리 앱. 사용자가 **직접 입력한** 잔액·수입일·고정지출·거래로 "오늘 쓸 수 있는 돈"을 계산한다.
계좌 연결, AI 분석, 알림 자동 기록은 **시연에만 있고 실제 서비스에는 없다.** 기능별 구현 여부와 근거는 [`docs/FEATURES.md`](docs/FEATURES.md).

## 구조

```text
backend/                  Spring Boot 4 · Java 21 · MySQL(Flyway). 패키지별: auth, budget, category, transaction, analysis, user
frontend/                 Expo(React Native) · Expo Router. 한 코드로 Android·웹
  src/app/                화면 경로(파일 하나 = 화면 하나). Expo Router 규칙상 경로 파일은 여기에만 둔다
  src/app/demo/           시연 화면(웹 전용, 예시 데이터)
  src/service/            실제 서비스 화면·세션·API 클라이언트(api/client.ts)
  src/demo/               시연 전용 store·Mock 데이터·AI 모의 동작·시연 전용 컴포넌트
  src/components/         서비스와 시연이 함께 쓰는 UI
  src/theme/, src/utils/  색·글꼴 토큰, 날짜·금액 포맷
  e2e/                    Playwright(실제 서비스 흐름)
docs/                     API 계약, 기능 기준표, 운영 인수인계, Play 제출 자료
.github/workflows/        ci.yml(PR 검증), server-health.yml(운영 서버 15분 감시)
```

**의존 방향:** `src/demo`·`src/app/demo`는 서비스·공통 코드를 써도 되지만, 그 밖의 코드는 `@/demo/*`를 import하지 않는다(ESLint로 막혀 있음). 공통 UI는 값을 props로 받아 표시만 하고, 데이터는 서비스·시연 쪽이 넘긴다.

**요청 하나가 지나가는 길(예: 거래 수정):**
`src/app/(service)/transactions/[id].tsx` → `src/service/TransactionForm.tsx` → `src/service/api/client.ts` → `PATCH /api/v1/transactions/{id}` → `backend/.../transaction/TransactionController.java` → `TransactionService.java`(`TransactionRepository`로 조회한 엔티티를 고치면 트랜잭션이 끝날 때 JPA가 반영) → MySQL `transactions`

## 먼저 읽을 문서

| 알고 싶은 것 | 문서 |
|---|---|
| 새 데스크톱 웹사이트 계획(기능·화면·아키텍처·일정) | [`docs/web/README.md`](docs/web/README.md) |
| 지금 되는 기능과 근거 | [`docs/FEATURES.md`](docs/FEATURES.md) |
| API 요청·응답, 예산 계산식 | [`docs/API.md`](docs/API.md) |
| 프론트엔드·백엔드 실행 | [`frontend/README.md`](frontend/README.md), [`backend/README.md`](backend/README.md) |
| 배포·출시 현황, 다음 할 일 | [`docs/HANDOFF.md`](docs/HANDOFF.md) |
| Android 저장 후 빈 화면 버그와 재발 방지 규칙 | [`docs/bug-transaction-edit-blank-screen.md`](docs/bug-transaction-edit-blank-screen.md) |

## 검증 명령

```bash
# 프론트엔드 (frontend/)
npx tsc --noEmit
npx expo lint
npx expo export -p web                     # 웹 빌드
npx playwright test                        # 로컬 백엔드(8080)와 웹(8081)을 먼저 띄운 뒤

# 백엔드 (backend/)
./gradlew test
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2
```

코드를 바꿨으면 바꾼 영역의 검사를 돌리고 결과를 그대로 보고한다. 실기기·배포 확인은 코드 검증과 따로 적는다.
PR을 올리면 GitHub Actions(`.github/workflows/ci.yml`)가 위 검사를 모두 다시 돌린다(E2E는 정적 웹 빌드 + H2 백엔드). CI가 실패한 PR은 머지하지 않는다.

## 배포는 세 갈래다

| 바뀐 것 | 반영 방법 |
|---|---|
| 웹 | `main`에 머지하면 Vercel이 자동 배포 |
| 앱 JS·이미지 | EAS 원격 업데이트(새 설치 없이 반영) |
| 앱 네이티브(패키지, `app.json` 권한·아이콘·플러그인, SDK) | `app.json` `version`을 올리고 새 빌드 → Play 업로드 |
| 백엔드 | `backend/deploy/deploy.sh` |

절차와 주의점은 `docs/HANDOFF.md` §4·§5.

## 작업 규칙

- 브랜치: `SXXNHU/<종류>-<내용>`(예: `SXXNHU/fix-dow-ui`), `main`에서 따서 PR로 머지
- 커밋 메시지: `feat(frontend): 한국어 요약` 형식
- DB 스키마는 `backend/src/main/resources/db/migration/V{n}__*.sql`을 **추가**한다. 이미 있는 마이그레이션(V1~V4, `src/main/java/db/migration/V3`)은 운영 DB에 적용됐으니 고치거나 지우지 않는다
- 예산 금액은 서버(`BudgetCalculator`)가 최종값이다. 원 단위 정수, 나눗셈은 내림. 클라이언트에서 따로 계산하지 않는다
- 화면 문구: "입력한 잔액·기록 기준 추정"으로 설명한다. "계좌 연결", "최근 6개월 거래", "소비 패턴 분석"처럼 없는 기능을 암시하는 말과 개발 용어는 쓰지 않는다
- 버전: 서비스는 `frontend/app.json`의 `version`, 시연은 `frontend/src/demo/version.ts`(태그 `demo-v*`)
- 약관·개인정보처리방침을 바꾸면 `docs/play-store/*.md`와 웹 화면이 같아야 한다(E2E가 검사)
- 패키지는 `npx expo install`로 추가하고, 커밋 전에 `package-lock.json`을 HANDOFF §3대로 확인한다

## 하지 않는 것

- 운영 DB 접속·수정, 서버 `.env`·JWT 비밀키 변경
- 배포 명령 실행(EAS production 게시·빌드 제출, `deploy.sh`) — 사람이 직접 한다
- `frontend/ios/`, `frontend/android/` 직접 편집(자동 생성 폴더)
- **저장소는 공개(PUBLIC)다.** 비밀번호·키·개인 계정 정보를 코드·문서·커밋에 넣지 않는다
