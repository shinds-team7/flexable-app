# 버그: 거래 수정 저장 후 빈 화면 → 뒤로가기 시 앱 종료

정리 2026-10-14. **원인 확인·수정 완료(에뮬레이터 개발 빌드).** 실기기 확인은 남음(아래 "남은 일").

## 증상 (preview APK, EAS 빌드 4 · 커밋 `fe61447`, 실기기)

1. 거래 내역 → 거래 하나 눌러 상세(`/transactions/[id]`) 진입
2. 항목 하나를 고치고 **저장**
3. 앱이 꺼지지는 않지만 회색/흰색 **빈 화면**이 뜬다(React 화면이 아니라 네이티브 창 배경)
4. 이 상태에서 **뒤로가기 → 앱 종료**

이전 빌드에서는 같은 동작에서 앱이 바로 꺼졌다. `CrashScreen`(ErrorBoundary)도 뜨지 않았다.

## 원인

네이티브(Fabric) 마운트 오류다. JS 렌더 오류가 아니라서 ErrorBoundary가 잡지 못한다. 개발 빌드에서는 빨간 화면, 닫으면 실기기와 같은 회색 빈 화면이 된다.

```
IllegalStateException: addViewAt: cannot insert view [1070] into parent [1178]:
View already has a parent: [1164]   (SurfaceMountingManager.addViewAt)
```

`TransactionForm`의 입력 묶음 View가 `pointerEvents={busy || uncertain ? "none" : "auto"}`였다. Fabric은 `pointerEvents="none"`인 View는 네이티브 뷰로 만들고, `"auto"`이고 배경·테두리가 없는 View는 납작하게(flatten) 없앤다(`ViewShadowNode.cpp`의 `formsStackingContext`). 그래서 저장할 때마다

- `busy=true` → 네이티브 뷰가 새로 생기고 입력 필드들이 그 안으로 옮겨짐
- 저장 완료 → `goBack()`으로 화면이 빠지는 도중 `finally`의 `setBusy(false)` → 다시 납작해지며 필드들이 원래 부모로 옮겨짐

이 재배치가 화면 전환과 겹치면 네이티브 뷰 계층이 어긋나 위 오류가 난다. 간헐적이다.

## 수정

입력 묶음 View에 `collapsable={false}`를 줘서 항상 네이티브 뷰로 남긴다. `busy`가 바뀌어도 prop만 바뀌고 재배치가 없다(`frontend/src/service/TransactionForm.tsx`). 같은 패턴(`pointerEvents` 토글)은 코드에서 이곳뿐이다.

## 검증 (에뮬레이터 Android 15, 개발 빌드, 로컬 백엔드)

같은 조작(상세 진입 → 시간 피커로 시간 변경 → 저장 → 목록 순서가 바뀜)을 반복했다.

| | 결과 |
|---|---|
| 수정 전 | 4번 중 3번 오류 |
| 수정 후 | 8번 중 0번 오류, 서버에 매번 저장 반영 |

조건별로는 금액만 수정·저장, 순서만 바뀌는 저장, 피커만 열었다 닫기, 뒤로가기만에서는 수정 전에도 오류가 안 났다. 피커로 시간을 바꾸고 저장해 목록 순서가 바뀔 때 주로 났다(타이밍을 바꾸는 조건으로 보인다). `npx tsc --noEmit`, `npx expo lint` 통과. 웹은 `collapsable`을 무시하므로 영향 없다.

## 재현 방법 (다시 볼 때)

```bash
# 1) 백엔드 (H2). API 경로는 /api/v1
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
# 2) 에뮬레이터: GPU 오류로 꺼지면 -gpu swiftshader_indirect, adb가 못 잡으면 콜드 부트(-no-snapshot-load)
emulator -avd flexable -no-snapshot-load -no-audio -gpu swiftshader_indirect
# 3) 개발 빌드 (ANDROID_HOME 필요, 첫 빌드 약 14분, android/ 폴더 생김 — gitignore 대상)
cd frontend
ANDROID_HOME=$LOCALAPPDATA/Android/Sdk EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npx expo run:android --port 8082
# 4) 오류 확인
adb logcat -d | grep "already has a parent"
```

- 로컬 H2는 재시작하면 비므로 API로 가입 → `PUT /budget/settings` → 거래 2건부터 다시 만든다(한글 제목은 Git Bash curl에서 인코딩 오류가 나니 영문으로).
- `CI=1`로 띄운 Metro는 파일 변경을 반영하지 않는다. 코드를 바꾸면 Metro를 다시 띄운다(`npx expo start --dev-client --port 8082`).
- **끝나면 `frontend/android/`를 지우고 `package.json`의 `android`/`ios` 스크립트 변경을 되돌린다.** 남아 있으면 EAS Update/Build가 bare 프로젝트로 보고 `runtimeVersion` 정책이 어긋날 수 있다.

## 남은 일

preview 채널 원격 업데이트로 실기기에서 같은 조작 확인(HANDOFF §4-2) → production 승격.
