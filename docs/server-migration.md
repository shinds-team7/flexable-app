# 서버 이전 계획 — AWS → 신한 아카데미 VM → 직접 운영

작성 2026-10-26, 같은 날 아카데미 VM 정보를 받아 고침. 진행 상황은 [HANDOFF](HANDOFF.md) 맨 앞 "서버 이전"에 체크한다.

결정(10-26 사용자):

- AWS(EC2 + RDS)를 내리고 신한 아카데미가 준 VM으로 앱 서버(API)·DB를 옮긴다
- **아카데미 VM은 11-18까지만 쓸 수 있다.** 그 뒤에는 팀이 직접 서비스한다(어디서 할지는 미정, §8)

**공개 저장소다.** VM 내부 IP·계정·비밀번호·접속 방법은 여기에 적지 않고 팀 비공개 공간에 둔다.

## 1. 아카데미 VM과 구성

받은 VM(앱 전용, 웹 VM과 별개): 1코어, 메모리 8GB, 디스크 30GB(사용 가능 23GB), Ubuntu 22.04, Docker 설치됨, `sudo` 가능. **내부망 IP**라 밖에서 VM으로 바로 들어올 수 없고, SSH도 아카데미 네트워크 안에서만 된다.

외부 접속 경로: `https://teongjangcare.shinhanacademy.co.kr`(443, **HTTPS는 아카데미가 처리**) → VM 호스트 80번 → 컨테이너. 컨테이너는 HTTP만 받으면 된다.

| | 지금(AWS) | 아카데미 VM |
|---|---|---|
| API 주소 | `https://flex-able-sh.duckdns.org` | `https://teongjangcare.shinhanacademy.co.kr` |
| HTTPS | Caddy + Let's Encrypt | 아카데미 프록시(인증서 갱신도 아카데미) |
| API | EC2 t3.micro(1GB), Docker Compose | VM, Docker Compose, **호스트 80 → api 8080** |
| DB | RDS MySQL `database-flex` | 같은 VM의 MySQL 8 컨테이너(호스트 포트 공개 없음) |
| 백업 | RDS 자동 백업 7일 | 하루 1번 `mysqldump`, 7일 보관 |

Caddy와 DuckDNS는 아카데미 VM에서 쓰지 않는다(내부 IP라 DNS를 돌릴 수 없고 인증서도 받을 수 없음).

## 2. 주소가 바뀌어서 손볼 것

| 대상 | 할 일 | 누가 |
|---|---|---|
| 앱 | EAS 환경변수·`frontend/.env.production`의 `EXPO_PUBLIC_API_URL`을 새 주소로 → production 원격 업데이트(runtime 1.4.1). JS에 들어가는 값이라 새 빌드는 필요 없다 | 코드 PR + 게시는 사람 |
| 업데이트 못 받은 앱 | 원격 업데이트는 다음 실행 때 받으므로 그 전 요청은 옛 주소로 간다. **전환 뒤 약 1주는 EC2에 Caddy만 남겨** 옛 주소 요청을 새 주소로 넘긴다(§6). RDS는 먼저 지운다 | 사람 |
| 카카오 | 개발자 콘솔에 `https://teongjangcare.shinhanacademy.co.kr/api/v1/auth/oauth/kakao/callback` **추가**(옛 콜백은 지우지 않음) | 사람 |
| Google | 같은 경로의 `/google/callback`을 승인된 리디렉션 URI에 추가. ⚠️ **먼저 확인**: OAuth 동의 화면 "승인된 도메인"에 `shinhanacademy.co.kr`(팀 소유 아님)을 넣을 수 있는지. 안 되면 아카데미 기간에는 Google 로그인만 옛 주소(EC2 Caddy)를 거치게 하는 방법을 정한다 | 사람 |
| 서버 `.env` | `OAUTH_CALLBACK_BASE_URL`을 새 주소로. `CORS_ORIGINS`·`OAUTH_ALLOWED_REDIRECT_URIS`(웹·앱 주소)는 그대로 | 사람 |
| 웹(flexable-web) | 웹 서버의 `APP_LINK_BASE_URL`을 새 주소로. 전환 시각을 미리 알린다 | 웹 담당 |
| 서버 감시 | `server-health.yml`의 `API` 주소 변경. 인증서 만료 검사는 아카데미 인증서를 그대로 보게 둔다(만료 10일 전이면 아카데미에 알림) | 코드 PR |
| Play 문서 | `docs/play-store/README.md`의 API 서버 주소·확인 항목 | 코드 PR |

## 3. 코드 준비(PR, 리허설 전)

1. `backend/deploy/docker-compose.yml`: `caddy`를 빼고 `api`에 `ports: ["80:8080"]`, `db`(MySQL 8, 볼륨 `mysql_data`, 포트 공개 없음, healthcheck, `api`는 `depends_on: condition: service_healthy`). AWS용 파일은 전환이 끝날 때까지 남겨 두므로 아카데미용은 `docker-compose.academy.yml`처럼 따로 둔다
2. 메모리: 8GB라 `api` `mem_limit`·`-Xmx`를 올릴 수 있다(예: 1.5g / 1g). 1코어라 기동이 느릴 수 있어 healthcheck `start_period`를 늘린다
3. `.env.example`(아카데미용): `DB_URL=jdbc:mysql://db:3306/flexable?serverTimezone=UTC&characterEncoding=UTF-8&sslMode=DISABLED`(같은 VM 내부라 TLS 없음. RDS용 `sslMode=REQUIRED` 그대로면 접속 실패), `MYSQL_ROOT_PASSWORD` 칸, `OAUTH_CALLBACK_BASE_URL` 새 주소. `API_DOMAIN`은 쓰지 않는다
4. DB 초기화 스크립트: 지금 `setup-db.sh`는 RDS 주소·admin 계정 전용이다. 컨테이너 MySQL에 `flexable` DB(`utf8mb4_0900_ai_ci`)·`flexable_app` 계정(지금과 같은 권한)을 만드는 스크립트를 따로 둔다
5. `backend/deploy/backup-db.sh` + cron: 매일 새벽 `docker compose exec db mysqldump --single-transaction` → `/opt/flexable/backups/flexable-YYYYMMDD.sql.gz`(권한 600), 7일 지난 파일 삭제. 같은 VM에만 있으면 VM이 망가질 때 같이 사라지므로 아카데미 스냅샷 여부를 확인한다
6. `deploy.sh`: 호스트·키·compose 파일을 인자로 받게. **아카데미 네트워크 안의 PC에서 실행해야 한다**(내부 IP)
7. `forward-headers-strategy: framework`는 그대로 둔다. 아카데미 프록시가 `X-Forwarded-Proto: https`를 넘기는지 리허설에서 확인(OAuth 콜백은 `OAUTH_CALLBACK_BASE_URL`을 쓰므로 영향 작음)

## 4. 리허설(운영 영향 없음)

1. VM에서 `/opt/flexable` 준비, 시간대 Asia/Seoul. 메모리가 넉넉해 swap은 선택
2. RDS 버전 확인(`SELECT VERSION();`), MySQL 이미지를 같은 메이저로
3. EC2에서 RDS 덤프(사람, 운영 DB 접속):
   `mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces -h <RDS> -u flexable_app flexable | gzip > dump.sql.gz`
   `flyway_schema_history`가 함께 들어가야 새 서버가 V1~V11을 다시 돌리지 않는다. 덤프는 USB나 안전한 경로로 옮기고 메신저·메일·git에 올리지 않는다
4. `.env` 채우기: 운영 `.env`에서 **`JWT_SECRET`(바꾸면 전원 로그아웃)·`WEB_LINK_SERVICE_KEYS`·카카오·Google 키는 그대로**, `DB_*`·`OAUTH_CALLBACK_BASE_URL`만 바꾼다
5. 복원 → `docker compose up -d` → VM 안에서 `curl localhost/actuator/health`, Flyway 로그 "Schema is up to date", 행 수 비교(`users`, `transactions`, `coin_ledger` 등)
6. 밖에서 `https://teongjangcare.shinhanacademy.co.kr/actuator/health` UP 확인. 로컬 웹(`EXPO_PUBLIC_API_URL`을 새 주소로)으로 로그인·거래 기록 확인
7. 백업 스크립트를 한 번 돌려 파일 생성·복원 확인
8. 끝나면 리허설 DB 삭제(`docker compose down -v`, 덤프 파일 삭제). **운영에서는 `down -v`를 쓰지 않는다**(DB가 통째로 지워진다)

## 5. 전환일(점검 약 30분~1시간)

미리: 카카오·Google 콜백 추가(§2), 앱 원격 업데이트를 preview로 만들어 둔다, 웹 담당·테스터에게 점검 시각 공지.

1. EC2에서 `docker compose stop api`로 쓰기를 멈춘다(EC2 인스턴스는 멈추지 않는다)
2. RDS 덤프 → 아카데미 VM 복원(리허설 3·5) → `docker compose up -d` → 행 수 비교
3. EC2 Caddyfile을 옛 주소 → 새 주소 전달로 바꾼다(§6) → `docker compose up -d caddy`
4. 앱 원격 업데이트 production 승격, 웹 `APP_LINK_BASE_URL` 변경
5. 확인: 새 주소·옛 주소 둘 다 `/actuator/health` UP, 실기기 로그인(이메일·카카오·Google), 거래 추가·수정, 홈 금액, 코인 check-in, 웹 연동 코드 발급 → 웹 입력, 서버 감시 수동 실행 통과
6. backup cron 등록, HANDOFF에 전환 시각·기준 커밋·원격 업데이트 그룹 기록

되돌리기: EC2 Caddyfile을 원래대로 돌리고 `docker compose start api`, 원격 업데이트는 직전 그룹을 다시 게시. **전환 뒤 아카데미 DB에 쌓인 기록은 RDS에 없다** — 몇 시간 안이면 아카데미 DB를 덤프해 RDS로 되돌려 넣는다.

## 6. 옛 주소 전달(EC2, 전환 후 약 1주)

```caddyfile
flex-able-sh.duckdns.org {
	reverse_proxy https://teongjangcare.shinhanacademy.co.kr {
		header_up Host {upstream_hostport}
	}
}
```

`Host`를 새 주소로 바꿔야 아카데미 프록시가 요청을 받는다. 이 기간 EC2에는 DB 연결이 없다. 옛 주소로 오는 요청이 거의 없어지면(Caddy 로그) EC2를 지운다.

## 7. 문서·정책·AWS 정리

- [ ] 개인정보처리방침(사람 결정, `docs/play-store/privacy-policy.md`와 웹 화면을 같은 PR에서): 수탁자 "Amazon Web Services Korea LLC(EC2, RDS)"를 아카데미 제공 주체로(법인명·처리 업무·저장 위치를 아카데미에 확인), 백업 문구를 §1 방식으로. 실서비스 전이라 10-24처럼 별도 고지 없이 반영할지 정한다. 11-18 뒤 다시 바뀌므로 §8과 함께 정해도 된다. Play 데이터 보안 양식도 다시 본다
- [ ] 운영 문서: HANDOFF §5(서버 운영 정보)·§2(SSH 키), `backend/README.md` "운영 배포", `server-health.yml` 이슈 본문의 EC2·RDS 안내, `application.yml` 디스크 주석
- [ ] AWS: 전환 확인 뒤 RDS 삭제(최종 스냅샷을 남기면 7일 안에 삭제), 옛 주소 전달이 끝나면 EC2·EBS·스냅샷·보안 그룹(`flex-api-web`, `ec2-rds-1`) 삭제, 결제 화면에서 과금 항목 확인, `sh-flex.pem` 정리

## 8. 11-18 이후(직접 운영, 미정)

아카데미 VM은 11-18 뒤 못 쓴다. **그 전에** 옮길 곳이 정해져야 한다.

- [ ] 옮길 곳 정하기(사람). 정해지면 이 문서 §3~§5를 그 서버 기준으로 다시 한다(덤프 → 복원 → 주소 전환)
- [ ] **도메인을 사서 이번에는 팀 도메인으로 주소를 고정한다**(HANDOFF §6). 그래야 다음에 서버를 바꿔도 앱 원격 업데이트·OAuth 콜백·웹 설정을 다시 바꾸지 않는다
- [ ] 아카데미 VM에서 데이터 빼기 → 새 서버 확인 뒤 **VM 안의 DB·백업·`.env`를 지우고** 아카데미에 반납(방침의 파기 기준)
- [ ] 11-18 당일에 끊기지 않게, 새 서버 전환을 11-18 며칠 전에 끝낸다

## 9. 일정(목표)

| 날짜 | 할 일 |
|---|---|
| 10-26~10-27 | Google 승인 도메인 확인, 아카데미에 방침용 제공자 정보·스냅샷 여부 문의, §3 코드 PR |
| 10-28~10-29 | §4 리허설 |
| 10-30 전후 | §5 전환(AWS → 아카데미) |
| 11-06 전후 | 옛 주소 전달 종료, AWS 삭제 |
| ~11-10 | §8 다음 서버·도메인 결정 |
| 11-18 전 | 다음 서버로 전환, 아카데미 VM 데이터 삭제·반납 |
