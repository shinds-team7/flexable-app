# 서버 이전 계획 — AWS → 신한 아카데미 VM

작성 2026-10-26. 결정(10-26 사용자): AWS(EC2 + RDS)를 내리고 **11-18까지** 신한 아카데미가 제공하는 VM으로 앱 서버(API)를 옮긴다. 진행 상황은 [HANDOFF](HANDOFF.md) 맨 앞 "서버 이전"에 체크한다.

**공개 저장소다.** 새 VM의 IP·계정·접속 방법·비밀번호는 여기에 적지 않고 팀 비공개 공간에 둔다.

## 1. 구성

| | 지금(AWS) | 이전 후(아카데미) |
|---|---|---|
| 웹(flexable-web) | 별도 | 아카데미 VM 1(이미 사용 중, 이 계획에서 건드리지 않음) |
| 앱 API + Caddy | EC2 t3.micro(1GB), Docker Compose | **아카데미 VM 2(새로 요청)**, 같은 Docker Compose |
| 앱 DB | RDS MySQL `database-flex` | VM 2 안의 MySQL 컨테이너(외부 포트 열지 않음) |
| 백업 | RDS 자동 백업 7일 | VM 2에서 하루 1번 `mysqldump`, 7일 지난 파일 삭제 |
| 주소 | `flex-able-sh.duckdns.org` | **같은 주소**(DuckDNS IP만 바꿈) |

웹 VM에 함께 올리지 않는 이유: 웹·앱은 서버·DB·계정을 따로 운영하기로 했고(10-20), 둘 다 80·443을 쓰며, 한쪽 배포·장애가 다른 쪽에 번진다. DB를 VM 하나 더 받아 나누지 않는 이유: 비공개 테스트 규모라 같은 VM으로 충분하고 VM·방화벽 관리만 늘어난다.

주소를 그대로 쓰므로 바꾸지 않아도 되는 것: 앱 `EXPO_PUBLIC_API_URL`(재빌드·원격 업데이트 불필요), 웹 `APP_LINK_BASE_URL`, 카카오·Google 콜백, `OAUTH_*`·`CORS_ORIGINS`, 서버 감시 주소.

## 2. VM 요청할 때 확인할 것(사람)

- [ ] 사양: 메모리 4GB 권장(최소 2GB + swap), 디스크 30GB 이상, Ubuntu 22.04 이상
- [ ] **공인 IP 고정** 여부. 바뀌면 DuckDNS를 다시 갱신해야 한다
- [ ] 외부에서 80·443 접속 가능(Let's Encrypt 인증서 발급에 80이 필요), 22는 관리자 IP만 또는 아카데미 방식(VPN·점프 서버 등)
- [ ] 밖으로 나가는 연결 허용: Docker Hub·apt(설치), Let's Encrypt, 카카오·Google(소셜 로그인), DuckDNS
- [ ] **사용 기간**: 11-18 이후에도 계속 쓸 수 있는지, 끝나면 데이터를 어떻게 처리하는지(방침의 보관·파기와 연결)
- [ ] 아카데미 쪽 백업·스냅샷 유무와 보관 기간(방침 "백업 최대 7일"과 맞아야 한다)
- [ ] 개인정보 처리 위탁에 필요한 제공자 정보(법인명·처리 업무·저장 위치) — §6 방침 개정에 쓴다

## 3. 코드 준비(PR, 리허설 전)

1. `backend/deploy/docker-compose.yml`에 `db`(MySQL 8, 볼륨 `mysql_data`, 포트 공개 없음, `api`는 `depends_on` + healthcheck) 추가. RDS 버전을 먼저 확인해(`SELECT VERSION();`) 같은 메이저로 맞춘다
2. `.env.example`: `DB_URL=jdbc:mysql://db:3306/flexable?...`(같은 VM 내부 통신), `MYSQL_ROOT_PASSWORD` 칸 추가. 메모리가 4GB면 `mem_limit`·`-Xmx`는 지금 값 유지로 시작
3. `setup-db.sh`를 RDS 전용에서 컨테이너 MySQL용으로 바꾸거나 새 스크립트로 분리(앱 계정 `flexable_app` 권한은 지금과 같게)
4. `backend/deploy/backup-db.sh` + cron: 매일 새벽 `mysqldump --single-transaction` → `/opt/flexable/backups/flexable-YYYYMMDD.sql.gz`, 7일 지난 파일 삭제, 권한 600
5. `deploy.sh`: 기본 호스트·키는 **전환이 끝난 뒤** 새 서버로 바꾼다(그 전에는 `deploy.sh <새 호스트>`로 넘김)

## 4. 리허설(VM 받은 뒤, 운영 영향 없음)

1. `setup-server.sh`로 Docker·swap·시간대 설정, `/opt/flexable` 준비
2. EC2에서 RDS를 덤프해 새 VM으로 옮긴다(사람, 운영 DB 접속):
   `mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces -h <RDS> -u flexable_app flexable | gzip > dump.sql.gz`
   (`flyway_schema_history`가 함께 들어가야 새 서버가 V1~V11을 다시 돌리지 않는다)
3. 새 VM에 `.env`를 채운다(운영 `.env`에서 `DB_URL`만 바꾸고 **`JWT_SECRET`·`WEB_LINK_SERVICE_KEYS`·OAuth 값은 그대로**). 키 파일·`.env`는 USB나 비밀번호 관리자로 옮긴다(메신저·메일·git 금지)
4. 복원 → `docker compose up -d db api`(Caddy는 DNS가 아직 EC2라 인증서를 못 받으니 띄우지 않는다)
5. VM 안에서 `curl localhost:8080/actuator/health`(UP), Flyway 로그 "Schema is up to date", 행 수 비교(`users`, `transactions`, `coin_ledger` 등)
6. 백업 스크립트 한 번 실행해 파일 생성·복원 가능 확인
7. 끝나면 리허설 DB를 지운다(`docker compose down -v`, 덤프 파일 삭제). 운영 데이터 사본을 남겨 두지 않는다

## 5. 전환일(점검 약 30분, 사용 적은 시간)

미리: 웹 담당·테스터에게 점검 시각 공지. 전날 DuckDNS는 TTL이 짧아(약 60초) 따로 준비할 것은 없다.

1. EC2에서 `docker compose stop api` — 쓰기를 멈춘다(EC2 인스턴스는 **멈추지 않는다**. 자동 할당 IP라 멈추면 되돌릴 곳이 사라진다)
2. RDS 덤프 → 새 VM 복원(리허설 2·4와 같은 명령) → `docker compose up -d db api`
3. 행 수 비교(리허설 5)
4. DuckDNS를 새 VM IP로 변경 → `docker compose up -d caddy` → Caddy 로그에서 인증서 발급 확인
5. 확인: 공개 `/actuator/health`(db·diskSpace 포함 UP), 앱 실기기 로그인(이메일·카카오·Google), 거래 추가·수정, 홈 금액, 코인 check-in, 웹 연동 코드 발급 → 웹 입력, 서버 감시 워크플로 수동 실행(Run workflow) 통과
6. backup cron 등록, HANDOFF에 전환 시각·기준 커밋 기록

되돌리기(전환 뒤 문제가 크면): DuckDNS를 EC2 IP로 되돌리고 EC2 `docker compose start api`. **전환 뒤 새 서버에 쌓인 기록은 RDS에 없다.** 몇 시간 안이면 새 서버 DB를 덤프해 RDS로 되돌려 넣고, 그보다 늦으면 새 서버에서 고치는 쪽으로 간다.

## 6. 문서·정책 후속

- [ ] 개인정보처리방침(사람 결정, `docs/play-store/privacy-policy.md`와 웹 화면을 같은 PR에서): 수탁자 표의 "Amazon Web Services Korea LLC(EC2, RDS)"를 새 제공자로, 백업 문구를 §1 방식으로. 실서비스 전이라 10-24처럼 별도 고지 없이 반영할지, 개정 이력에 남길지 정한다. Play 데이터 보안 양식도 다시 본다
- [ ] `docs/HANDOFF.md` §5 서버 운영 정보(EC2·RDS·보안 그룹·DB 조회 방법), §2 "따로 챙길 것"(SSH 키), `backend/README.md` "운영 배포", `server-health.yml` 이슈 본문의 EC2·RDS 안내, `application.yml` 디스크 주석을 새 서버 기준으로

## 7. AWS 정리(전환 후 약 1주 문제없으면, 11-18 전)

- [ ] RDS `database-flex` 삭제. 최종 스냅샷을 남기면 방침(백업 최대 7일)대로 7일 안에 지운다
- [ ] EC2 종료, 남은 EBS·스냅샷·보안 그룹(`flex-api-web`, `ec2-rds-1`) 삭제, 결제 화면에서 과금 항목이 없는지 확인
- [ ] 작업 PC의 `sh-flex.pem` 정리

## 8. 일정(목표)

| 날짜 | 할 일 |
|---|---|
| 10-26~ | VM 2 요청, §2 확인 |
| VM 받은 날~+2일 | §3 코드 PR, §4 리허설 |
| 11-04 전후 | §5 전환 |
| 전환 후 ~1주 | 상태 지켜보기, §6 문서 |
| 11-13 전후 | §7 AWS 정리(11-18 마감 여유) |
