# 인수인계 — 서비스 1.0.0 Google Play 비공개 테스트

마지막 갱신 2026-10-16. 다른 PC나 다른 사람이 이어서 작업할 때 이 문서부터 읽는다.
비밀값(키 파일, 비밀번호)은 이 문서와 저장소에 없다. "§2 따로 챙길 것"을 보고 안전한 경로로 옮긴다.
**저장소는 공개(PUBLIC)다.** 개인 계정 경위·제출 서류·결제 정보·사용자 이메일은 여기에 적지 않는다.

## 0. 다음에 이어서 할 일 (2026-10-16 기준, 우선순위 순)

1. [ ] **진행 중(10-16~)** 비공개 테스트 테스터 모집: 12명 이상(여유 있게 14~15명)이 옵트인한 날부터 14일 연속 유지 → Play Console에서 프로덕션 액세스 신청. 안내 문구·옵트인 링크·피드백 주소는 `docs/play-store/README.md` §5
2. [x] Play Console 비공개 테스트에 versionCode 7 AAB 업로드 → 검토 → 출시. "이전 버전 포함"은 비워 둔다(지원 기기가 같아 예전 번들을 남길 이유가 없다). AAB는 EAS 빌드 `8699a0f4`(§4-2 빌드 목록)
3. [x] Play Console 스토어 등록정보 → 앱 아이콘을 `docs/play-store/icon-512.png`(새 광부 고양이, 32비트 PNG)로 교체
4. [ ] 실기기 확인(Play에서 versionCode 7로 업데이트한 앱): 홈 화면 아이콘이 원형·둥근 사각형 런처에서 잘리지 않는지, 테마 아이콘, 동전 4단계, 게이지 퍼센트 표시, 거래 완료 알림이 상단에 뜨는지, 다음 원격 업데이트 때 업데이트 배너가 뜨고 "지금 적용"이 동작하는지, 거래 수정·수입 저장 후 빈 화면이 다시 나오지 않는지(PR #23·#25, `docs/bug-transaction-edit-blank-screen.md`)
5. [ ] 팀원 2차 피드백 수집(노션)
6. [ ] `docs/play-store/` 스크린샷 교체 검토(예전 홈 화면·아이콘 기준)
7. [ ] 운영 DB에 남은 테스트성 계정 3개(`test1@`·`test@`·`baeh@` 로 시작) 정리 여부 결정. 목록은 §5의 조회로 확인. `play.review@flexable.app`은 지우지 않는다
8. [x] production AAB를 Play Console 내부/비공개 테스트 트랙에 업로드(10-14, versionCode 5)

지난 변경 내역은 PR 목록과 `git log`에 있다. 기능별 현재 상태는 `docs/FEATURES.md`.

## 1. 지금 상태

| 영역 | 상태 | 위치 |
|---|---|---|
| API 서버 | 운영 중 | `https://flex-able-sh.duckdns.org/api/v1` (EC2 + RDS), 코드 `backend/`, 계약 `docs/API.md` |
| 웹 | Vercel이 `main`을 자동 배포 | `https://project2-flex-sh.vercel.app` (`/demo` 시연, `/privacy`·`/terms`·`/support`·`/delete-account` 공개 페이지) |
| CI | PR·`main` 푸시마다 백엔드 테스트, tsc·lint, 정적 웹 빌드 + E2E 자동 실행(10-16~) | `.github/workflows/ci.yml` |
| 서버 감시 | 15분마다 API(앱·DB·디스크)·웹·인증서 확인, 실패하면 이슈 자동 생성(10-16~) | `.github/workflows/server-health.yml`, §5 |
| 앱 서비스 화면 | 완료, 1차 피드백 반영(PR #15), 로컬 E2E 5개 통과 | `frontend/src/service/`, `frontend/src/app/` (기능별 상태는 `docs/FEATURES.md`) |
| Play 제출 자료 | 초안·그래픽·스크린샷 완료 | `docs/play-store/` |
| 심사용 계정 | 운영 서버에 생성 완료 | `play.review@flexable.app` (비밀번호는 §2) |
| Android 빌드 | production AAB versionCode 7(10-15, 새 아이콘·권한 정리 포함) 비공개 테스트 출시 완료 | §4-2 |
| Play Console | 개발자 계정 `ucmnuniverse`. 비공개 테스트 출시·스토어 아이콘 교체 완료, 테스터 모집 중(10-16) | §4-3, `docs/play-store/README.md` |

## 2. 따로 챙길 것 (저장소에 없음)

| 항목 | 어디에 있나 | 새 PC에서 |
|---|---|---|
| EC2 SSH 키 `sh-flex.pem` | 기존 PC 바탕화면 | 메신저·메일·git으로 보내지 말고 USB나 비밀번호 관리자로 옮긴다. `~/.ssh/sh-flex.pem`, 권한 600 |
| RDS 마스터(admin) 비밀번호 | 담당자가 보관 | 평소에는 필요 없음(앱은 `flexable_app` 계정 사용) |
| 서버 비밀값(DB 앱 비밀번호, JWT 비밀키) | EC2 `/opt/flexable/.env`에만 있음 | 옮길 필요 없음. **JWT_SECRET을 바꾸면 모든 사용자가 로그아웃됨** |
| 심사용 계정 비밀번호 | 2026-10-13 대화로 전달 | 팀 비밀번호 보관함에 저장 → Play Console 앱 액세스에 입력 |
| Expo 계정 | 조직 `ucmnuniverse-developer`(Owner 계정 `ucmnuniverse`), 프로젝트 `fb9b50f5-3e92-4eb3-8cea-1c1a149b23ef` | `npx eas-cli@latest login` (Claude 셸에서는 `login --device --non-interactive`로 링크 승인) |
| Play Console 개발자 계정 | — | 개인/조직 여부에 따라 14일 테스트 조건이 다름(`docs/play-store/README.md` §1) |
| DuckDNS 계정 | 담당자 계정(`flex-able-sh`) | IP가 바뀌면 여기서 갱신 |

## 3. 새 PC 준비

```bash
git clone https://github.com/shinds-team7/project2.git && cd project2
# JDK 21, Node 22+, Git Bash, GitHub CLI(gh) 설치

# 백엔드
cd backend && ./gradlew test
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2로 실행

# 프론트
cd ../frontend && npm ci
echo "EXPO_PUBLIC_API_URL=http://localhost:8080" > .env.local   # 로컬 백엔드에 붙일 때
npm run web
npx tsc --noEmit && npx expo lint
npx playwright test     # 로컬 백엔드(8080)와 웹(8081)을 먼저 띄운 뒤 실행
```

- 운영 웹 빌드는 `frontend/.env.production`(공개 API 주소)를 쓴다. 앱 빌드와 원격 업데이트는 EAS 환경변수(`preview`·`production` 환경의 `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ENABLE_DEMO=false`)를 쓴다. 확인은 `npx eas-cli@latest env:list --environment production`.
- 운영 API의 CORS는 `https://project2-flex-sh.vercel.app`과 `http://localhost:8081`만 허용한다.
- Windows Git Bash에서 `curl -d '한글'`은 깨져서 400이 난다. 한글 요청은 UTF-8 파일(`--data-binary @file.json`)로 보낸다.
- **Windows에서 `npx expo install`로 패키지를 추가하면 `package-lock.json`에서 `node_modules/@emnapi/core`·`runtime` 항목이 빠질 수 있다.** 그대로 커밋하면 EAS(리눅스)의 `npm ci`가 실패한다(#9, #16). 커밋 전에 두 항목이 남아 있는지 확인한다.
- **EAS는 npm 10.9.8(Node 22)로 `npm ci`를 한다.** 로컬 npm 11이 넘기는 peer 불일치를 npm 10은 오류로 본다(#20 → #21로 되돌림: `expo` 57.0.28이 `react-native-worklets@0.10.4`를 요구). 패키지를 바꾼 뒤에는 `package.json`·`package-lock.json`만 빈 폴더에 복사해 `npx -y npm@10.9.8 ci --dry-run --ignore-scripts`로 먼저 확인한다. PR을 올리면 CI가 리눅스·Node 22(npm 10)로 `npm ci`를 돌려 같은 문제를 한 번 더 잡는다.
- Claude Code를 쓸 때: 권한 규칙은 PC마다 따로라 새 PC에서 다시 추가한다(`/permissions` → Allow: `Bash(gh pr merge:*)`, `Bash(ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99:*)`, `Bash(scp -i ~/.ssh/sh-flex.pem:*)`, `Bash(bash backend/deploy/deploy.sh:*)`). Claude 셸에서는 `eas login`의 입력을 받을 수 없으니 `eas login --device --non-interactive`로 받은 링크를 브라우저에서 승인한다(몇 분 뒤 만료).

## 4. 남은 일 (순서대로)

### 4-1. 웹 공개 페이지 확인
Play Console에 URL을 넣기 전에 아래 주소가 로그인 없이 열리는지 본다.
`/privacy`, `/terms`, `/support`, `/delete-account` (모두 `https://project2-flex-sh.vercel.app` 아래)

### 4-2. Android 빌드 (EAS)

```bash
cd frontend
npx eas-cli@latest login         # app.json에 owner·projectId가 이미 있다(PR #18)
# 1) 실기기 확인용 APK
npx eas-cli@latest build -p android --profile preview
# 2) Play 업로드용 AAB (versionCode 원격 자동 증가, Play 앱 서명 사용)
npx eas-cli@latest build -p android --profile production
```

- 10-13~14에 잠시 `apduis-team`으로 옮겼다가(PR #14) 원래 계정이 복구되어 `ucmnuniverse-developer/flexable`로 되돌렸다(PR #18). 서명 키가 프로젝트마다 달라서 `apduis-team` APK가 깔린 폰은 지우고 새로 설치한다. Play 업로드 키는 `ucmnuniverse-developer` 프로젝트의 키스토어(10-13 생성)다.
- 날짜·시간 선택기(`@react-native-community/datetimepicker`)는 네이티브 모듈이라 Expo Go가 아닌 빌드에서 확인한다.
- 빌드 전에 `backend`에서 `./gradlew --stop`을 실행한다. Gradle 데몬이 잡은 `backend/.gradle` 잠금 파일 때문에 EAS 업로드가 `EBUSY`로 실패한다.
- 원격 업데이트로 바뀌지 않는 것: 앱 아이콘, 권한, 네이티브 설정. 이런 변경은 새 production 빌드를 Play에 올리고 사용자가 앱을 업데이트해야 반영된다. Play는 사용자에게 바뀐 부분만 내려받게 하므로 AAB는 매번 전체를 올린다.
- 빌드 목록·다운로드: https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/builds

#### 원격 업데이트 (EAS Update)

`expo-updates`가 들어간 빌드(PR #19 이후)는 JS·이미지 변경을 다시 설치하지 않고 받는다. 앱은 실행할 때 새 업데이트를 내려받고, 그다음 실행부터 적용한다. preview APK는 `preview` 채널, Play용 AAB는 `production` 채널을 본다.

**2026-10-15 최신:** production 그룹 이력(위가 최신) — `d63078bb`(PR #45 업데이트 배너, preview `1cefd7bf`) ← `2c35943a`(PR #43 완료 알림 상단, preview `677bc2d0`) ← `1d3f76aa`(PR #37·#38, preview `aa8168a2`) ← `c2afb9ea`. 되돌릴 때는 바로 아래 그룹을 production에 다시 게시한다. 업데이트 배너는 #45를 받은 뒤 나가는 다음 원격 업데이트부터 뜬다(실기기 확인 전). 같은 날 versionCode 7을 빌드했다. `app.json`의 `version`은 그대로 1.0.0이라 런타임도 1.0.0이고, 아이콘·권한 변경은 JS와 무관해서 versionCode 5·6·7이 같은 원격 업데이트를 받아도 된다.

```bash
cd frontend
# 로그인 계정 ucmnuniverse 및 최신 main, 대상 빌드·런타임을 먼저 확인
npx eas-cli@latest whoami
# Play 내부 테스트 앱은 production 채널을 사용
npx eas-cli@latest update --channel production --environment production --platform android --message "변경 내용" --non-interactive
```

- preview APK로 먼저 검증할 때는 `npm run update:preview -- --message "변경 내용" --non-interactive`로 올린다. 결과의 `Update group ID`를 받아 같은 번들을 production으로 승격한다: `npm run update:promote -- <preview 그룹 ID> --message "변경 내용"`. 승격은 preview·production 환경변수가 같을 때만 쓴다(`npx eas-cli@latest env:list --environment preview`/`production`, `env:list`에는 `--non-interactive`가 없다).
- `update:republish`는 non-interactive 모드에서 `--channel`로 고를 수 없고 `--group`만 받는다. 그래서 `update:promote` 스크립트는 그룹 ID를 인자로 받는다. `--message`도 반드시 넣는다(없으면 non-interactive에서 실패). 예: `npx -y eas-cli@latest update:republish --group <preview 그룹> --destination-channel production --message "변경 내용"`
- Claude Code auto mode는 production 게시(`update`·`update:republish`를 production으로)를 운영 배포로 보고 막는다. 사용자가 프롬프트에 `! <명령>`으로 직접 실행한다. 이때 셸 위치는 Claude 세션의 현재 폴더(대개 `frontend/`)라 `cd frontend`를 붙이면 실패할 수 있다.
- `runtimeVersion`은 `appVersion` 정책이다. 네이티브가 바뀌는 변경(네이티브 패키지 추가·업그레이드, `app.json`의 권한·플러그인·아이콘, Expo SDK 업그레이드)은 원격 업데이트로 보낼 수 없다. 이때는 `app.json`의 `version`을 올리고(예: 1.0.0 → 1.0.1) 새로 빌드한다. 버전을 안 올리고 원격 업데이트로 보내면 예전 빌드에서 앱이 꺼질 수 있다.
- 승격은 preview에서 만든 번들을 그대로 쓰므로 preview·production 환경변수가 같아야 한다. 다르면 `npx eas-cli@latest update --channel production --environment production`으로 따로 올린다.
- 잘못 올렸으면 이전 업데이트를 같은 채널에 다시 게시해서 되돌린다(`npx eas-cli@latest update:republish --group <이전 그룹 ID>`). 그룹 ID는 `npx eas-cli@latest update:list --branch production`에서 확인한다.
- `expo-updates`가 없는 예전 빌드(10-14 이전 APK·AAB)는 원격 업데이트를 받지 않는다.

1차 피드백 반영본에서 특히 확인할 것: 거래 수정·저장(예전에 앱이 꺼지던 문제 — 빌드 4에서는 빈 화면이 뜨고 뒤로가기 시 종료, `docs/bug-transaction-edit-blank-screen.md`), 거래 날짜 달력·시간 휠, 온보딩 '이전'·'취소'·'확인' 접기, 마이 → 홈 화면 → 캐릭터 홈, 수입일이 주말일 때 남은 날짜.

실기기(APK)에서 확인할 것: 가입·로그인, 예산 설정 키보드·스크롤, 거래 입력 바텀시트, 글꼴 크게 설정, 앱 재시작 후 로그인 유지(SecureStore), `flexable://demo` 딥링크가 시작 화면으로 가는지, 계정 삭제.

### 4-3. Play Console
- 등록비를 낸 Google 계정이 복구되었다(10-14). 그 계정으로 등록(본인·주소 확인, 전화번호 인증)을 이어 간다.
- 연락처 이메일은 앱·정책 문서·Play Console 모두 `ucmnuniverse@gmail.com`이다(10-16 통일). 바꿀 때는 `frontend/src/service/config.ts`, `docs/play-store/*.md`, Play Console(연락처·스토어 설명의 "문의:" 줄)을 함께 바꾼다.
- 운영자 표시명(개인정보처리방침·약관의 운영자·개인정보 보호책임자)도 Play 개발자 표시명과 같은 `ucmnuniverse`다(10-16 통일, 예전 표시명은 쓰지 않는다). 값은 `frontend/src/service/config.ts`의 `OPERATOR_NAME`과 `docs/play-store/privacy-policy.md`·`terms.md`에 있다.

`docs/play-store/README.md` 순서대로 진행: 앱 만들기 → 앱 콘텐츠 → 스토어 등록정보(그래픽·스크린샷은 `docs/play-store/`) → 비공개 테스트 트랙 → AAB 업로드 → 테스터 12명 이상(여유 있게 14~15명) → 검토 → 옵트인 링크 배포 → 14일 유지 → 프로덕션 액세스 신청.

## 5. 서버 운영

```bash
ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99
cd /opt/flexable && docker compose ps && docker compose logs api --tail 100
```

- 코드 변경 배포: 로컬에서 `backend/deploy/deploy.sh` (jar 빌드 → 업로드 → 재기동)
- **EC2 루트 디스크가 6.7GB뿐이다.** Docker 빌드 캐시가 쌓이면 배포 빌드가 `apt-get update`(exit 100)에서 실패하는데 실제 원인은 디스크 부족이다(10-15 발생, 이슈 #31). `deploy.sh`가 배포마다 빌드 캐시·이전 이미지를 지우고 마지막에 `df` 결과를 보여 준다. 사용량이 90%를 넘으면 `docker system df`로 확인하고, 계속 부족하면 EBS 볼륨을 늘린다
- 구성: `backend/deploy/` (Docker Compose: api + Caddy 자동 HTTPS), 절차는 `backend/README.md`
- **외부 감시**(`.github/workflows/server-health.yml`, 10-16 추가): 15분마다 아래를 확인한다. 예약 실행은 `main`의 파일로만 돌고, GitHub 사정으로 몇 분씩 늦거나 한 번씩 빠질 수 있다. 일시적인 오류(연결 실패, 응답 중단, 502·503)는 10초 간격으로 3번 더 시도한 뒤 판단한다.
  - `https://flex-able-sh.duckdns.org/actuator/health` — 앱, DB(RDS), 디스크(남은 공간 300MB 미만이면 DOWN). 응답의 `components`에 항목별 상태만 나온다(용량 같은 세부값은 숨김). 이 설정은 다음 `deploy.sh` 배포부터 반영되고, 그 전에는 전체 상태만 나온다
  - 웹 `/privacy`(Play에 등록한 개인정보처리방침 주소)
  - HTTPS 인증서 만료가 10일 미만으로 남았는지(Caddy 자동 갱신 실패). 만료일을 읽지 못해도 실패로 본다
  - 실패하면 저장소에 `server-health` 라벨을 단 `[서버 감시] 운영 서버 확인 실패` 이슈를 하나 연다(라벨 붙은 열린 이슈가 있으면 새로 만들지 않음). 정상으로 돌아오면 확인 기록을 댓글로 남기고 자동으로 닫는다. **팀 전체 알림은 이 이슈로 받는다**(저장소 Watch 설정)
  - 실패한 실행의 GitHub 메일은 한 사람에게만 간다. 처음에는 워크플로를 만든 사람, 그 뒤 `cron` 줄을 바꾸면 바꾼 사람, 꺼진 워크플로를 다시 켜면 다시 켠 사람이다. 그 사람의 GitHub 알림 설정(Settings → Notifications → Actions)이 켜져 있어야 한다
  - 이슈 본문에 원인별 확인 순서가 있다. 요청 실패(연결 실패·시간 초과)는 EC2 정지·IP 변경(DuckDNS), HTTP 502는 API 컨테이너, `DOWN: db`는 RDS, `DOWN: diskSpace`는 디스크
  - **공개 저장소는 60일 동안 저장소 활동(커밋 등)이 없으면 예약 실행이 자동으로 꺼진다.** Actions 탭 → 서버 상태 감시 → Enable workflow로 다시 켠다. 손으로 한 번 돌릴 때는 같은 화면의 Run workflow
- EC2: Ubuntu 26.04, t3.micro, swap 2GB. 보안 그룹 `flex-api-web`(22는 관리자 IP만, 80, 443) + `ec2-rds-1`
  - **새 PC나 사무실에서는 공인 IP가 달라 SSH가 막힌다.** EC2 → 보안 그룹 `flex-api-web` → 인바운드 22번 소스를 새 IP로 바꾼다.
- RDS: `database-flex` (MySQL), DB `flexable`, 앱 계정 `flexable_app`. 퍼블릭 액세스 없음, EC2에서만 접근
- 스키마 변경은 `backend/src/main/resources/db/migration/V{n}__*.sql` 추가(기존 파일 수정 금지)
- 운영 DB 조회: EC2에 `mysql` 클라이언트가 있다. `/opt/flexable/.env`는 값에 `&`가 있어 `source`하면 깨진다 → `grep '^DB_URL=' .env | cut -d= -f2-`처럼 값만 읽고 `mysql --ssl-mode=REQUIRED -h <RDS 호스트> -u flexable_app flexable`로 접속(비밀번호는 `MYSQL_PWD` 환경 변수로).
- 사용자 삭제는 앱의 `AccountDeletionService.deleteAll` 순서를 따른다: transactions → categories → fixed_expenses → fixed_expense_postings → protected_items → budget_settings → users(`transactions`가 `categories`를 연쇄 삭제 없이 참조).

## 6. 미뤄 둔 일

- [ ] 도메인 구매 → 서버 `.env`의 `API_DOMAIN`, `frontend/.env.production`, EAS 환경변수 `EXPO_PUBLIC_API_URL`(preview·production) 변경 → 앱 재빌드 또는 원격 업데이트
- [ ] EC2 탄력적 IP 할당(지금은 자동 할당 IP라 인스턴스를 멈추면 바뀜 → DuckDNS 갱신 필요)
- [x] 문의 이메일을 팀 계정으로 교체(10-16): `ucmnuniverse@gmail.com`. 앱은 원격 업데이트, 웹은 머지 후 Vercel 배포로 반영. Play Console 스토어 설명의 "문의:" 줄은 사람이 직접 바꾼다
- [x] API 요청(Codex): `GET /budget/today`에 `weekDaysLeft`·`weekAvailable`·`hasTransactions` 추가, 홈에 "이번 주 쓸 수 있는 돈"과 "아직 기록한 거래가 없어요" 반영(2026-10-13 운영 배포)
- [ ] 같은 `Idempotency-Key`로 동시에 들어온 요청은 하나가 500을 받는다(재전송하면 정상). 드문 경우라 보류
- [x] RDS 자동 백업 보관 기간이 7일 이하인지 확인(개인정보처리방침에 "최대 7일"이라고 적음). 2026-10-14 보관 기간 7일로 설정, 리전 간 복제 없음, 수동 스냅샷 없음, AWS Backup 미사용 확인
- [ ] 수입 저장·거래 수정 저장 후 빈 화면 → 뒤로가기 시 앱 종료(이슈 #24): PR #23·#25로 수정, `production` 원격 업데이트 게시 완료, 실기기 확인 대기. 원인·재발 방지 규칙·검증 체크리스트는 `docs/bug-transaction-edit-blank-screen.md`
- [ ] R8 난독화 켜기(Play가 "가독화 파일 없음" 경고, 10-14 versionCode 5 업로드 시): `expo-build-properties` 플러그인으로 `android.enableMinifyInReleaseBuilds: true` 설정 → EAS 빌드 결과물의 `mapping.txt`를 Play에 업로드. 켜면 리플렉션 쓰는 네이티브 모듈이 release에서만 깨질 수 있으니 preview 빌드로 먼저 확인
- [ ] 수입일 공휴일 처리(지금은 토·일만 다음 월요일로 미룸)
- [x] 캐릭터 홈 단계를 하루 단위 점수로 변경(이슈 #29, PR #30): 처음 쓴 날 광부 0%에서 시작, 예산을 지킨 날 +15·넘긴 날 −50(100점이 한 단계). 날짜별 하루 예산은 `daily_budgets`(V4)에 저장. 규칙은 `docs/API.md` "GET /budget/today"
- [ ] 홈 진행 바에 달리는 캐릭터(1차 피드백, 다음 버전)
- [x] 웹 개발 모드 "Invalid DOM property transform-origin" 경고: `Donut`의 `rotation`·`origin`을 `transform="rotate(-90 cx cy)"`로 바꿔 해결. 이 경고 토스트가 탭 바를 가려 실패하던 E2E도 통과(PR #49)
- [ ] 다 쓴 로컬 브랜치 정리(`SXXNHU/*` 여러 개가 남아 있음)
- [ ] 개발 도구 정리: Codex 작업 브랜치 `SXXNHU/feat-service-frontend`는 rebase 전 원본이다. 원격과 PR은 `SXXNHU/service-frontend`를 쓴다.
