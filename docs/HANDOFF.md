# 인수인계 — 텅장관리 앱 (운영 1.8.0)

마지막 갱신 2026-11-07. 이 문서는 **지금 상태와 남은 일**만 적는다. 끝난 작업의 상세 기록(게시 그룹 ID, 날짜별 로그, 실기기 확인 내역)은 `git log`·PR·[`CHANGELOG.md`](CHANGELOG.md)에 있다(11-06까지의 판은 이 개편 직전 커밋 `7e13245`). 기능별 현재 동작은 [`FEATURES.md`](FEATURES.md).

**코드 병합과 운영 반영은 다르다.** 배포(서버 `deploy.sh`, EAS 게시·빌드 제출, Play 업로드)는 사람이 직접 한다.
**저장소는 공개(PUBLIC)다.** 비밀값(키 파일, 비밀번호), 개인 계정 경위, 사용자 이메일은 여기에 적지 않는다.

## 1. 지금 상태

| 영역 | 상태 |
|---|---|
| 코드 | `main` `dd4d054`까지. 앱 버전 1.8.0(#271 병합). main `frontend/`는 1.8.0 빌드 소스 `5e3e3c1`과 같다 |
| 1.8.0 앱 빌드 | EAS 빌드 `c4057b19-dfaa-451a-9dd9-e2acbcff0455`(production, versionCode 21, runtime 1.8.0, 소스 `5e3e3c1`). AAB는 작업 PC `~/Downloads/flexable-1.8.0-21.aab`(저장소에 넣지 않음, EAS 보관은 12-06까지). 업로드 때 "이전 버전에서 지원되던 기기 20개를 더 이상 지원하지 않음" 경고가 났다. 원인은 음성 입력의 `RECORD_AUDIO` 권한(1.6.0 AAB에는 없음)으로 Play가 마이크를 필수 기능으로 본 것이고, 영향이 작아 그대로 두기로 했다(11-07 사용자 결정). 고치려면 `android.hardware.microphone`을 `required="false"`로 선언하는 config plugin과 새 빌드가 필요하다 |
| 현재 운영 앱 | **스토어 1.8.0(versionCode 21), 11-07 심사 통과·출시.** **11-07 원격 업데이트(runtime 1.8.0) group `2e7b6655-b736-48ab-bc9e-a6a4c6a55a37`(소스 `b1509cb`, preview group `4e6221c6-0748-46d3-ac83-0b953f0dfdfd`를 승격)** — 음성 일정 개편 화면(#280)·광고 시청 시간 보상 화면(#281). 되돌리려면 내장 번들로(이전 1.8.0 원격 업데이트 없음). 이후 원격 업데이트는 `main`(runtime 1.8.0)에서 내고, 1.7.0 앱에는 가지 않는다. 1.7.0의 마지막 원격 업데이트는 group `dfa17380-711b-4344-a785-1b44e0fc94f9`(11-06, 소스 `9521cf5`). 공개 `app-version.json` `minVersion`은 아직 Android 1.7.0(2번 2행) |
| 서버 | 아카데미 VM에서 동작(EC2는 중계, 아래 "서버 이전"). 마지막 배포 11-06 15:53 소스 `0a3152a`(Flyway V22, 배포 직전 DB 백업). 이후 main에 서버 변경이 없어 **배포할 것이 없다**. 서버 `.env`에 `GEMINI_API_KEY` 있음·`GEMINI_MODEL` 없음(기본 `gemini-3.5-flash-lite`). 배포는 아카데미 네트워크 PC에서만 된다 |
| 웹 | Vercel이 `main` 자동 배포. 시연·웹사이트는 별도 저장소 `flexable-web` |
| 감시·CI | 서버 감시 15분 간격(`server-health.yml`), PR마다 백엔드·프론트·E2E |
| Play | 1.8.0 프로덕션 출시(11-07). 1.8.0 업로드 때 데이터 보안 양식(AI 메이트 메시지·음성)·마이크 권한 신고를 반영했는지는 기록이 없다(3번 첫 줄) |

## 2. 다음 할 일 (순서대로, 모두 사람)

| 순서 | 할 일 | 완료 기준·주의 |
|---|---|---|
| 1 | **1.8.0 실기기 확인**(Android) | 1.8.0에 처음 들어가는 것: ① 음성 입력 성공·권한 거부·인식 실패 ② 앱 캘린더·지난 날짜 바로 기록·수입 제목 칸·신한카드 동의 체크박스(#267) ③ 버튼 색·수입일과 매달 나가는 날 1~31 달력 창(#269). 11-06 원격 업데이트분(실기기 미확인): ④ 출석 모달 3일차 +20·성공 직후 체크 ⑤ 예산 설정 한 화면 저장·재진입, 고정지출 빠른 추가·[취소] ⑥ 예정 지출 카테고리 순서, AI 일정 등록·하루 예산 반영, AI 메이트 키보드에 입력창이 가리지 않는지 ⑦ 새 계정 첫 홈 가이드(선물·출석 모달 뒤 한 번) ⑧ 6단계 레벨·잠금 칸. 이전부터 남은 것: ⑨ 광고 재생·실제 콜백 +10·하루 3번 ⑩ 신한카드 자동 기록(실제 승인·취소, 권한, 앱 종료·복귀, 중복, 계정 전환, 권한 철회) ⑪ 스크린샷 가져오기 원본·위아래 자른 이미지(후보·검토·저장) ⑫ 사용자 지정 글꼴·큰 글씨 ⑬ 요일별 배분 프리셋·막대 끌기 |
| 2 | **`minVersion` 판단** | Play 스토어에 1.8.0이 보이고 설치까지 확인한 **뒤에만** `frontend/public/app-version.json`을 1.8.0으로 올린다. 먼저 올리면 업데이트하지 못한 사용자가 닫을 수 없는 창에 갇힌다 |
| 3 | **이슈 닫기** | 1번 확인이 끝난 것부터: ①→#270, ②③⑤⑥⑦→#256(7일째 새 코스튬은 자료를 받은 뒤, 지금은 `outfit-07`), ⑩→#205, ⑪→#203·#211, ⑫→#209, ⑬·⑪→#191·#181, 전부 끝나면 #212. 코드는 모두 main에 있고 남은 것은 실기기·운영 확인뿐이다(11-07 점검) |
| 4 | **Gemini API 등급 확인** | 무료/유료 등급에 따라 Google의 데이터 이용 조건이 다르다. 방침에는 "Google의 Gemini API 정책에 따름"으로만 적었다([결정](decisions/2026-11-06-voice-input.md)) |
| 5 | **flexable-web에 알림**(완료 기록 없음) | 웹 연동 시드머니 `entries[].choice`에 `EXTRA`(앱에서 바로 보낸 돈, #225)가 올 수 있다. 웹이 이 값을 처리하는지 확인([`web-link-api.yaml`](contracts/web-link-api.yaml)) |

## 3. 그 다음 할 일

### 출시·Play Console
- [ ] 데이터 보안 양식 반영(`play-store/README.md` §3.6), 금융 기능 선언 실제 선택지 기록(§3.7 TODO), 스토어 설명 끝 "문의:" 줄을 `ucmnuniverse@gmail.com`으로, 알림 권한 반영 여부(§3.8)

### 서버·인프라
- [ ] **EC2 로컬 DB로 복귀 11-14~16 → 아카데미 VM 데이터 삭제 11-17**(계획 [`server-migration.md`](server-migration.md) §8). 복귀 뒤에는 이 PC에서 `backend/deploy/deploy.sh`로 배포할 수 있다. 개인정보처리방침 백업 문구 손보기(§9)
- [ ] 작업 PC 홈의 `ec2.env`·`academy.env`(비밀값)는 비밀번호 관리자로 옮기고 지운다. 되돌림용 `dump-final.sql.gz`(EC2 `~`, 작업 PC `~`)도 지운다
- [ ] 도메인 구매 → 서버 `API_DOMAIN`, `frontend/.env.production`, EAS 환경변수 `EXPO_PUBLIC_API_URL`(preview·production) 변경 → 재빌드 또는 원격 업데이트. EC2 탄력적 IP 할당(지금은 인스턴스를 멈추면 IP가 바뀜)

### 제품·기능
- [ ] 결정 대기: 홈 "Lv.1 새싹" 배지·말풍선을 넣을지(#123에서 뺌, 게이지는 기존 유지)
- [ ] 홈 진행 바에 달리는 캐릭터(1차 피드백, 다음 버전)
- [ ] 팀원 2차 피드백 수집(노션)
- [ ] 웹 시드머니 인수인계 남은 체크 2개([`web-seed-entries-handoff.md`](web-seed-entries-handoff.md)): 가짜 테스트 계정 연동 응답 확인(서비스 키 필요), 예시·계약을 웹 담당에게 전달
- [ ] 2027년 6월쯤 2028 월력요항이 나오면 `PublicHolidays.java`에 2028 공휴일 추가
- [ ] 앱 안 코인 결제는 붙이지 않는다. 붙이기로 하면 약관 제2조 4항, 통신판매업 신고, 사업자 정보 표시, 환불 규정을 함께 손본다

### 법률·문서
- [ ] Expo 항목별 보관 기간 문의(expo.dev/contact), 개인정보처리시스템 접근 기록 1년 보관 방식

## 4. 코드에는 있지만 운영에 아직 없는 것

기능·수정 PR은 같은 PR에서 이 목록 끝에 한 줄을 더한다(무엇이 바뀌었는지, PR 번호, 반영 방법, 배포 순서 제약). 서버 배포가 끝나면 해당 줄을 지운다.

**서버**: 11-06 `0a3152a`(V22)까지 모두 배포했고 이후 main에 서버 변경이 없다.

**앱**: 11-07 원격 업데이트(`b1509cb`, 1번 표 "현재 운영 앱")까지 모두 나갔다. 실기기 미확인: 듣는 중 빨간 멈춤·"…" 말풍선, 예정 지출 한 줄 카드 [반영 | 수정], AI 음성 답변 선택·스피커, + 시트 음성 입력, 광고 [광고 🪙]·"+N 코인을 받았어요"(이전 것은 2번 1행). 이후 앱 PR은 원격 업데이트(`main`, runtime 1.8.0) 또는 새 빌드로 나간다.
- [ ] 일정 금액 예측에서 시간대 제거(Issue #277, #279): 모델이 시간대를 뽑지 않고, 금액은 그 카테고리 하루 합계의 중앙값(90일, 기록 있는 날 3일 이상). `basis.scope`는 늘 `CATEGORY`라 옛 앱(1.8.0 번들)도 그대로 동작한다. 반영: **서버 배포**(`deploy.sh`, 마이그레이션 없음). 앱 순서 제약 없음
- [ ] 광고 보상 시청 시간별 10·15·20 서버(Issue #278, #281): `POST /coins/ad-bonus`·내역 `AD_BONUS`·오류 `AD_NOT_REWARDED`. 반영: **서버 배포**(마이그레이션 없음). 앱 화면은 11-07 원격 업데이트로 먼저 나갔고, 서버 배포 전에는 보너스 요청이 404라 지갑으로 확인해 "+10 코인을 받았어요"로 끝난다

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
- **운영 앱이 1.5.0일 때 원격 업데이트는 1.5.0 호환 릴리스 브랜치에서만** 낸다(`SXXNHU/release-1.5.0-*`, 마지막 `release-1.5.0-notification-read`). 1.6.0이 스토어에 나간 뒤에는 `main`(runtime 1.6.0)에서 낸다.
- 앱은 실행할 때 새 업데이트를 받는다. 스플래시 3초 안에 받으면 바로, 늦으면 다음 실행에 적용한다. preview APK는 `preview` 채널, Play AAB는 `production` 채널을 본다.
- **필수 업데이트**: 앱은 시작할 때와 다시 열 때(10분 간격) `frontend/public/app-version.json`의 `android.minVersion`을 읽고, 설치된 버전이 더 낮으면 닫을 수 없는 업데이트 창(Play 스토어로 이동)을 띄운다. 새 버전이 테스터 Play 스토어에 보이고 설치까지 확인한 **뒤에** minVersion을 올리는 PR을 머지한다(Vercel 자동 배포). 되돌리려면 minVersion을 내린다.
- Claude Code auto mode는 production 게시를 운영 배포로 보고 막는다. 사람이 `! <명령>`으로 직접 실행한다.
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
