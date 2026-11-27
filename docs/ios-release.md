# iPhone App Store 첫 제출

## 앱 등록과 빌드

1. Apple Developer 팀에서 명시적 Bundle ID `com.flexable.app`의 사용 가능 여부와 팀 소유권을 확인하고 App Store Connect에 한국어 iOS 앱을 등록한다. 이미 다른 팀이 차지했다면 등록 전에 `frontend/app.json`과 빌드 검사를 함께 수정한다. 앱 이름은 텅장관리, 버전은 `app.json`의 `version`이다. 배포 인증서, 프로비저닝 프로파일, App Store Connect 키와 심사 계정 암호는 공개 저장소에 올리지 않는다.
2. PR의 iPhone Release 검사는 Xcode 26 계열로 서명 없이 iPhone Release를 컴파일하고 내장 JS 번들·Pod 목록을 확인한다. Mac에서 재현하려면 `frontend/`에서 `npm ci`, `npx expo prebuild -p ios`, 생성된 xcworkspace의 Release 빌드 순으로 진행한다. Expo SDK 57의 지원 범위는 iOS 16.4 이상, Xcode 26.4 이상이다. [Expo SDK](https://docs.expo.dev/versions/v57.0.0/) · [Apple SDK 제출 기준](https://developer.apple.com/news/upcoming-requirements/)
3. 운영자가 EAS production 환경의 `EXPO_PUBLIC_API_URL`이 앱 서버의 HTTPS 주소인지 확인한다. `frontend/`에서 `npx eas-cli@latest build --platform ios --profile production`으로 배포 서명 빌드를 만든다. 첫 빌드에서 팀과 인증서를 선택한다. 이후 빌드 번호는 EAS가 올린다.
4. 운영자가 `npx eas-cli@latest submit --platform ios --profile production --id <이번 iOS 빌드 ID>`로 해당 바이너리를 TestFlight에 올린다. App Store Connect 처리가 끝나면 아래 항목을 확인하고 같은 빌드를 심사 버전에 연결한다. 등록번호·심사 연락처·세금 및 계약 정보·수출 규정 답변은 본인 계정에서 확정한다.

## TestFlight 확인

- 처음 설치한 iPhone에서 한국어 시작 화면 → 이메일 가입·로그인 → 예산 설정 → 홈 예산 → 지출 한 건 등록·수정 → 분석 → 앱을 종료하고 다시 열어 세션·금액 확인.
- 초기 설정의 고정지출 단계에서 테스트용 거래내역서 PDF를 골라 가져오기·취소를 확인한다. 실제 고객 자료는 쓰지 않는다.
- 수입일·기록 알림의 권한 허용·거절, 시간 선택과 알림 탭 이동, 코스튬 재생·구매, 웹 연동 해제를 확인한다. 상점에서 광고 보상, 거래 추가에서 스크린샷·음성, 마이에서 카드 자동 기록·상시 알림이 보이면 제출 전에 수정한다.
- AI 메이트에서 [나중에]를 누르면 대화가 전송되지 않아야 한다. 다시 들어가 [동의하고 대화하기] → 텍스트 질문 → 제안 반영을 확인한다. 마이 → 계정 삭제에서 별도의 테스트 계정을 삭제하고 같은 계정 로그인이 거절되는지 확인한다.
- 제출할 iPhone 빌드의 홈·거래 기록·소비 분석 화면을 가상 데이터로 캡처한다. 첫 제출의 앱 미리보기에는 Android 알림창이나 결제 자동 기록 화면을 사용하지 않는다. [Apple 스크린샷 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

## 스토어 입력 초안

| 항목 | 입력 내용 |
|---|---|
| 이름 / 부제 | 텅장관리 / 다음 수입일까지 오늘 쓸 수 있는 돈 |
| 카테고리 / 가격 | 금융 / 무료 |
| 설명 | 잔액과 다음 수입일, 고정지출을 입력하면 오늘 쓸 수 있는 돈을 알려 드려요. 수입·지출을 기록하고 소비 내역을 카테고리별로 살펴보세요. 예산은 입력한 잔액·기록 기준 추정이에요. 출석과 예산 기록으로 모은 코인으로 캐릭터를 꾸밀 수 있어요. |
| 키워드 | 가계부,생활비,지출기록,예산,수입,저축,소비분석 |
| 개인정보 / 지원 | https://project2-flex-sh.vercel.app/privacy · https://project2-flex-sh.vercel.app/support |
| 심사 메모 | 이메일 계정으로 로그인하면 홈에서 예산을 확인할 수 있습니다. 하단 +에서 직접 거래를 등록하고 분석 탭에서 결과를 확인해 주세요. 예산은 직접 입력한 금액에 기반합니다. AI 메이트의 데이터 전송은 선택 사항입니다. 계정 삭제는 마이 → 계정 삭제에서 가능합니다. 코인은 앱 안에서만 사용합니다. |

심사 전용 이메일 계정에 가상 예산과 거래를 넣어 유지하고 자격 증명은 App Review Information에만 입력한다. 공개 개인정보처리방침과 이용약관의 iOS 적용 안내가 게시됐는지 확인한다. 약관상 최소 연령은 만 14세다. 연령 등급 설문에는 실제 기능을 답하고 필요한 최소 연령을 적용한다. [Apple 심사 정보](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review)

## App Privacy 입력 근거

| iPhone 데이터 흐름 | 제출 때 확인할 유형 · 목적 |
|---|---|
| 이메일, 서버 회원 번호 | 이메일 주소·사용자 ID, 계정 연결, 앱 기능 |
| 잔액·수입·지출·저축·PDF에서 저장한 거래, 직접 쓴 제목·메모 | 기타 금융 정보·사용자 콘텐츠, 계정 연결, 예산·기록 기능. PDF와 PDF 암호는 처리 후 폐기 |
| 출석·캐릭터·코인·웹 연동 | 제품 상호작용·사용자 ID, 계정 연결, 앱 기능 |
| 선택한 AI 대화 | 사용자 콘텐츠와 예산 요약을 Google Gemini에 전송. 운영자와 처리 업체의 실제 보관 기간 및 Apple의 실시간 처리 정의를 함께 확인 |
| 오류 보고·Expo 업데이트 | 오류·진단 데이터, 로그인 시 회원 번호, Expo 설치 식별자·IP 및 업데이트 정보. 장애 대응·업데이트 제공 목적. 식별자 연결 여부를 수신자별로 확인 |
| 고객지원 | 이용자가 보낸 이메일 주소·문의 내용과 지원 처리 목적 확인 |

iPhone 빌드에는 광고 SDK·광고 식별자와 앱 간 추적이 없다. 서명한 아카이브에서 Xcode Privacy Report를 만들고 SDK manifest, 공개 방침, 서버와 처리 업체의 실제 수집·연결·보관을 대조한 뒤 App Store Connect 답변을 확정한다. 데이터 수집 여부는 계정과의 연결 여부와 별개로 답한다. [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
