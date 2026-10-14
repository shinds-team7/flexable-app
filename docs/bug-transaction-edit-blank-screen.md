# 버그: 저장 후 빈 화면 → 뒤로가기 시 앱 종료 (수입 저장 · 거래 수정)

정리 2026-10-14. PR #23·#25 수정분을 **production 원격 업데이트로 게시했다. Play 내부 테스트 실기기 수신·동작 검증은 대기 중이다**(아래 "Play 앱 반영 상태").
다른 화면을 만들 때 같은 일을 막으려면 맨 아래 "재발 방지 규칙"을 본다.

## 증상

Android 실기기(preview APK 빌드 4, Play 내부 테스트 versionCode 5)에서 둘 다 같은 모양으로 난다.

| 화면 | 조작 |
|---|---|
| 수입 입력(`/transactions/new?type=INCOME`) | 금액·카테고리·내용 입력 → **저장** |
| 거래 상세(`/transactions/[id]`) | 거래 내역에서 항목을 눌러 들어가 수정 → **저장** |

1. 저장 요청은 서버에 반영된다.
2. 이전 화면으로 돌아가지 않고 회색/흰색 **빈 화면**이 뜬다. React 화면이 아니라 네이티브 창 배경이다.
3. 이 상태에서 **뒤로가기 → 앱 종료**.

두 화면 모두 같은 컴포넌트 `frontend/src/service/TransactionForm.tsx`를 쓴다. 수입 입력은 새 거래(`POST`), 상세는 수정(`PATCH`)이라는 점만 다르다. 지출 입력도 같은 코드라 같은 위험이 있다. `CrashScreen`(ErrorBoundary)은 뜨지 않는다.

## 원인

JS 오류가 아니라 **네이티브(Fabric) 마운트 오류**다. 그래서 ErrorBoundary가 잡지 못한다. 개발 빌드에서는 빨간 화면이 뜨고, 닫으면 실기기와 같은 빈 화면이 된다.

```
IllegalStateException: addViewAt: cannot insert view [1070] into parent [1178]:
View already has a parent: [1164]   (SurfaceMountingManager.addViewAt)
```

### 무엇이 겹쳤나

저장 흐름은 다음과 같다.

```
저장 누름 → setBusy(true) → API 요청 → 성공 → goBack() (화면이 빠지기 시작)
                                               └→ finally: setBusy(false) (빠지는 화면을 다시 렌더)
```

입력 필드를 묶은 View가 `pointerEvents={busy || uncertain ? "none" : "auto"}`였다. 새 아키텍처(Fabric)는 렌더할 때 **View 납작화(view flattening)**를 한다. 배경·테두리·투명도·`pointerEvents` 같은 속성이 없는 View는 네이티브 뷰를 만들지 않고 자식을 위 부모에 바로 붙인다(`ViewShadowNode.cpp`의 `formsStackingContext`/`formsView`). 따라서

- `busy=true` → `pointerEvents="none"` → 네이티브 뷰가 **새로 생기고** 입력 필드들이 그 안으로 옮겨진다.
- 저장 성공 → `goBack()`으로 화면이 빠지는 도중 `setBusy(false)` → `"auto"` → 다시 **납작해지며** 필드들이 원래 부모로 옮겨진다.

이 재배치 명령이 화면 전환(react-native-screens가 화면을 떼어내는 작업)과 같은 프레임에 겹치면, Android 쪽 뷰 계층과 Fabric이 생각하는 계층이 어긋난다. 그래서 "이미 부모가 있는 뷰를 다른 부모에 넣으라"는 명령이 실패한다. 마운트가 중단된 화면은 그리지 못해 빈 화면이 되고, 그 상태에서 뒤로가기로 화면 스택을 또 바꾸면 앱이 종료된다.

간헐적이다. 타이밍이 바뀌는 조건(시간 피커로 시간을 바꿔 목록 순서가 바뀜, 저장 직후 목록이 다시 그려짐)에서 자주 났다. 에뮬레이터 개발 빌드에서 수정 전 4번 중 3번 났다. 실기기 release 빌드는 더 빨라서 더 자주 겹치는 것으로 보인다(추정).

### 정리하면 원인은 두 가지가 겹친 것이다

1. **납작화 여부를 바꾸는 prop을 상태에 따라 토글**했다(`pointerEvents` none ↔ auto). 그 결과 자식 재배치가 일어났다.
2. **떠나는 화면의 상태를 바꿨다.** 이동(`goBack`)을 시작한 뒤 `finally`에서 `setBusy(false)`를 불러, 전환 중인 화면을 다시 렌더했다.

둘 중 하나만 없어도 이번 오류는 나지 않는다. 둘 다 없앴다.

## 수정

`frontend/src/service/TransactionForm.tsx`

1. 입력 묶음 View에 `collapsable={false}`(PR #23, `25381c4`). 항상 네이티브 뷰로 남으니 `busy`가 바뀌어도 prop만 바뀌고 재배치가 없다.
2. 저장·삭제가 **성공하면 `busy`/잠금을 풀지 않는다**(PR #25, `8416c69`). `finally`를 없애고 실패(`catch`)에서만 `unlock()`한다. 성공하면 화면이 곧 사라지므로 풀 필요가 없다. 풀지 않으니 전환 중 다시 렌더할 일도 없고, 전환 도중 저장 버튼을 또 누르는 일도 막힌다.

웹은 `collapsable`을 무시하고, 성공 시 화면이 바로 바뀌므로 동작 차이가 없다.

## Play 앱 반영 상태

Play 내부 테스트 versionCode 5 AAB에 내장된 코드는 수정 전 코드다. EAS 조회로 빌드 커밋 `fe61447`, 채널 `production`, 런타임 `1.0.0`을 확인했다. 해당 커밋은 `expo-updates`를 추가한 PR #19를 포함한다.

- versionCode 5 AAB는 수정 커밋(`25381c4`, 10-14 17:26)보다 먼저 빌드·업로드됐다. 업로드 기록이 그 수정 커밋에 함께 들어가 있다.
- 2026-10-14 최신 main `1c0028e`를 `ucmnuniverse` 계정으로 `production` 채널·환경, Android 런타임 `1.0.0`에 게시했다. PR #23·#25 수정과 PR #26 캐릭터 홈 변경을 포함한다.
- 업데이트 그룹: [538a3d2d-c521-420c-9cc8-6d5b506a1c84](https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/updates/538a3d2d-c521-420c-9cc8-6d5b506a1c84). Android 업데이트 ID: `01a13a58-4491-7ad8-b978-efb504cdf459`.

네이티브 변경이 없어 새 AAB 대신 원격 업데이트로 게시했다. 테스터는 인터넷이 연결된 상태에서 앱을 실행해 업데이트 다운로드 시간을 준 뒤, 앱을 완전히 종료하고 다시 실행한다. 그 후 아래 저장 동작을 검증한다.

게시 전 타입 검사·린트 및 Android 번들 생성은 통과했고, 게시 후 `eas update:view`로 업데이트 그룹과 런타임을 재확인했다. 실기기 수신·동작 성공 여부는 아직 확인하지 않았다.

## 검증

| 환경 | 조작 | 결과 |
|---|---|---|
| 에뮬레이터 Android 15, 개발 빌드, 수정 전 | 상세 → 시간 변경 → 저장 | 4번 중 3번 오류 |
| 같은 환경, 수정 1 적용 | 같은 조작 | 8번 중 0번, 서버에 매번 반영 |
| 수정 2 | `npx tsc --noEmit`, `npx expo lint` | 통과. 이 PC에는 Android SDK가 없어 기기 검증은 못 함 |

남은 검증(원격 업데이트 후 Play 앱에서):

- [ ] 수입 저장 → 이전 화면 복귀 → 뒤로가기, 5회 이상
- [ ] 거래 상세 수정(시간 변경 포함) → 저장 → 뒤로가기, 5회 이상
- [ ] 지출 저장, 거래 삭제 각 2회
- [ ] 카테고리 미선택 저장 → "카테고리, 내용, 날짜와 시간을 확인해 주세요"가 뜨고 화면이 유지되는지
- [ ] 비행기 모드에서 저장 → 오류 문구, "다시 시도" 버튼이 눌리는지(실패 시 잠금이 풀리는지)

## 다른 화면 점검 결과 (10-14)

| 패턴 | 위치 | 판단 |
|---|---|---|
| `pointerEvents`를 상태로 토글 | `TransactionForm.tsx`뿐 | 수정됨 |
| `pointerEvents` 고정값 | `components/Toast.tsx` (`box-none`) | 바뀌지 않으므로 안전 |
| `opacity`를 상태로 토글 | `CharacterHero`, `WeekCalendar`, `Toast`, `TodayHeroView` | 모두 `Pressable`(접근성 속성 때문에 항상 네이티브 뷰)이라 납작화가 바뀌지 않음. 안전 |
| 이동 후 `finally`에서 `setBusy(false)` | `AuthScreen`, `OnboardingScreen`, `DeleteAccountScreen`, `MyScreen` | `busy`가 버튼 문구·색만 바꾸고 뷰 구조는 안 바꿔 지금은 안전. 다만 규칙 2에 어긋나므로 해당 화면을 고칠 때 함께 정리 |

## 재발 방지 규칙

새 화면이나 저장 흐름을 만들 때 지킨다.

1. **plain `View`에 납작화 여부를 바꾸는 prop을 조건부로 주지 않는다.** `pointerEvents`, `opacity`, `transform`, `backgroundColor`, `borderWidth`, `overflow`, `zIndex`, `elevation`, `nativeID`, `onLayout`처럼 조건에 따라 생겼다 없어지는 경우다. 꼭 필요하면 그 View에 `collapsable={false}`를 준다. 이미 배경이 있는 View나 `Pressable`은 항상 네이티브 뷰라 괜찮다.
2. **화면을 떠나는(`router.back`/`replace`/`push`) 성공 경로에서는 그 화면의 상태를 바꾸지 않는다.** 로딩 해제는 `finally`가 아니라 실패 경로에서 한다.
3. **입력 잠금은 `pointerEvents` 대신 각 입력의 `disabled`/`editable={false}`로 하는 것을 먼저 고려한다.**
4. 저장 → 화면 이동이 있는 기능은 **Android 실기기 또는 release 빌드**에서 5회 이상 반복해 확인한다. 웹·Expo Go·iOS에서는 이 오류가 나지 않는다.
5. 빈 화면인데 ErrorBoundary가 안 뜨면 JS가 아니라 네이티브 문제다. `adb logcat`에서 `SurfaceMountingManager`, `already has a parent`, `IllegalStateException`을 먼저 찾는다.

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
