# Flex-able 텅장관리 — Frontend

Expo(React Native) + Expo Router. 한 코드로 Android와 웹을 빌드한다.

- **실제 서비스(버전 1.0.0)**: `/` 이하. 백엔드 API(`../backend/`)로 가입·예산 설정·거래·분석·계정 삭제를 한다. 온라인 전용
- **시연**: 이 저장소에서 뺐다(2026-10-19). 웹사이트 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)의 `mobile-demo/`, 주소 `https://flexable-web-delta.vercel.app/m`

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

E2E는 로컬 백엔드(8080)와 웹(8081)을 띄운 뒤 `npx playwright test`. PR마다 CI(`../.github/workflows/ci.yml`)가 정적 웹 빌드(`dist/`)를 띄워 같은 테스트를 돌린다.

## 환경 변수

| 변수 | 내용 | 어디서 정하나 |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | API 서버 주소(`/api/v1`은 앱이 붙임) | 로컬 `.env.local`, 웹 운영 `.env.production`, 앱 빌드·원격 업데이트는 EAS 환경변수 |

`EXPO_PUBLIC_` 값은 번들에 그대로 들어가므로 비밀값을 넣지 않는다.

> 패키지 추가는 `npx expo install <pkg>` 로 (SDK 호환 버전 자동 선택). 커밋 전 확인할 것은 `../docs/HANDOFF.md` §3

## 폴더 구조

```
src/
  app/           # 화면 경로(파일 = 화면). (service)/ 로그인 후 탭·거래·카테고리, auth/, onboarding/, 공개 페이지
  service/       # 실제 서비스 화면 구현·세션·API 클라이언트(api/client.ts)·설정(config.ts)
  components/    # 공통 UI (ui.tsx, Toast, CharacterStage, TodayHeroView, Donut ...)
  theme/         # 색상·폰트 토큰
  utils/         # 날짜·금액 포맷
e2e/             # Playwright — 실제 서비스 흐름
```

## 시연

시연(예시 데이터, 계좌 연결·AI 분석 같은 미구현 기능 포함)은 2026-10-19에 웹사이트 저장소 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web)로 옮겼다. 주소는 `https://flexable-web-delta.vercel.app/m`이고, 웹 시작 화면 하단 "시연 보기"가 그곳으로 연결된다.

## 배포 (Vercel)

Vercel 프로젝트의 **Root Directory = `frontend`**. `vercel.json` 설정대로 빌드한다(Build: `npx expo export -p web`, Output: `dist`, SPA rewrite). `main`에 머지하면 자동 배포된다.

`vercel.json`의 redirect는 옛 시연 주소(`/demo/*`와 그 전의 `/plan`, `/tx/:id` 등)를 새 웹사이트의 `/m/...`로 넘기는 임시(307) 호환이다. 남겨 둔 이유는 [`../docs/FEATURES.md`](../docs/FEATURES.md) "호환 경로 결정 기록".

앱 빌드·원격 업데이트는 [`../docs/HANDOFF.md`](../docs/HANDOFF.md) §4-2.
