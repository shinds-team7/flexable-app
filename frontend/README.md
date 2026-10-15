# Flex-able 텅장관리 — Frontend

Expo(React Native) + Expo Router. 한 코드로 Android와 웹을 빌드한다.

- **실제 서비스(버전 1.0.0)**: `/` 이하. 백엔드 API(`../backend/`)로 가입·예산 설정·거래·분석·계정 삭제를 한다. 온라인 전용
- **시연(버전 1.1.0)**: `/demo` 이하, 웹 전용. 예시 데이터로만 동작하고 서버를 부르지 않는다

기능별 구현 여부는 [`../docs/FEATURES.md`](../docs/FEATURES.md), 작업 규칙은 [`../AGENTS.md`](../AGENTS.md)와 [`AGENTS.md`](AGENTS.md)(Expo).

## 실행

```bash
cd frontend
npm ci
npm run web        # 브라우저 (http://localhost:8081)
npm start          # 개발 서버. 날짜 선택기 같은 네이티브 모듈은 Expo Go가 아니라 개발 빌드에서 확인
npm run build:web  # 정적 웹 빌드 → dist/
npm run typecheck
npm run lint
```

서비스 화면을 쓰려면 `.env.example`을 `.env.local`로 복사한다(`EXPO_PUBLIC_API_URL=http://localhost:8080`, 백엔드 실행은 [`../backend/README.md`](../backend/README.md)). `.env.production`(운영 API 주소)은 웹 운영 빌드용이다.

E2E는 로컬 백엔드(8080)와 웹(8081)을 띄운 뒤 `npx playwright test`.

> 패키지 추가는 `npx expo install <pkg>` 로 (SDK 호환 버전 자동 선택). 커밋 전 확인할 것은 `../docs/HANDOFF.md` §3

## 폴더 구조

```
src/
  app/           # 화면 경로(파일 = 화면). (service)/ 로그인 후 탭·거래·카테고리, auth/, onboarding/, 공개 페이지
    demo/        # 시연 화면 전체
  service/       # 실제 서비스 화면 구현·세션·API 클라이언트(api/client.ts)·설정(config.ts)
  components/    # 서비스와 시연이 함께 쓰는 UI (ui.tsx, Toast, CharacterStage, TodayHeroView, Donut ...)
  demo/          # 시연 전용: store/(전역 상태·예산 Mock 계산), data/(Mock 데이터), ai/(AI 모의 동작),
                 #   components/(시연 전용 UI), routes.ts(시연 경로 helper), version.ts
  theme/         # 색상·폰트 토큰
  utils/         # 날짜·금액 포맷
e2e/             # Playwright — 실제 서비스 흐름
```

`src/demo`, `src/app/demo` 밖의 코드는 `@/demo/*`를 import할 수 없다(`eslint.config.js`). 시연 화면에서 다른 시연 화면으로 이동할 때는 `src/demo/routes.ts`의 helper를 쓴다(서비스가 같은 이름의 경로를 쓰기 때문).

## 시연

`/demo`에 처음 접속하면 시연 온보딩이 나온다. "체험 데이터로 둘러보기"로 바로 홈에 들어갈 수 있다(웹은 완료 여부를 localStorage에 기억, 마이 → "처음 설정 다시 하기"로 초기화). 상태는 메모리에만 있어서 URL을 새로 열면 처음 상태로 돌아간다.

마이 → "시연 메뉴"(`/demo/simulations`)에서 아래 장면을 바로 열 수 있다.

| URL | 시연 내용 |
|-----|-----------|
| `/demo/simulations/pay?merchant=스타벅스&amount=5600&category=cafe` | 결제 수신 → 오늘 쓸 수 있는 돈 재계산 → 결제 푸시(잠금화면) |
| `/demo/simulations/push?type=morning` | 아침 정산 요약 푸시 |
| `/demo/simulations/push?type=settle` | 지난 일정 정산 요청 푸시 |
| `/demo/simulations/push?type=plan` | 고액 지출 D-7 푸시 |
| `/demo/tx/nbbang` · `/demo/tx/proxy` | 회식비 1/N · 대신 결제 반영 제외 |
| `/demo/settle/s0` | 지난 일정 ↔ 실제 결제 정산 |

## 배포 (Vercel)

Vercel 프로젝트의 **Root Directory = `frontend`**. `vercel.json` 설정대로 빌드한다(Build: `npx expo export -p web`, Output: `dist`, SPA rewrite). `main`에 머지하면 자동 배포된다.

`vercel.json`의 redirect는 분리 전 시연 주소(`/plan`, `/tx/:id` 등)를 `/demo/...`로 넘기는 임시(307) 호환이다. 남겨 둔 이유는 [`../docs/FEATURES.md`](../docs/FEATURES.md) "호환 경로 결정 기록".

앱 빌드·원격 업데이트는 [`../docs/HANDOFF.md`](../docs/HANDOFF.md) §4-2.
