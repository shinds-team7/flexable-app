# 서비스 1.0.0 프론트엔드 작업 보고

작성일: 2026-10-13

## 작업 위치와 범위

- Worktree: `C:/Users/USER/orca/workspaces/project2/opah-codex`
- 브랜치: `SXXNHU/feat-service-frontend`
- `origin/SXXNHU/feat-service-mvp` 병합: `c37c795`. 요청한 원격 배포 구성과 `docs/play-store/` 자료를 받았습니다.
- 직접 작성·수정한 파일은 `frontend/`뿐입니다. 원격 MVP 브랜치와 비교했을 때 `backend/`와 `docs/`는 변경이 없습니다. `docs/API.md`도 수정하지 않았습니다.
- Push, 웹 배포, EAS 빌드·제출은 수행하지 않았습니다.

## 구현한 화면과 데이터 흐름

- 실제 API 클라이언트, 코드별 오류 처리, 네이티브 SecureStore / 웹 localStorage 세션, 만료 시 세션 정리 및 시작 화면 이동.
- 시작·회원가입·로그인, 초기 예산 7단계 및 예산 수정. 임시 입력은 사용자별로 보관하며 마지막 단계에서만 예산을 저장합니다.
- 서비스 홈·내역·분석·마이, 거래 생성·상세·수정·삭제, 카테고리 추가·관리·삭제.
- 거래 응답 유실 시 같은 키와 같은 요청 내용으로 재시도합니다. 기본 거래 시각은 초 단위까지 보존하여 새 거래가 잔액 기준 시각보다 앞서지 않게 합니다.
- 공개 개인정보처리방침·이용약관·고객지원·웹 계정 삭제, 앱 계정 삭제와 로그아웃.
- 약관과 개인정보처리방침은 승인 문서의 본문(편집 안내와 구분선 이후)을 그대로 표시합니다. 운영자명과 이메일만 `config.ts`를 참조합니다. 회원가입에 만 14세 이상 안내를 넣었습니다.
- 시연의 상단 탭과 오늘 금액 카드는 순수 표시 컴포넌트로 분리해 함께 사용합니다. 공통 UI·온보딩 프레임·도넛·토스트·테마도 재사용합니다.
- Android에서 `/demo`를 차단하고, 서비스 URL을 가로채던 Vercel 임시 리다이렉트를 제거했습니다.
- 온라인 전용입니다. SQLite, outbox, AI, 알림 자동 기록은 구현하지 않았습니다.

## 확인한 것

| 확인 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 |
| `npx expo lint` | 오류·경고 0건 |
| `npx expo export -p web` | 성공 |
| `npx playwright test` | 최종 4개 모두 통과 (3.2분) |
| 운영 API 주소·시연 차단 환경변수로 Android JS export | 성공. APK/AAB 빌드나 실기기 실행을 의미하지 않습니다 |
| 로컬 `GET /api/v1/health` | `{"status":"UP"}` |
| 서비스 경로의 mock/AppStore/ai import 검색 | 0건. ESLint 제한도 추가 |
| `git diff --check` | 통과 |
| 원격 MVP 대비 `backend/`, `docs/` 비교 | 변경 없음 |
| 버전·권한 설정 | 1.0.0 유지, 신규 권한 없음. SecureStore의 Face ID 권한 추가도 비활성화 |

브라우저 검증은 실제 로컬 백엔드(local 프로필, H2)와 Expo 웹을 연결한 Chromium에서 수행했습니다. 성공 응답은 실제 서버를 사용했습니다. 실패 재시도 검증에는 연결 중단과 실제 저장 응답 유실을 사용했습니다.

1. 가입 → 예산 설정 → 지출·수입 기록 → 홈·내역·분석 반영 → 거래 수정·삭제 → 로그아웃·로그인 → 계정 삭제 → 동일 계정 로그인 실패.
2. 예산 입력 새로고침 복원, 저장 후 사용자 조회 실패 재시도 시 PUT 중복 없음, 거래 응답 유실 재시도 시 동일 키·중복 거래 없음, 1조 입력 거절 및 입력값 보존.
3. 거래 수정 중 카테고리 추가 시 편집값 보존, 카테고리 삭제 후 거래가 기타로 이동, 거래 삭제 실패 후 재시도, 잘못된 비밀번호와 오프라인 계정 삭제 실패 시 입력·세션 보존.
4. 예산 미설정 계정의 공개 웹 삭제, 만료 세션 정리, 공개 페이지·웹 시연 접근, 승인 문서 전체 본문 일치, 약관 이동 후 가입 입력 보존. 360px 가입 화면과 홈 스크린샷도 확인했습니다.

## 확인하지 못한 것

- Android 실기기에서 키보드·바텀시트·글꼴 확대·SecureStore 및 시연 딥링크 차단 동작.
- 서명된 APK/AAB, EAS 클라우드 빌드, Google Play 비공개 테스트 등록·설치.
- 운영 API에 대한 앱의 실제 통신. 요청에 따라 웹 검증은 로컬 서버로만 했습니다.
- Vercel 배포 상태와 배포 프로젝트의 환경변수. 웹 배포에는 `EXPO_PUBLIC_API_URL=https://flex-able-sh.duckdns.org` 설정이 필요합니다.

## 운영 정보와 남은 TODO

- 운영자·지원 이메일은 `src/service/config.ts` 한 곳에서 관리합니다. 요청한 운영자명과 임시 지원 이메일을 반영했습니다.
- 임시 지원 이메일을 추후 팀 계정으로 교체할 때는 이 파일만 바꾸면 됩니다.
- preview·production의 API URL은 `https://flex-able-sh.duckdns.org`이고 `/api/v1`은 클라이언트가 붙입니다. 두 프로필 모두 시연을 비활성화합니다.
- 운영자명·API 도메인에 남은 TODO 자리표시는 없습니다.

## API 요청사항

현재 계약으로 핵심 기록·인증·삭제 흐름은 동작하며 계약 불일치는 발견하지 못했습니다. 홈 설계의 아래 두 표현을 정확히 지원하려면 응답 항목이 필요합니다.

- `GET /budget/today`에 주간 사용 가능액(예: `weekAvailable`). 현재는 계약에 있는 `weekSpent`를 사용해 **이번 주 쓴 돈**을 표시합니다. 주간 사용 가능액을 임의로 계산하지 않았습니다.
- 원장 전체가 비었는지 확인할 수 있는 전체 거래 수 또는 `hasTransactions`. 현재 조회는 정산 주기 범위이므로 빈 상태 문구는 **이번 정산 주기에 기록한 거래가 없어요**로 표시합니다.

백엔드와 계약 문서는 수정하지 않았습니다.

## 로컬 커밋

```text
e8795bb test(frontend): verify money limits and failed mutation retries
2cde61d fix(frontend): preserve failure states and validate money inputs
e9b2019 feat(frontend): publish approved privacy policy and terms screens
2f91fbf feat(frontend): add account lifecycle and browser service checks
18d2370 feat(frontend): add manual transactions and category management
b4e0f5a feat(frontend): reuse demo layouts for budgets and service tabs
ae8634a feat(frontend): add API sessions and service authentication
```

위 목록 외에 원격 MVP 병합 커밋과 이 보고서 정리 커밋이 있습니다. Push는 하지 않았습니다.

## 변경 파일 목록

원격 MVP 브랜치 기준, 총 65개입니다.

```text
frontend/.env.example
frontend/.gitignore
frontend/app.json
frontend/e2e/service.spec.ts
frontend/eas.json
frontend/eslint.config.js
frontend/package-lock.json
frontend/package.json
frontend/playwright.config.ts
frontend/src/app/(service)/(tabs)/_layout.tsx
frontend/src/app/(service)/(tabs)/analysis.tsx
frontend/src/app/(service)/(tabs)/home.tsx
frontend/src/app/(service)/(tabs)/my.tsx
frontend/src/app/(service)/(tabs)/transactions.tsx
frontend/src/app/(service)/_layout.tsx
frontend/src/app/(service)/account/delete.tsx
frontend/src/app/(service)/categories.tsx
frontend/src/app/(service)/transactions/[id].tsx
frontend/src/app/(service)/transactions/new.tsx
frontend/src/app/_layout.tsx
frontend/src/app/auth/login.tsx
frontend/src/app/auth/signup.tsx
frontend/src/app/delete-account.tsx
frontend/src/app/demo/_layout.tsx
frontend/src/app/index.tsx
frontend/src/app/onboarding/balance.tsx
frontend/src/app/onboarding/card.tsx
frontend/src/app/onboarding/done.tsx
frontend/src/app/onboarding/fixed.tsx
frontend/src/app/onboarding/income.tsx
frontend/src/app/onboarding/index.tsx
frontend/src/app/onboarding/protect.tsx
frontend/src/app/privacy.tsx
frontend/src/app/support.tsx
frontend/src/app/terms.tsx
frontend/src/components/AppHeader.tsx
frontend/src/components/AppHeaderView.tsx
frontend/src/components/HomeContent.tsx
frontend/src/components/HomeStyles.ts
frontend/src/components/OnboardingFrame.tsx
frontend/src/components/TodayHeroView.tsx
frontend/src/components/ui.tsx
frontend/src/service/AnalysisScreen.tsx
frontend/src/service/AuthScreen.tsx
frontend/src/service/BudgetDraft.tsx
frontend/src/service/CategoriesScreen.tsx
frontend/src/service/CategorySheet.tsx
frontend/src/service/DeleteAccountScreen.tsx
frontend/src/service/HomeScreen.tsx
frontend/src/service/LegalPage.tsx
frontend/src/service/MyScreen.tsx
frontend/src/service/OnboardingScreen.tsx
frontend/src/service/ServiceHeader.tsx
frontend/src/service/Session.tsx
frontend/src/service/TransactionForm.tsx
frontend/src/service/TransactionsScreen.tsx
frontend/src/service/api/client.ts
frontend/src/service/config.ts
frontend/src/service/legal.ts
frontend/src/service/storage.ts
frontend/src/service/types.ts
frontend/src/service/ui.tsx
frontend/tsconfig.json
frontend/vercel.json
frontend/SERVICE_1_0_0_REPORT.md
```
