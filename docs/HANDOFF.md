# 인수인계 — 서비스 1.0.0 Google Play 비공개 테스트

마지막 갱신 2026-10-14. 다른 PC나 다른 사람이 이어서 작업할 때 이 문서부터 읽는다.
비밀값(키 파일, 비밀번호)은 이 문서와 저장소에 없다. "§2 따로 챙길 것"을 보고 안전한 경로로 옮긴다.
**저장소는 공개(PUBLIC)다.** 개인 계정 경위·제출 서류·결제 정보·사용자 이메일은 여기에 적지 않는다.

## 0. 다음에 이어서 할 일 (2026-10-14 기준, 우선순위 순)

1. [ ] 거래 수정·수입 저장 후 빈 화면 버그: PR #23·#25 머지, 10-14 `production` 원격 업데이트 게시 완료 → Play 내부 테스트 실기기 검증 대기(`docs/bug-transaction-edit-blank-screen.md`)
2. [ ] 팀원에게 새 APK 배포 → 2차 피드백 수집(노션)
3. [ ] 운영 DB에 남은 테스트성 계정 3개(`test1@`·`test@`·`baeh@` 로 시작) 정리 여부 결정. 목록은 §5의 조회로 확인. `play.review@flexable.app`은 지우지 않는다
4. [ ] Google 계정 복구됨(10-14) → §4-3에 따라 Play Console 진행
5. [x] production AAB를 Play Console 내부/비공개 테스트 트랙에 업로드(10-14, versionCode 5)

최근 변경: PR #23·#25(수입 저장·거래 수정 저장 후 빈 화면 수정, 이슈 #24), #26(캐릭터 홈 하단 탭바·배치), #27(원격 업데이트 절차) — 10-14 `production` 원격 업데이트로 Play 내부 테스트 앱에 게시. PR #22(expo-updates 수집 항목을 개인정보처리방침·데이터 보안에 반영, RDS 백업 7일), PR #18(Expo를 원래 프로젝트 `ucmnuniverse-developer/flexable`로 되돌림), PR #14(Expo `apduis-team` 연결, #18로 대체), #15(1차 피드백 반영 + 주말 수입일 → 월요일), #16(lockfile `@emnapi` 복구). 백엔드는 10-14 운영 배포 완료, 운영 DB의 자동 테스트 계정 1개 삭제.

## 1. 지금 상태

| 영역 | 상태 | 위치 |
|---|---|---|
| API 서버 | 운영 중 | `https://flex-able-sh.duckdns.org/api/v1` (EC2 + RDS), 코드 `backend/`, 계약 `docs/API.md` |
| 웹 | Vercel이 `main`을 자동 배포 | `https://project2-flex-sh.vercel.app` (`/demo` 시연, `/privacy`·`/terms`·`/support`·`/delete-account` 공개 페이지) |
| 앱 서비스 화면 | 완료, 1차 피드백 반영(PR #15), 로컬 E2E 5개 통과 | `frontend/src/service/`, `frontend/src/app/` (상세는 `frontend/SERVICE_1_0_0_REPORT.md`) |
| Play 제출 자료 | 초안·그래픽·스크린샷 완료 | `docs/play-store/` |
| 심사용 계정 | 운영 서버에 생성 완료 | `play.review@flexable.app` (비밀번호는 §2) |
| Android 빌드 | 원래 Expo 프로젝트(`ucmnuniverse-developer/flexable`)로 복귀, production AAB 빌드(10-14) | §4-2 |
| Play Console | 등록에 쓰던 Google 계정 복구됨(10-14) → 등록·앱 만들기 진행 | §4-3 |

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
- **EAS는 npm 10.9.8(Node 22)로 `npm ci`를 한다.** 로컬 npm 11이 넘기는 peer 불일치를 npm 10은 오류로 본다(#20 → #21로 되돌림: `expo` 57.0.28이 `react-native-worklets@0.10.4`를 요구). 패키지를 바꾼 뒤에는 `package.json`·`package-lock.json`만 빈 폴더에 복사해 `npx -y npm@10.9.8 ci --dry-run --ignore-scripts`로 먼저 확인한다.
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
- 빌드 목록·다운로드: https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/builds

#### 원격 업데이트 (EAS Update)

`expo-updates`가 들어간 빌드(PR #19 이후)는 JS·이미지 변경을 다시 설치하지 않고 받는다. 앱은 실행할 때 새 업데이트를 내려받고, 그다음 실행부터 적용한다. preview APK는 `preview` 채널, Play용 AAB는 `production` 채널을 본다.

현재 검증 대상은 Play 내부 테스트 앱이다. EAS 조회로 versionCode 5의 빌드 커밋 `fe61447`, 채널 `production`, 런타임 `1.0.0`, PR #19 포함을 확인했다. 2026-10-14에 최신 main `1c0028e`(PR #23·#25 저장 버그 수정, PR #26 캐릭터 홈 변경)를 `ucmnuniverse` 계정으로 게시했다. 업데이트 그룹: [538a3d2d-c521-420c-9cc8-6d5b506a1c84](https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/updates/538a3d2d-c521-420c-9cc8-6d5b506a1c84). 같은 커밋을 preview 그룹 `0fa8cf03`에서 승격해 production 그룹 [bbf1b5f2-fa03-40c4-9f3e-7cc8eb8ba601](https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/updates/bbf1b5f2-fa03-40c4-9f3e-7cc8eb8ba601)로도 게시했다(코드 동일, 이것이 최신). 문제가 생기면 그 이전 그룹 `712cddcc-d991-4663-b09e-10220eb8c9b8`(개인정보처리방침 반영본)을 production에 다시 게시해 되돌린다. 타입 검사·린트·Android 번들 생성·EAS 게시 확인 완료. 실기기 수신·저장 동작 검증은 아직 남아 있다.

```bash
cd frontend
# 로그인 계정 ucmnuniverse 및 최신 main, 대상 빌드·런타임을 먼저 확인
npx eas-cli@latest whoami
# Play 내부 테스트 앱은 production 채널을 사용
npx eas-cli@latest update --channel production --environment production --platform android --message "변경 내용" --non-interactive
```

- preview APK로 먼저 검증할 때는 `npm run update:preview -- --message "변경 내용" --non-interactive`로 올린다. 결과의 `Update group ID`를 받아 같은 번들을 production으로 승격한다: `npm run update:promote -- <preview 그룹 ID> --message "변경 내용"`. 승격은 preview·production 환경변수가 같을 때만 쓴다(`npx eas-cli@latest env:list --environment preview`/`production`, `env:list`에는 `--non-interactive`가 없다).
- `update:republish`는 non-interactive 모드에서 `--channel`로 고를 수 없고 `--group`만 받는다. 그래서 `update:promote` 스크립트는 그룹 ID를 인자로 받는다.
- Claude Code auto mode는 production 게시(`update`·`update:republish`를 production으로)를 운영 배포로 보고 막는다. 사용자가 프롬프트에 `! <명령>`으로 직접 실행한다. 이때 셸 위치는 Claude 세션의 현재 폴더(대개 `frontend/`)라 `cd frontend`를 붙이면 실패할 수 있다.
- `runtimeVersion`은 `appVersion` 정책이다. 네이티브가 바뀌는 변경(네이티브 패키지 추가·업그레이드, `app.json`의 권한·플러그인·아이콘, Expo SDK 업그레이드)은 원격 업데이트로 보낼 수 없다. 이때는 `app.json`의 `version`을 올리고(예: 1.0.0 → 1.0.1) 새로 빌드한다. 버전을 안 올리고 원격 업데이트로 보내면 예전 빌드에서 앱이 꺼질 수 있다.
- 승격은 preview에서 만든 번들을 그대로 쓰므로 preview·production 환경변수가 같아야 한다. 다르면 `npx eas-cli@latest update --channel production --environment production`으로 따로 올린다.
- 잘못 올렸으면 이전 업데이트를 같은 채널에 다시 게시해서 되돌린다(`npx eas-cli@latest update:republish --group <이전 그룹 ID>`). 그룹 ID는 `npx eas-cli@latest update:list --branch production`에서 확인한다.
- `expo-updates`가 없는 예전 빌드(10-14 이전 APK·AAB)는 원격 업데이트를 받지 않는다.

1차 피드백 반영본에서 특히 확인할 것: 거래 수정·저장(예전에 앱이 꺼지던 문제 — 빌드 4에서는 빈 화면이 뜨고 뒤로가기 시 종료, `docs/bug-transaction-edit-blank-screen.md`), 거래 날짜 달력·시간 휠, 온보딩 '이전'·'취소'·'확인' 접기, 마이 → 홈 화면 → 캐릭터 홈, 수입일이 주말일 때 남은 날짜.

실기기(APK)에서 확인할 것: 가입·로그인, 예산 설정 키보드·스크롤, 거래 입력 바텀시트, 글꼴 크게 설정, 앱 재시작 후 로그인 유지(SecureStore), `flexable://demo` 딥링크가 시작 화면으로 가는지, 계정 삭제.

### 4-3. Play Console
- 등록비를 낸 Google 계정이 복구되었다(10-14). 그 계정으로 등록(본인·주소 확인, 전화번호 인증)을 이어 간다.
- 연락처 이메일은 앱·정책 문서와 같은 주소로 맞춘다(`frontend/src/service/config.ts`).

`docs/play-store/README.md` 순서대로 진행: 앱 만들기 → 앱 콘텐츠 → 스토어 등록정보(그래픽·스크린샷은 `docs/play-store/`) → 비공개 테스트 트랙 → AAB 업로드 → 테스터 12명 이상(여유 있게 14~15명) → 검토 → 옵트인 링크 배포 → 14일 유지 → 프로덕션 액세스 신청.

## 5. 서버 운영

```bash
ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99
cd /opt/flexable && docker compose ps && docker compose logs api --tail 100
```

- 코드 변경 배포: 로컬에서 `backend/deploy/deploy.sh` (jar 빌드 → 업로드 → 재기동)
- 구성: `backend/deploy/` (Docker Compose: api + Caddy 자동 HTTPS), 절차는 `backend/README.md`
- EC2: Ubuntu 26.04, t3.micro, swap 2GB. 보안 그룹 `flex-api-web`(22는 관리자 IP만, 80, 443) + `ec2-rds-1`
  - **새 PC나 사무실에서는 공인 IP가 달라 SSH가 막힌다.** EC2 → 보안 그룹 `flex-api-web` → 인바운드 22번 소스를 새 IP로 바꾼다.
- RDS: `database-flex` (MySQL), DB `flexable`, 앱 계정 `flexable_app`. 퍼블릭 액세스 없음, EC2에서만 접근
- 스키마 변경은 `backend/src/main/resources/db/migration/V{n}__*.sql` 추가(기존 파일 수정 금지)
- 운영 DB 조회: EC2에 `mysql` 클라이언트가 있다. `/opt/flexable/.env`는 값에 `&`가 있어 `source`하면 깨진다 → `grep '^DB_URL=' .env | cut -d= -f2-`처럼 값만 읽고 `mysql --ssl-mode=REQUIRED -h <RDS 호스트> -u flexable_app flexable`로 접속(비밀번호는 `MYSQL_PWD` 환경 변수로).
- 사용자 삭제는 앱의 `AccountDeletionService.deleteAll` 순서를 따른다: transactions → categories → fixed_expenses → fixed_expense_postings → protected_items → budget_settings → users(`transactions`가 `categories`를 연쇄 삭제 없이 참조).

## 6. 미뤄 둔 일

- [ ] 도메인 구매 → 서버 `.env`의 `API_DOMAIN`, `frontend/.env.production`, EAS 환경변수 `EXPO_PUBLIC_API_URL`(preview·production) 변경 → 앱 재빌드 또는 원격 업데이트
- [ ] EC2 탄력적 IP 할당(지금은 자동 할당 IP라 인스턴스를 멈추면 바뀜 → DuckDNS 갱신 필요)
- [ ] 문의 이메일을 팀 계정으로 교체: `frontend/src/service/config.ts`, `docs/play-store/*.md`, Play Console
- [x] API 요청(Codex): `GET /budget/today`에 `weekDaysLeft`·`weekAvailable`·`hasTransactions` 추가, 홈에 "이번 주 쓸 수 있는 돈"과 "아직 기록한 거래가 없어요" 반영(2026-10-13 운영 배포)
- [ ] 같은 `Idempotency-Key`로 동시에 들어온 요청은 하나가 500을 받는다(재전송하면 정상). 드문 경우라 보류
- [x] RDS 자동 백업 보관 기간이 7일 이하인지 확인(개인정보처리방침에 "최대 7일"이라고 적음). 2026-10-14 보관 기간 7일로 설정, 리전 간 복제 없음, 수동 스냅샷 없음, AWS Backup 미사용 확인
- [ ] 수입 저장·거래 수정 저장 후 빈 화면 → 뒤로가기 시 앱 종료(이슈 #24): PR #23·#25로 수정, `production` 원격 업데이트 게시 완료, 실기기 확인 대기. 원인·재발 방지 규칙·검증 체크리스트는 `docs/bug-transaction-edit-blank-screen.md`
- [ ] R8 난독화 켜기(Play가 "가독화 파일 없음" 경고, 10-14 versionCode 5 업로드 시): `expo-build-properties` 플러그인으로 `android.enableMinifyInReleaseBuilds: true` 설정 → EAS 빌드 결과물의 `mapping.txt`를 Play에 업로드. 켜면 리플렉션 쓰는 네이티브 모듈이 release에서만 깨질 수 있으니 preview 빌드로 먼저 확인
- [ ] 수입일 공휴일 처리(지금은 토·일만 다음 월요일로 미룸)
- [ ] 캐릭터 홈 단계가 "오늘 예산 사용률" 기준이다. 정산 주기 전체 기준으로 바꾸려면 `/budget/today`에 주기 예산·지출을 추가해야 한다
- [ ] 홈 진행 바에 달리는 캐릭터(1차 피드백, 다음 버전)
- [ ] 웹 개발 모드에서 원그래프·캐릭터 화면에 "Invalid DOM property transform…" 경고(기능 영향 없음)
- [ ] 개발 도구 정리: Codex 작업 브랜치 `SXXNHU/feat-service-frontend`는 rebase 전 원본이다. 원격과 PR은 `SXXNHU/service-frontend`를 쓴다.
