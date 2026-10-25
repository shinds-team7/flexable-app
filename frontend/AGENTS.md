# 프론트엔드(Expo) 지침

루트 `AGENTS.md`의 공통 지침에 더해 `frontend/`에서만 지킬 것. Expo(React Native) + Expo Router로 한 코드에서 Android와 웹을 만든다. 모바일 우선, Android·웹 양쪽에서 동작해야 한다.

## 명령

```bash
npm ci
npx tsc --noEmit            # 타입 검사
npx expo lint               # 린트
npm run test:unit           # 단위 테스트(test/*.test.cjs)
npx expo export -p web      # 웹 빌드 → dist/
npx playwright test         # E2E(e2e/*.spec.ts). 로컬 백엔드(8080)와 웹(8081, npm run web)을 먼저 띄운 뒤
npx expo install <package>  # 패키지 추가는 항상 이것으로(SDK 호환 버전). npm/yarn add 쓰지 않음
npx expo-doctor             # 의존성·설정 진단
```

끝냈다고 말하기 전에 타입 검사·린트·단위 테스트를 돌린다. 화면 흐름을 바꿨으면 E2E도 돌린다(CI는 정적 웹 빌드 + H2 백엔드로 돌린다).

## 컨벤션

- **Expo는 SDK마다 API가 바뀐다. 기억에 기대지 않는다.** `package.json`의 `expo` 주 버전을 보고 그 버전 문서(`https://docs.expo.dev/versions/v<major>.0.0/`)를, 그 밖은 https://docs.expo.dev/llms.txt 를 읽고 쓴다.
- 경로: 모든 화면 이동은 Expo Router다. 화면 파일은 `src/app/`에만 두고(파일 하나 = 화면 하나, `_layout.tsx`는 네비게이터), 화면 구현·세션·API 호출은 `src/service/`, 공통 UI는 `src/components/`에 둔다. `Link`·`router`·`useLocalSearchParams`는 `expo-router`에서 가져온다.
- 공통 UI(`src/components`)는 값을 props로 받아 표시만 한다. API 호출은 `src/service/api/client.ts`를 거친다.
- 금액은 서버가 준 값을 그대로 표시하고 화면에서 다시 계산하지 않는다.
- 저장 → 화면 이동이 있는 화면은 [Android 빈 화면 버그의 재발 방지 규칙](../docs/bug-transaction-edit-blank-screen.md#재발-방지-규칙)을 지킨다(plain `View`에 조건부 prop 주지 않기, 떠나는 성공 경로에서 상태 바꾸지 않기). 영상은 [코스튬 영상 오류 기록](../docs/bug-outfit-video-lifecycle.md)처럼 해제된 플레이어를 다시 부르지 않는다.
- `ios/`·`android/`는 자동 생성 폴더라 직접 만들거나 고치지 않는다. 네이티브 설정은 `app.json`과 config plugin으로 한다. 네이티브 모듈을 더하면 Expo Go가 아니라 개발 빌드(`npx expo run:android`)에서 확인하고, 앱 배포는 새 빌드가 필요하다(루트 [ARCHITECTURE](../docs/ARCHITECTURE.md#배포-갈래)).
- 패키지를 바꾸면 커밋 전에 `package-lock.json`을 [HANDOFF §3](../docs/HANDOFF.md#3-새-pc-준비)대로 확인한다(Windows에서 `@emnapi/*` 누락, npm 10 `npm ci --dry-run`).
- `EXPO_PUBLIC_` 값은 번들에 그대로 들어가므로 비밀 값을 넣지 않는다.
- EAS 빌드·제출·production 원격 업데이트는 사람이 실행한다(HANDOFF §4-2). EAS CLI는 `npx eas-cli@latest <command>`로 부른다.
