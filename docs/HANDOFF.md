# 인수인계 — 서비스 1.0.0 Google Play 비공개 테스트

마지막 갱신 2026-10-13. 다른 PC나 다른 사람이 이어서 작업할 때 이 문서부터 읽는다.
비밀값(키 파일, 비밀번호)은 이 문서와 저장소에 없다. "§2 따로 챙길 것"을 보고 안전한 경로로 옮긴다.

## 1. 지금 상태

| 영역 | 상태 | 위치 |
|---|---|---|
| API 서버 | 운영 중 | `https://flex-able-sh.duckdns.org/api/v1` (EC2 + RDS), 코드 `backend/`, 계약 `docs/API.md` |
| 웹 | Vercel이 `main`을 자동 배포 | `https://project2-flex-sh.vercel.app` (`/demo` 시연, `/privacy`·`/terms`·`/support`·`/delete-account` 공개 페이지) |
| 앱 서비스 화면 | 완료, 운영 API로 E2E 4개 통과 | `frontend/src/service/`, `frontend/src/app/` (상세는 `frontend/SERVICE_1_0_0_REPORT.md`) |
| Play 제출 자료 | 초안·그래픽·스크린샷 완료 | `docs/play-store/` |
| 심사용 계정 | 운영 서버에 생성 완료 | `play.review@flexable.app` (비밀번호는 §2) |
| Android 빌드 | **아직 안 함** | §4-2 |
| Play Console | **아직 안 함** | §4-3 |

## 2. 따로 챙길 것 (저장소에 없음)

| 항목 | 어디에 있나 | 새 PC에서 |
|---|---|---|
| EC2 SSH 키 `sh-flex.pem` | 기존 PC 바탕화면 | 메신저·메일·git으로 보내지 말고 USB나 비밀번호 관리자로 옮긴다. `~/.ssh/sh-flex.pem`, 권한 600 |
| RDS 마스터(admin) 비밀번호 | 담당자가 보관 | 평소에는 필요 없음(앱은 `flexable_app` 계정 사용) |
| 서버 비밀값(DB 앱 비밀번호, JWT 비밀키) | EC2 `/opt/flexable/.env`에만 있음 | 옮길 필요 없음. **JWT_SECRET을 바꾸면 모든 사용자가 로그아웃됨** |
| 심사용 계정 비밀번호 | 2026-10-13 대화로 전달 | 팀 비밀번호 보관함에 저장 → Play Console 앱 액세스에 입력 |
| Expo 계정 | — | EAS 빌드에 필요. 팀 계정으로 만들고 로그인 |
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

- 운영 웹 빌드는 `frontend/.env.production`(공개 API 주소)를 쓴다. 앱 빌드는 `eas.json` 프로필 env를 쓴다.
- 운영 API의 CORS는 `https://project2-flex-sh.vercel.app`과 `http://localhost:8081`만 허용한다.
- Windows Git Bash에서 `curl -d '한글'`은 깨져서 400이 난다. 한글 요청은 UTF-8 파일(`--data-binary @file.json`)로 보낸다.

## 4. 남은 일 (순서대로)

### 4-1. 웹 공개 페이지 확인
Play Console에 URL을 넣기 전에 아래 주소가 로그인 없이 열리는지 본다.
`/privacy`, `/terms`, `/support`, `/delete-account` (모두 `https://project2-flex-sh.vercel.app` 아래)

### 4-2. Android 빌드 (EAS)

```bash
cd frontend
npx eas-cli@latest login
npx eas-cli@latest init          # app.json에 extra.eas.projectId·owner가 추가된다 → 커밋
# 1) 실기기 확인용 APK
npx eas-cli@latest build -p android --profile preview
# 2) Play 업로드용 AAB (versionCode 원격 자동 증가, Play 앱 서명 사용)
npx eas-cli@latest build -p android --profile production
```

실기기(APK)에서 확인할 것: 가입·로그인, 예산 설정 키보드·스크롤, 거래 입력 바텀시트, 글꼴 크게 설정, 앱 재시작 후 로그인 유지(SecureStore), `flexable://demo` 딥링크가 시작 화면으로 가는지, 계정 삭제.

### 4-3. Play Console
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

## 6. 미뤄 둔 일

- [ ] 도메인 구매 → 서버 `.env`의 `API_DOMAIN`, `frontend/.env.production`, `eas.json`의 `EXPO_PUBLIC_API_URL` 변경 → 앱 재빌드
- [ ] EC2 탄력적 IP 할당(지금은 자동 할당 IP라 인스턴스를 멈추면 바뀜 → DuckDNS 갱신 필요)
- [ ] 문의 이메일을 팀 계정으로 교체: `frontend/src/service/config.ts`, `docs/play-store/*.md`, Play Console
- [ ] API 요청(Codex): `GET /budget/today`에 주간 사용 가능액, 전체 거래 유무. 지금은 "이번 주 쓴 돈", "이번 정산 주기에 기록한 거래가 없어요"로 표시
- [ ] 같은 `Idempotency-Key`로 동시에 들어온 요청은 하나가 500을 받는다(재전송하면 정상). 드문 경우라 보류
- [ ] RDS 자동 백업 보관 기간이 7일 이하인지 확인(개인정보처리방침에 "최대 7일"이라고 적음)
- [ ] 개발 도구 정리: Codex 작업 브랜치 `SXXNHU/feat-service-frontend`는 rebase 전 원본이다. 원격과 PR은 `SXXNHU/service-frontend`를 쓴다.
