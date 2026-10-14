# 버그: 거래 수정 저장 후 빈 화면 → 뒤로가기 시 앱 종료

정리 2026-10-14. 원인 미확정, 재현 전. 다른 세션에서 이어서 볼 때 이 문서부터 읽는다.

## 증상 (preview APK, EAS 빌드 4 · 커밋 `fe61447`, 실기기)

1. 거래 내역 → 거래 하나 눌러 상세(`/transactions/[id]`) 진입
2. 항목(금액·내용 등) 하나를 고치고 **저장**
3. 앱이 꺼지지는 않지만 **빈 화면**이 뜬다. 색은 회색 또는 흰색이고 시스템 테마(다크/라이트)에 따라 다르다 → React 화면이 아니라 네이티브 창 배경으로 보인다
4. 이 상태에서 **뒤로가기 → 앱 종료**(내비게이션 히스토리가 비어 있는 것처럼 동작)

이전 빌드에서는 같은 동작에서 앱이 바로 꺼졌다. PR #15 이후 `CrashScreen`(ErrorBoundary)이 들어가 "오류 화면이 뜰 것"으로 기대했지만 오류 화면도 뜨지 않는다.
저장(PATCH) 자체가 서버에 반영되는지는 아직 확인 안 함.

## 관련 코드

- 저장 흐름: `frontend/src/service/TransactionForm.tsx` `done()`
  ```ts
  session.invalidate();   // Session의 revision +1 → useResource 쓰는 화면 전부 재조회
  toast(message);
  goBack("/transactions"); // router.canGoBack() ? router.back() : router.replace(fallback)
  ```
- `goBack`: `frontend/src/components/SubHeader.tsx`
- 재조회: `frontend/src/service/ui.tsx` `useResource` — `useFocusEffect` 안에서 `revision`이 바뀌면 다시 불러옴
- 라우트 구조
  - `src/app/_layout.tsx`: Stack + Toast/Session/BudgetDraft Provider, `ErrorBoundary = CrashScreen`
  - `src/app/(service)/_layout.tsx`: `Guard` → Stack, `ErrorBoundary = CrashScreen`
  - `src/app/(service)/(tabs)/_layout.tsx`: `Guard budget` → Tabs(`backBehavior="history"`, 탭바 숨김)
  - `src/app/(service)/transactions/[id].tsx` → `TransactionForm`
- 거래 목록: `src/service/TransactionsScreen.tsx` (`toSeoulInput(t.occurredAt)`로 날짜 그룹)
- 상세 화면은 `Page`(`KeyboardAvoidingView`, Android `behavior="height"`) 안에 있다

## 가설 (검증 안 됨)

1. **같은 틱의 상태 변경 + `router.back()`**: `invalidate()`로 Provider 아래 전체가 다시 렌더되는 중에 native-stack pop이 일어나 react-native-screens가 화면을 잃는 경우. 빈 화면 + 뒤로가기 시 종료와 잘 맞는다.
   → 시험: `goBack()`을 먼저 하고 `invalidate()`를 다음 틱(`setTimeout`/`InteractionManager.runAfterInteractions`)으로 미루기
2. **렌더 오류인데 ErrorBoundary가 못 잡음**: 돌아간 목록 화면이나 `CrashScreen` 자체에서 오류가 나서 루트가 비는 경우. 수정 후의 `occurredAt` 형식(`...:00+09:00`)이 목록의 `toSeoulInput`에서 문제가 되는지 확인.
3. **키보드가 열린 채 이동**: 필드를 고친 직후라 키보드가 올라와 있다. `KeyboardAvoidingView`(height) + 화면 전환이 겹칠 때만 생기는지 확인(키보드를 닫고 저장하면 괜찮은지).

## 재현 방법

운영 데이터를 건드리지 않도록 로컬 백엔드 + 개발 빌드로 본다.

```bash
# 1) 백엔드 (H2). API 경로는 /api/v1
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
# 2) 에뮬레이터 앱 (첫 빌드는 NDK 설치로 오래 걸림, android/ 폴더가 생김 — gitignore 대상)
cd frontend
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npx expo run:android --port 8082
# 3) 로그
adb logcat -s ReactNativeJS AndroidRuntime ReactNative
```

- 로컬 H2는 재시작하면 비므로 가입 → 온보딩 → 거래 1건 기록부터 다시 한다.
- Expo Go는 "Fetching Expo Go"에서 멈춰서 쓰지 못했다. datetimepicker가 네이티브 모듈이라 어차피 개발 빌드가 맞다.
- **끝나면 `frontend/android/`를 지운다.** 남아 있으면 EAS Update/Build가 bare 프로젝트로 보고 `runtimeVersion` 정책이 어긋날 수 있다. `expo run:android`는 `package.json`의 `android`/`ios` 스크립트도 `expo run:*`으로 바꾸니 커밋하지 않는다.
- 운영 서버를 쓰는 preview APK로 볼 때는 테스트 계정으로만 한다.

## 사용자에게 물어볼 것

- 저장 후 빈 화면 → 앱을 다시 켰을 때 수정 내용이 반영돼 있는가 (PATCH 성공 여부)
- 아무것도 안 고치고 저장해도 같은가, 키보드를 닫고 저장해도 같은가
- 거래 **삭제**나 **새 거래 기록**(같은 `done()`을 씀)에서도 같은가

## 고친 뒤

`npx tsc --noEmit`, `npx expo lint`, 로컬 E2E(`npx playwright test`) 통과 → preview 채널 원격 업데이트로 실기기 확인(HANDOFF §4-2) → production 승격.
