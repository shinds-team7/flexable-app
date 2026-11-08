# 인수인계 — 텅장관리 앱 (운영 1.9.0)

마지막 갱신 2026-11-08. 이 문서는 **지금 상태와 남은 일**만 적는다. 끝난 작업의 상세 기록(게시 그룹 ID, 날짜별 로그, 실기기 확인 내역)은 `git log`·PR·[`CHANGELOG.md`](CHANGELOG.md)에 있다(11-07 원격 업데이트 기록이 다 있는 판은 커밋 `ffa6903`). 기능별 현재 동작은 [`FEATURES.md`](FEATURES.md).

**코드 병합과 운영 반영은 다르다.** 배포(서버 `deploy.sh`, EAS 게시·빌드 제출, Play 업로드)는 사람이 직접 한다.
**저장소는 공개(PUBLIC)다.** 비밀값(키 파일, 비밀번호), 개인 계정 경위, 사용자 이메일은 여기에 적지 않는다.

## 1. 지금 상태

| 영역 | 상태 |
|---|---|
| 코드 | 11-08 기준 `main` `58c1654`(#304)까지. 앱 버전 1.9.0. 앱은 모두 production에 나갔고, **서버 코드는 운영보다 앞서 있다**(4번) |
| 현재 운영 앱 | **스토어 1.9.0(versionCode 22), 11-07 심사 통과·출시**, 새로 설치 크기 약 30MB(1.8.0 대비 OCR을 Play 서비스 한국어 인식으로, 글꼴 축소). EAS 빌드 `5fd74f31-d509-4b8f-a3a6-8eeff4d4383f`(소스 `f28bff3`), AAB는 작업 PC `~/Downloads/flexable-1.9.0-22.aab`(저장소에 넣지 않음). **원격 업데이트(runtime 1.9.0) production group `0f49f107-b2a8-4e1d-8599-95e1616db5fd`**(11-08, 소스 `58c1654`, 스크린샷 가져오기 #298·승급 게이지 리디자인 #302·Lv.2 농부 영상·이름 #303·#304, preview `f15e523a`에서 승격). 되돌리려면 이전 그룹 `eb9f55eb-45ed-495f-be30-092a8d1ce272`(소스 `dacd644`, #297)을 다시 게시한다. 공개 `app-version.json` `minVersion`은 Android **1.9.0**(#292)이라 1.8.0 이하는 업데이트 창이 뜬다 |
| 마이크 권한 경고 | 1.8.0부터 `RECORD_AUDIO` 때문에 Play가 마이크 없는 기기 약 20종을 지원하지 않는다고 경고한다. 영향이 작아 그대로 둔다(11-07 사용자 결정). 고치려면 `android.hardware.microphone`을 `required="false"`로 선언하는 config plugin과 새 빌드 |
| 서버 | 아카데미 VM에서 동작(EC2는 중계, 아래 "서버 이전"). 마지막 배포 11-06 15:53 소스 `0a3152a`(Flyway V22). **그 뒤 서버 변경 3건(#279·#281·#290, V23)이 배포 전이고 11-09 배포 예정**(2번 1행). 서버 `.env`에 `GEMINI_API_KEY` 있음·`GEMINI_MODEL` 없음(기본 `gemini-3.5-flash-lite`). 배포는 아카데미 네트워크 PC에서만 된다 |
| 웹 | Vercel이 `main` 자동 배포(방침·약관·계정 삭제·`app-version.json`). 시연·웹사이트는 별도 저장소 `flexable-web` |
| 감시·CI | 서버 감시 15분 간격(`server-health.yml`), PR마다 백엔드·프론트·E2E. 오류 기록(`error_events`)은 서버 배포 뒤부터 쌓이고, 보는 법은 [`error-logs.md`](error-logs.md) |
| Play | 1.9.0 프로덕션 출시(11-07). **데이터 보안 양식 반영 완료(11-08, 사용자)**: AI 메이트 메시지(기타 사용자 제작 콘텐츠), 마이크 권한, "앱 정보 및 성능 → 진단"(1.9.0 오류 기록) |

## 2. 다음 할 일 (순서대로, 모두 사람)

1.9.0 실기기 확인 17항목은 11-08에 모두 끝났고 관련 이슈(#256·#212·#211·#209·#203·#191·#181)도 닫았다. Play 데이터 보안 양식도 11-08 반영.

| 순서 | 할 일 | 완료 기준·주의 |
|---|---|---|
| 1 | **11-09 서버 배포**(아카데미 네트워크 PC) | 담는 것: 일정 금액 예측 시간대 제거(#279), 광고 시청 시간 보너스 `POST /coins/ad-bonus`(#281), 오류 기록 V23 `error_events`·`POST /client-errors`·서버 500 기록·매일 30일 삭제(#290), 2028 공휴일(#299), Lv.2 농부 코스튬 켜기 V24(#303·#304, 2행 앱 수신 확인 뒤). 순서: ① **DB 백업** ② `backend/deploy/academy/deploy.sh` ③ `/actuator/health` 전부 `UP`, Flyway 로그 "now at version v24" ④ 앱에서 광고를 30초 넘게 보고 "+20 코인을 받았어요" ⑤ AI 메이트에 일정을 말해 금액이 나오는지 ⑥ DB에서 `select event_day, source, kind, status, code, path, message, occurrences from error_events order by last_at desc limit 20`이 에러 없이 도는지. ⑦ 레벨 2 이상 계정의 상점에서 농부 코스튬이 열리는지. 끝나면 4번의 서버 줄을 지운다 |
| 2 | **production `0f49f107` 실기기 확인** | 11-08 승격(#298·#302~#304). 앱을 두 번 열어 받은 뒤 확인: 스크린샷 등록 때 모든 항목이 기본 선택되는지(이미 기록된 것 같은 거래만 빠짐), 토스 스크린샷에 "금액의 원 표시를 정확히 읽지 못했어요"가 더는 안 뜨는지, 홈 게이지가 0에서 차오르고 채움 끝에 고양이가 있는지, 레벨 안내가 아이콘만인지(Lv.2 🌾). 이게 확인돼야 1행 서버 배포에 V24(Lv.2 농부 켜기)를 함께 담아도 된다 |
| 3 | **웹 연동 시드머니 운영 응답 확인**(서비스 키 필요) | 웹은 `EXTRA` 처리를 끝냈다(11-08 웹 회신: 계약 enum·타입·"바로 보낸 돈" 라벨, 같은 날 여러 건·`startedOn` null 테스트). 남은 것: 가짜 테스트 계정으로 웹을 연동하고 서비스 키로 운영 `GET /internal/v1/web-links/{linkId}/seed-money`를 불러 `entries`·`startedOn`이 오는지, 키 없이 401인지 확인. 운영에서 그래프를 확인한 기록이 아직 없다([`web-seed-entries-handoff.md`](web-seed-entries-handoff.md)) |

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

## 4. 코드에는 있지만 운영에 아직 없는 것

기능·수정 PR은 같은 PR에서 이 목록 끝에 한 줄을 더한다(무엇이 바뀌었는지, PR 번호, 반영 방법, 배포 순서 제약). 서버 배포가 끝나면 해당 줄을 지운다(이 파일만 고치는 변경은 PR 없이 `main`에 바로, [AGENTS.md](../AGENTS.md) "작업 완료 시").

**서버**: 11-06 `0a3152a`(V22)까지 배포했다. 아래는 **11-09 배포 예정**(2번 1행, V23이 있어 배포 직전 DB 백업). 앱 쪽은 이미 나가 있고, 배포 전에도 앱은 정상 동작한다(괄호 안).
- [ ] 일정 금액 예측에서 시간대 제거(Issue #277, #279): 금액은 그 카테고리 하루(KST) 합계의 중앙값(90일, 기록 있는 날 3일 이상). 마이그레이션 없음(배포 전: 예전 같은 시간대 기준으로 예측)
- [ ] 광고 보상 시청 시간별 10·15·20(Issue #278, #281): `POST /coins/ad-bonus`·내역 `AD_BONUS`·오류 `AD_NOT_REWARDED`. 마이그레이션 없음(배포 전: 보너스 요청이 404라 지갑으로 확인해 "+10 코인을 받았어요")
- [ ] 오류 기록 테이블(#290): Flyway **V23** `error_events`, `POST /client-errors`, 서버 500 기록, 매일 04:30 30일 지난 기록 삭제(배포 전: 앱 보고가 404라 저장되지 않음). 방침 추가 개정(4)은 11-07 공고·시행(#291). 보는 방법은 [`error-logs.md`](error-logs.md)
- [ ] 2028 공휴일(#299): 수입일을 미루는 공휴일에 2028년 추가(천문연구원 자료, 월력요항 나오면 대조). 마이그레이션 없음. 2028년 수입일부터 영향이라 배포 시점 제약 없음
- [ ] Lv.2 코스튬 켜기(#303, #304): Flyway **V24** `costume-lv2` `active = TRUE`(최고 단계 2 이상이면 열림), 이름 마구간지기→농부(#304, 앱 🌾 아이콘·레벨 안내는 아이콘만). **앱 원격 업데이트(영상 연결) 수신 확인 → 서버 배포** 순서(먼저 켜면 옛 앱이 광부 그림으로 보임). 앱은 production `0f49f107`(11-08)로 나갔다

**앱**: 1.9.0 빌드(`f28bff3`)와 원격 업데이트 `0f49f107`(`58c1654`, #304)까지 나갔다. 아래는 preview에만 있다. 이후 앱 PR은 원격 업데이트(`main`, runtime 1.9.0) 또는 새 빌드로 나간다.
- [ ] + 시트의 "이미지 업로드" 버튼 이름을 "결제내역 스크린샷 등록"으로(#PR). 원격 업데이트(runtime 1.9.0), 서버 순서 제약 없음

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
- **`main`의 앱 버전이 운영 앱보다 높을 때**(새 빌드 준비 중) 운영 앱에 보낼 원격 업데이트는 운영 버전 시절 커밋에서 브랜치를 따서 낸다. main에서 내면 새 runtime으로 나가 운영 앱에 가지 않는다(예: 11-07 1.9.0 버전 올림 #288 뒤 1.8.0용은 `27c7220`에서 게시한 preview를 승격). 지금은 main·운영 모두 1.9.0이라 `main`에서 낸다.
- 앱은 실행할 때 새 업데이트를 받는다. 스플래시 3초 안에 받으면 바로, 늦으면 다음 실행에 적용한다. preview APK는 `preview` 채널, Play AAB는 `production` 채널을 본다.
- **필수 업데이트**: 앱은 시작할 때와 다시 열 때(10분 간격) `frontend/public/app-version.json`의 `android.minVersion`을 읽고, 설치된 버전이 더 낮으면 닫을 수 없는 업데이트 창(Play 스토어로 이동)을 띄운다. 새 버전이 테스터 Play 스토어에 보이고 설치까지 확인한 **뒤에** minVersion을 올리는 PR을 머지한다(Vercel 자동 배포). 되돌리려면 minVersion을 내린다.
- Claude Code auto mode는 production 게시를 운영 배포로 보고 막는다. 그 메시지에서 사람이 "production 승격해"처럼 직접 시키면 실행되고, 아니면 사람이 `! <명령>`으로 직접 실행한다.
- Play 'Android 15 지원 중단 API' 경고는 React Native·Material 라이브러리 안의 코드라 설정으로 없앨 수 없다. SDK 업그레이드 때 다시 본다.

### 5-4. 서버 운영

- 운영 API: `https://flex-able-sh.duckdns.org/api/v1`. 코드 `backend/`, 계약 `docs/API.md`·`docs/contracts/`. 구성은 `backend/deploy/`(Docker Compose: api + Caddy 자동 HTTPS), 절차는 `backend/README.md`.
- **지금 배포는 `backend/deploy/academy/deploy.sh`다**(jar 빌드 → VM 업로드 → api 재기동). EC2의 `backend/deploy/deploy.sh`는 `RELAY_MODE` 때문에 멈춘다. EC2 복귀 뒤에는 다시 `backend/deploy/deploy.sh`를 쓴다.
- 배포 뒤 `/actuator/health`(앱·DB·디스크 `UP`)와 Flyway 로그의 "now at version vN"을 확인한다. 스키마 변경은 `backend/src/main/resources/db/migration/V{n}__*.sql`을 **추가**한다(배포된 파일 수정 금지, 운영 DB의 체크섬을 임의로 고치지 않는다). 지금 최신은 V17.
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
