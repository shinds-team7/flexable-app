# 구조

앱 저장소의 폴더 구조, 요청이 지나가는 길, 배포 갈래다. 2026-10-25까지 루트 `AGENTS.md`에 있던 내용을 옮겼다. 기능별 구현 여부는 [FEATURES.md](FEATURES.md), API는 [API.md](API.md).

## 폴더

```text
backend/                  Spring Boot 4 · Java 21 · MySQL(Flyway). 패키지별: auth, budget, category, transaction, analysis, user, coin, outfit, referral, weblink, 공통 common·config(오류 형식·보안·설정값). Flyway Java 마이그레이션은 src/main/java/db/migration (구성은 backend/README.md)
frontend/                 Expo(React Native) · Expo Router. 한 코드로 Android·웹
  src/app/                화면 경로(파일 하나 = 화면 하나). Expo Router 규칙상 경로 파일은 여기에만 둔다
  src/service/            실제 서비스 화면·세션·API 클라이언트(api/client.ts)
  src/components/         공통 UI
  src/theme/, src/utils/  색·글꼴 토큰, 날짜·금액 포맷
  e2e/                    Playwright(실제 서비스 흐름)
docs/                     API 계약, 기능 기준표, 운영 인수인계, Play 제출 자료, 결정 기록·문서 변경 이력
.github/                  Issue·PR 템플릿, CODEOWNERS
.github/workflows/        ci.yml(PR 검증), pr-rules.yml(Issue 연결·spec-change 검사), server-health.yml(운영 서버 15분 감시)
```

**의존 방향:** 공통 UI(`src/components`)는 값을 props로 받아 표시만 하고, 데이터는 서비스 쪽이 넘긴다.

**요청 하나가 지나가는 길(예: 거래 수정):**
`src/app/(service)/transactions/[id].tsx` → `src/service/TransactionForm.tsx` → `src/service/api/client.ts` → `PATCH /api/v1/transactions/{id}` → `backend/.../transaction/TransactionController.java` → `TransactionService.java`(`TransactionRepository`로 조회한 엔티티를 고치면 트랜잭션이 끝날 때 JPA가 반영) → MySQL `transactions`

## 앱과 웹사이트

웹사이트는 flexable-web이 자기 서버·DB·계정으로 따로 운영한다(2026-10-20 결정). 이 저장소 `backend/`는 앱 API이고, 웹에는 사용자가 앱에서 받은 연동 코드로 [앱 연동하기]를 했을 때만 서버 간 API(`/internal/v1/web-links/*`)로 회원 정보·시드머니를 준다. 경계와 계약 초안은 [앱·웹 서비스 경계](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/04-service-boundaries.md), 웹 기획 정본은 [flexable-web 제품 문서](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/README.md)에 있다.

## 배포 갈래

| 바뀐 것 | 반영 방법 |
|---|---|
| 웹 | `main`에 머지하면 Vercel이 자동 배포 |
| 앱 JS·이미지 | EAS 원격 업데이트(새 설치 없이 반영) |
| 앱 네이티브(패키지, `app.json` 권한·아이콘·플러그인, SDK) | `app.json` `version`을 올리고 새 빌드 → Play 업로드 |
| 백엔드 | `backend/deploy/deploy.sh` |

절차와 주의점은 [HANDOFF.md](HANDOFF.md) §4·§5. 배포 명령은 사람이 직접 실행한다.
