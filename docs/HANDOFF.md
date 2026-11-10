# 인수인계 — 텅장관리 앱 (Play 프로덕션 2.0.0)

마지막 갱신 2026-11-10. 이 문서는 **지금 상태와 남은 일**만 적는다. 끝난 작업의 상세 기록(게시 그룹 ID, 날짜별 로그, 실기기 확인 내역)은 `git log`·PR·[`CHANGELOG.md`](CHANGELOG.md)에 있다(11-07 원격 업데이트 기록이 다 있는 판은 커밋 `ffa6903`). 기능별 현재 동작은 [`FEATURES.md`](FEATURES.md).

**코드 병합과 운영 반영은 다르다.** 배포(서버 `deploy.sh`, EAS 게시·빌드 제출, Play 업로드)는 사람이 직접 한다.
**저장소는 공개(PUBLIC)다.** 비밀값(키 파일, 비밀번호), 개인 계정 경위, 사용자 이메일은 여기에 적지 않는다.

## 1. 지금 상태

| 영역 | 상태 |
|---|---|
| 코드 | 앱 **`4f3369c`**(#346 스플래시 진입점 보강 병합), 앱 2.0.0. 서버는 #344 `d1fce4b` 배포본 유지. 웹 호환 #384도 병합·운영 반영 완료 |
| 2.0.0 빌드·출시 확인 | **2.0.0(versionCode 23) 검토 제출 후 업데이트 게시 완료를 Play Console에서 확인(11-09, 사용자 회신)**. 이전 트랙 요약만으로 게시 완료로 판단했던 기록을 정정한다. EAS production AAB 빌드 `819bfa79-c026-4702-a065-c47a0cbdd23d`, 소스 `d8a823d`. 기기 설치·재생은 별도 미확인. `minVersion`은 사용자 요청으로 2.0.0 상향(#316 병합·운영 웹 반영 완료, 공개 URL 확인) |
| 최신 원격 업데이트 | production **runtime 2.0.0 `37af50b3-c702-4436-b721-52500c7b261e`**, 소스 `4f3369c`(#346), 11-10 14:17 KST 게시. Android production manifest 일치, **JS·에셋 72개 HTTP 200·SHA-256 일치**. 게시 소스맵에서 Router보다 먼저 자동 숨김 방지 호출·SplashScreen.native 연결 확인. #344 변경도 포함. 스플래시 최소 1초 실제 표시·영상 재생은 실기기 미확인 |
| 현재 운영 앱 | **Play 프로덕션 2.0.0(versionCode 23)**, 검토 제출 후 게시 완료 사용자 확인(11-09). 2.0.0에는 최신 통합 원격 업데이트 제공, 1.9.0은 기존 게시본 유지. 사용자 명시 요청에 따라 `minVersion` **2.0.0** 반영 완료(#316, 11-09 공개 `/app-version.json` 확인) |
| 마이크 권한 경고 | 1.8.0부터 `RECORD_AUDIO` 때문에 Play가 마이크 없는 기기 약 20종을 지원하지 않는다고 경고한다. 영향이 작아 그대로 둔다(11-07 사용자 결정). 고치려면 `android.hardware.microphone`을 `required="false"`로 선언하는 config plugin과 새 빌드 |
| 서버 | **11-10 13:20 KST 아카데미 VM 배포 완료**, 소스 `d1fce4b`(#344 병합본 `3db9737`과 backend 동일). V28 누적 7일 이상 출석자의 outfit-06 누락 복구·V29 시드머니 총액 정정 적용. 기존 보상·기록 유지, EC2 중계·비밀값 변경 없음 |
| 서버 배포 검증 | 11-10 13:15 KST DB 백업·gzip 무결성 확인, 기존 JAR 보관. 로컬 백엔드 **192개 통과(정책·계약·마이그레이션·동시 정정 포함, 실패·오류·건너뜀 0)**, 프론트 타입·린트·API 타입 일치·단위 113개·고유 브라우저 시나리오 26개 통과. #344 PR 전체 CI 통과 후 배포, 병합본 `3db9737` main CI도 통과. V28→V29 적용 성공·기동 로그, API/DB healthy·내부/외부 health 전부 UP, 로컬/서버 JAR SHA-256 `7cb28fd407d85f51ee88c7a8846fadafe4dc3072ae7eb11ec925e2629a1d954f` 일치. 새 총액 API 무인증 401 확인. 운영 사용자별 소유권 직접 조회·실제 총액 수정·실기기는 미확인 |
| 웹 | 앱 웹 `project2-flex-sh.vercel.app`은 #344 자동 배포 완료(총액 API·잠금 이미지 연결 확인). 별도 데스크톱 웹 `flexable-web-delta.vercel.app`은 #384(`9653d32`) 자동 배포 완료, 실제 운영 JS에서 ADJUSTMENT·총액 정정 표시 확인. 웹 서버는 기존 구현이 음수 차액·10자 종류를 수용하여 별도 배포 없음 |
| 감시·CI | 서버 감시 15분 간격(`server-health.yml`), PR마다 백엔드·프론트·E2E. 오류 기록(`error_events`)은 서버 배포 뒤부터 쌓이고, 보는 법은 [`error-logs.md`](error-logs.md) |
| Play | **2.0.0(versionCode 23) 검토 제출 후 업데이트 게시 완료(11-09, 사용자 Console 확인)**. 지원 중단 API·R8 최적화 항목은 권장 조치로 표시됨. 데이터 보안 양식 반영 완료(11-08, 사용자): AI 메이트 메시지(기타 사용자 제작 콘텐츠), 마이크 권한, 앱 정보 및 성능 → 진단 |

## 2. 다음 할 일 (순서대로, 모두 사람)

1.9.0 실기기 확인 17항목은 11-08에 모두 끝났고 관련 이슈(#256·#212·#211·#209·#203·#191·#181)도 닫았다. Play 데이터 보안 양식도 11-08 반영.

| 순서 | 할 일 | 완료 기준·주의 |
|---|---|---|
| 1 | **2.0.0 설치·원격 업데이트 실기기 확인** | Play Console 게시 완료 확인(11-09). 기기 설치 버전을 확인하고 앱을 켜 둔 뒤 완전히 종료·재실행한다. Lv.2~6 영상 재생·최고 단계별 상점 해금 확인. 원격 파일 다운로드 검증과 실기기 재생 확인은 별개다 **11-10 미해결: Play 설치 2.0.0 Android 기기에서 앱을 두 번 재실행해도 #336·#340·#342 변경(마이 상시 알림 스위치 등)이 안 보임.** EAS 통계(`npx eas-cli@latest update:insights <그룹>`)상 최신 production 그룹 실행 0~1명, 크래시·실패 0. 서버는 production/2.0.0/android 요청에 새 업데이트를 내려줌. 빌드 `819bfa79`는 production 채널·런타임 2.0.0이고 네이티브 파일 변경 없음. 다음: 캐시 삭제·네트워크 변경 후 재확인, 안 되면 새 production 빌드(versionCode 올려 Play 제출). 13:22 KST 새 그룹 `1d90e9b1` 게시·72개 파일 검증 완료, 이 그룹의 실기기 적용은 재확인 필요 |
| 2 | **배포된 서버 기능 실기기 확인** | 광고 30초 초과 시 +20코인, AI 메이트 일정 금액 예측 확인. 오류 보고 API 검증 경로와 Flyway V23 생성은 확인했으나 실제 앱 오류 수집·저장·30일 정리는 아직 미확인 |
| 3 | **2.0.0 상시 알림·아이콘 실기기 확인**(#311, Issue #312) | 알림 모양, 거래 저장·예산 변경 때 금액 갱신, 자정 갱신, 앱을 닫은 채 신한 SOL페이 승인 알림이 오면 임시 차감, Android 13 권한·14 밀어서 지우기, 새 아이콘·스플래시 선명도 확인 |
| 4 | **웹 연동 시드머니 운영 응답 확인**(서비스 키 필요) | 웹은 `EXTRA` 처리를 끝냈다(11-08 웹 회신). 가짜 테스트 계정 연동 후 운영 응답의 `entries`·`startedOn`, 키 없이 401인지 확인. 운영 전체 흐름은 아직 미확인([`web-seed-entries-handoff.md`](web-seed-entries-handoff.md)) |
| 5 | **이번 원격 업데이트·서버 변경 실기기 확인**(#318·#320·#322·#324·#328·#329·#331·#336·#340·#342) | 출석 보상표·굴비 고양이 코스튬·상점 해금 정렬, 홈 카드·가이드, 분석·카테고리 드래그, 온보딩, 마이 상시 알림 스위치, 스크린샷 날짜 선택·저장 후 복귀, 키보드 재열기, Gemini 수입 등록/수정·월 수입 설정 부분 변경 확인. 실제 저장은 사용자의 [반영] 뒤에만 이루어지는지 확인. RECORD는 배포 주 기존 비중 유지·다음 월요일 갱신 확인 |

## 3. 그 다음 할 일

### 출시·Play Console
- [ ] **스토어 자세한 설명의 AI 메이트 전송처를 "OpenAI" → "Google(Gemini API)"로 고치기**(Play Console, 문구는 `play-store/README.md` §2). 금융 기능 선언(§3.7)·문의 줄·알림 권한(§3.8)은 11-08 확인 완료

### 서버·인프라
- [ ] **EC2 로컬 DB로 복귀 11-14~16 → 아카데미 VM 데이터 삭제 11-17**(계획 [`server-migration.md`](server-migration.md) §8). 복귀 뒤에는 이 PC에서 `backend/deploy/deploy.sh`로 배포할 수 있다. 개인정보처리방침 백업 문구 손보기(§9). 복귀 때 `error_events`(V23)도 함께 옮긴다(30일 보관이라 비워도 된다)
- [ ] 작업 PC 홈의 `ec2.env`·`academy.env`(비밀값)는 비밀번호 관리자로 옮기고 지운다. 되돌림용 `dump-final.sql.gz`(EC2 `~`, 작업 PC `~`)도 지운다
- [ ] 도메인 구매 → 서버 `API_DOMAIN`, `frontend/.env.production`, EAS 환경변수 `EXPO_PUBLIC_API_URL`(preview·production) 변경 → 재빌드 또는 원격 업데이트. EC2 탄력적 IP 할당(지금은 인스턴스를 멈추면 IP가 바뀜)

### 제품·기능
- [ ] 결정 대기: 홈 "Lv.1 새싹" 배지·말풍선을 넣을지(#123에서 뺌, 게이지는 기존 유지)
- [ ] Gemini API 유료 등급 전환(Google AI Studio에서 결제 연결, 나중에). 새 키를 만들면 서버 `.env`의 `GEMINI_API_KEY`를 바꾸고 `docker compose up -d`
- [ ] 2028 공휴일은 천문연구원 자료로 넣었다(#299). 2027년 6월쯤 2028 월력요항이 나오면 대조하고 임시공휴일을 더한다
- [ ] 앱 안 코인 결제는 붙이지 않는다. 붙이기로 하면 약관 제2조 4항, 통신판매업 신고, 사업자 정보 표시, 환불 규정을 함께 손본다

### 법률·문서
- [ ] Expo 항목별 보관 기간 문의(expo.dev/contact), 개인정보처리시스템 접근 기록 1년 보관 방식
- [ ] `docs/contracts/app-api.yaml`의 `GET /budget/day-weights` 요약에 남은 "부를 때마다 어제까지 기록으로 다시 낸다"를 정책 §5·11-10 결정의 월요일 적용 비중과 구분해 정정 필요. 응답 형식은 기존 계약 유지; 이번에는 배포 현황만 갱신

## 4. 코드에는 있지만 운영에 아직 없는 것

기능·수정 PR은 같은 PR에서 이 목록 끝에 한 줄을 더한다(무엇이 바뀌었는지, PR 번호, 반영 방법, 배포 순서 제약). 서버 배포가 끝나면 해당 줄을 지운다(이 파일만 고치는 변경은 PR 없이 `main`에 바로, [AGENTS.md](../AGENTS.md) "작업 완료 시").

**서버**: 11-10 13:20 KST #344 배포·V29 적용 완료. 내부·외부 health 전부 UP. 현재 main에서 확인된 서버 미배포 항목 없음.

**앱**: 11-10 13:22 KST #344까지 2.0.0 production 그룹 `1d90e9b1-2b27-42e0-9614-f01be557914b`(소스 `3db9737`) 게시 완료. 출석 보상·잠금 고양이·시드머니 두 항목/총액 수정/도움말·AI 배분 버튼·OCR 잔액 비교 개선 포함. 실제 manifest와 72개 파일 해시 검증 완료. 웹 #384 호환 반영 → 앱 서버 V28·V29 → 앱 게시 순서로 진행. 실제 기기 적용·기능 확인은 2번 목록에 남김.

온보딩 [거래내역서 PDF 등록]은 #327 전까지 **준비 중 안내**이며, 이번 사용자 요청 범위인 최신 코드 전체 게시에 포함했다. PDF 등록 기능이 배포된 것은 아니다.


- [ ] 스플래시 자동 숨김 방지 진입점 보강(#346): 11-10 14:17 KST 앱 2.0.0 production 게시 완료(`37af50b3`), 72개 파일 무결성 확인. 타입·린트·단위 114개·Android/웹 export 및 PR 전체 CI(E2E 61개, 정책·계약 포함) 통과. Ubuntu 패키지 미러에서 멈춘 첫 E2E는 취소 후 재실행 통과. 서버·새 빌드 필요 없음. 사용자 기기의 원인은 아직 확정 못 했고, 완전 종료 후 최소 1초 실제 표시는 확인 필요.
- 11-10 사용자 확인: #344 시드머니의 '반영한 돈' 문구 변경이 앱에도 적용됨. 최신 OTA가 전혀 적용되지 않는다는 이전 추정은 철회. 스플래시는 약 0.1초만 보인다는 별도 보고(#345)이며 #346 적용 뒤 재확인 필요.

- [ ] 스플래시 앱 시작 화면 1초 보장·신규 가입 500코인(#347, PR 번호 생성 후 기록): 앱 2.0.0 원격 업데이트와 서버 배포 필요, DB 마이그레이션 없음. 앱 먼저 반영 후 서버를 배포하면 옛 제목 노출을 줄일 수 있음. 이미 지급된 200코인·내역 보존, 기존 계정 추가 지급 없음. Android 표시 시간·신규 가입 지급 검증 필요.

## 5. 참고(자주 바뀌지 않는 정보)

### 5-1. 따로 챙길 것(저장소에 없음)

| 항목 | 어디에 있나 | 새 PC에서 |
|---|---|---|
| EC2 SSH 키 `sh-flex.pem` | 담당자 PC | 메신저·메일·git으로 보내지 말고 USB나 비밀번호 관리자로 옮긴다. `~/.ssh/sh-flex.pem`, 권한 600 |
| 아카데미 VM 주소·계정, SSH 설정(`academy`) | 팀 비공개 공간 | `~/.ssh/config`에 `academy` 별칭을 등록. 아카데미 네트워크 안에서만 접속된다 |
| 서버 비밀값(DB 비밀번호, JWT 비밀키, 각종 API 키) | VM `/opt/flexable/.env`에만 있음 | 옮길 필요 없음. **JWT_SECRET을 바꾸면 모든 사용자가 로그아웃된다** |
| 심사용 계정 비밀번호 | 팀 비밀번호 보관함 | Play Console 앱 액세스에 입력 |
| Expo 계정 | 조직 `ucmnuniverse-developer`(Owner 계정 `ucmnuniverse`), 프로젝트 `fb9b50f5-3e92-4eb3-8cea-1c1a149b23ef` | `npx eas-cli@latest login` |
| Play Console 개발자 계정 | — | 개인/조직 여부에 따라 14일 테스트 조건이 다름(`play-store/README.md` §1) |
| DuckDNS 계정 | 담당자 계정(`flex-able-sh`) | IP가 바뀌면 여기서 갱신 |

### 5-2. 새 PC 준비

```bash
git clone https://github.com/shinds-team7/flexable-app.git && cd flexable-app
# JDK 21, Node 22+, Git Bash, GitHub CLI(gh) 설치
cd backend && ./gradlew test
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2로 실행
cd ../frontend && npm ci
echo "EXPO_PUBLIC_API_URL=http://localhost:8080" > .env.local   # 로컬 백엔드에 붙일 때
npm run web
npx tsc --noEmit && npx expo lint && npm run test:unit
npx playwright test     # 로컬 백엔드(8080)와 웹(8081)을 먼저 띄운 뒤 실행
```

- **로컬 E2E용 웹 빌드는 로컬 API로, 캐시를 지우고 만든다**: `EXPO_PUBLIC_API_URL=http://localhost:8080 EXPO_NO_DOTENV=1 npx expo export -p web -c`. 운영 주소가 박힌 번들로 E2E를 돌리면 운영에 테스트 계정이 생긴다(10-21·10-29에 발생). E2E는 시작 전에 앱 요청 주소가 로컬이 아니면 중단한다.
- 로컬 `backend/build/localdb`의 H2 파일은 마이그레이션 번호가 바뀌면 체크섬이 어긋난다. 이때는 `--spring.datasource.url=jdbc:h2:mem:e2e;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1`로 메모리 DB를 쓴다.
- 운영 웹 빌드는 `frontend/.env.production`, 앱 빌드·원격 업데이트는 EAS 환경변수(`preview`·`production`의 `EXPO_PUBLIC_API_URL`)를 쓴다. 확인은 `npx eas-cli@latest env:list --environment production`.
- API CORS는 서버 `.env`의 `CORS_ORIGINS`로 정한다. 웹 주소를 더할 때는 `OAUTH_ALLOWED_REDIRECT_URIS`에도 `…/oauth/callback`을 더하고 `/opt/flexable`에서 `docker compose up -d`로 컨테이너를 다시 만든다(`restart`는 `.env`를 다시 읽지 않는다).
- Windows Git Bash에서 `curl -d '한글'`은 깨진다. 한글 요청은 UTF-8 파일(`--data-binary @file.json`)로 보낸다.
- Windows에서 `npx expo install`로 패키지를 추가하면 `package-lock.json`에서 `node_modules/@emnapi/core`·`runtime` 항목이 빠질 수 있다. 그대로 커밋하면 EAS(리눅스)의 `npm ci`가 실패한다. EAS는 npm 10.9.8(Node 22)로 `npm ci`를 하므로, 패키지를 바꾼 뒤에는 `package.json`·`package-lock.json`만 빈 폴더에 복사해 `npx -y npm@10.9.8 ci --dry-run --ignore-scripts`로 먼저 확인한다.

### 5-3. 빌드와 원격 업데이트 (EAS)

```bash
cd frontend
npx eas-cli@latest build -p android --profile preview      # 실기기 확인용 APK
npx eas-cli@latest build -p android --profile production   # Play 업로드용 AAB (versionCode 원격 자동 증가)
```

- 빌드 전에 `backend`에서 `./gradlew --stop`을 하고 로컬 H2 백엔드(`bootRun`)도 끈다. 로컬 DB 파일 잠금 때문에 EAS 업로드가 `EBUSY`로 실패한다.
- 빌드 목록·다운로드: https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/builds
- 새 production 빌드는 AAB를 Play에 올리고 사용자가 업데이트해야 반영된다. 아이콘·권한·네이티브 모듈 변경은 원격 업데이트로 못 보낸다.
- `runtimeVersion`은 `appVersion` 정책이다. **앱 버전이 다르면 서로 원격 업데이트를 받지 못한다**(1.5.0 앱은 1.6.0 번들을 못 받는다). 네이티브가 바뀌면 `app.json`의 `version`을 올리고 새로 빌드한다.
- **원격 업데이트**(JS·이미지·영상만): `npm run update:preview -- --message "…" --non-interactive`로 preview 게시 → 실기기 확인 → `npm run update:promote -- <preview 그룹 ID> --message "…"`로 production 승격(preview·production 환경변수가 같을 때만). 직접 게시는 `npx eas-cli@latest update --channel production --environment production --platform android --message "…" --non-interactive`. 되돌리기는 이전 그룹을 `update:republish --group <이전 그룹 ID>`로 다시 게시한다(그룹은 `update:list --branch production`).
- **`main`의 앱 버전이 운영 앱보다 높을 때**(새 빌드 준비 중) 운영 앱에 보낼 원격 업데이트는 운영 버전 시절 커밋에서 브랜치를 따서 낸다. main에서 내면 새 runtime으로 나가 운영 앱에 가지 않는다(예: 11-07 1.9.0 버전 올림 #288 뒤 1.8.0용은 `27c7220`에서 게시한 preview를 승격). 현재 main과 Play 프로덕션은 **2.0.0**이다(11-09, 사용자 검토 제출 후 게시 완료 확인). 1.9.0용은 1.9.0 호환 소스에서 따로 게시한다.
- 앱은 실행할 때 새 업데이트를 받는다. 스플래시 3초 안에 받으면 바로, 늦으면 다음 실행에 적용한다. preview APK는 `preview` 채널, Play AAB는 `production` 채널을 본다.
- **필수 업데이트**: 앱은 시작할 때와 다시 열 때(10분 간격) `frontend/public/app-version.json`의 `android.minVersion`을 읽고, 설치된 버전이 더 낮으면 닫을 수 없는 업데이트 창(Play 스토어로 이동)을 띄운다. 새 버전이 테스터 Play 스토어에 보이고 설치까지 확인한 **뒤에** minVersion을 올리는 PR을 머지한다(Vercel 자동 배포). 되돌리려면 minVersion을 내린다.
- Claude Code auto mode는 production 게시를 운영 배포로 보고 막는다. 그 메시지에서 사람이 "production 승격해"처럼 직접 시키면 실행되고, 아니면 사람이 `! <명령>`으로 직접 실행한다.
- Play 'Android 15 지원 중단 API' 경고는 React Native·Material 라이브러리 안의 코드라 설정으로 없앨 수 없다. SDK 업그레이드 때 다시 본다.

### 5-4. 서버 운영

- 운영 API: `https://flex-able-sh.duckdns.org/api/v1`. 코드 `backend/`, 계약 `docs/API.md`·`docs/contracts/`. 구성은 `backend/deploy/`(Docker Compose: api + Caddy 자동 HTTPS), 절차는 `backend/README.md`.
- **지금 배포는 `backend/deploy/academy/deploy.sh`다**(jar 빌드 → VM 업로드 → api 재기동). EC2의 `backend/deploy/deploy.sh`는 `RELAY_MODE` 때문에 멈춘다. EC2 복귀 뒤에는 다시 `backend/deploy/deploy.sh`를 쓴다.
- 배포 뒤 `/actuator/health`(앱·DB·디스크 `UP`)와 Flyway 로그의 "now at version vN"을 확인한다. 스키마 변경은 `backend/src/main/resources/db/migration/V{n}__*.sql`을 **추가**한다(배포된 파일 수정 금지, 운영 DB의 체크섬을 임의로 고치지 않는다). 코드·운영 모두 **V29**(11-10 13:20 KST 배포, V28·V29 적용 성공 로그 확인).
- **외부 감시**(`.github/workflows/server-health.yml`): 15분마다 API 상태·웹 `/privacy`·HTTPS 인증서(만료 10일 미만이면 실패)를 확인하고, 실패하면 `server-health` 라벨 이슈를 연다(정상이 되면 자동으로 닫음). 팀 알림은 이 이슈로 받는다. 공개 저장소는 60일 동안 활동이 없으면 예약 실행이 꺼지므로 Actions 탭에서 다시 켠다.
- 디스크가 부족하면(남은 300MB 미만이면 `DOWN: diskSpace`) `docker system df`로 확인하고 `sudo apt-get clean`부터 한다. `deploy.sh`는 배포마다 빌드 캐시·이전 이미지를 지운다.
- EC2: `ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99`, 보안 그룹 `flex-api-web`의 22번은 관리자 IP만 허용한다. **새 PC나 사무실에서는 공인 IP가 달라 SSH가 막히므로** 22번 소스를 새 IP로 바꾸고, 끝나면 지운다.
- 사용자 삭제는 `AccountDeletionService.deleteAll` 순서를 따른다. 직접 지우기보다 앱·웹의 계정 삭제를 쓴다.
- 운영 DB의 테스트 계정은 그대로 둔다(정리 안 함).

### 서버 이전

비용 때문에 **RDS는 삭제됐고(10-27)** 운영 API·MySQL은 신한 아카데미 앱 전용 VM(1코어·8GB, Ubuntu 22.04, Docker)에 있다. EC2는 Caddy 중계(`relay/Caddyfile`)로 `flex-able-sh.duckdns.org` 요청을 아카데미로 넘기고, **주소가 그대로라 앱·OAuth·웹 설정은 바꾸지 않았다.** 이전 기간에는 EC2에 `RELAY_MODE` 파일이 있다. VM 자동 백업은 매일 04:00(cron, `backup-db.sh`)이고 10-30에 확인했다. 단계별 명령은 [`server-migration.md`](server-migration.md).

- 11-14~16 EC2 로컬 DB(RDS 없음)로 복귀 → 11-17 VM 데이터 삭제는 위 3번 목록. 복귀 전에는 RDS로 되돌릴 수 없다.
- 개인정보처리방침에 아카데미를 수탁자로 넣지 않는다(10-26 결정, 11-18 전 EC2 복귀).
- VM에서 `sudo`는 `ssh -t academy '...'`. 터미널로 복사한 명령 끝에 `│`가 붙으면 지우고 한 줄씩 붙인다. 배포 스크립트는 jar 권한을 직접 고친다.
- [ ] 홈 카드 높이 축소·굴비 고양이 출석 코스튬·거래 삭제 버튼 배경(Issue #339): 앱 2.0.0 원격 업데이트로 반영, 서버 배포 순서 제약 없음. Android 실기기에서 카드 높이·outfit-06 해금 영상·삭제 버튼 하단 여백 확인 필요
- [ ] 상시 알림 스위치 위치 이동·삭제 버튼 색/여백(Issue #341): 앱 2.0.0 원격 업데이트로 반영, 서버 배포 순서 제약 없음. Android 실기기에서 마이 스위치 위치·알림창 표시 확인 필요
- 11-10 원격 업데이트(production, runtime 2.0.0): #336 `53aca834-86d0-41d9-bb2e-2446718da33b`, #340 `ab602d04-dd24-4840-a017-4fdc8738a430`(홈 카드 높이·굴비 고양이 outfit-06), #342 `b4a77c19-d860-41d5-9862-cb5f04ab581b`(소스 `3208b7c`, 상시 알림 스위치 이동·삭제 버튼). 다음 날 할 일: **VM에서 `backend/deploy/academy/deploy.sh`로 서버 V27 배포**(DB 백업 확인 → `/actuator/health` UP, Flyway "now at version v27" 확인 → 이 문서의 운영 서버 V26 표기를 V27로 수정). 신한 외 카드 알림 자동 기록은 Issue #334, PDF 거래내역은 #327.
