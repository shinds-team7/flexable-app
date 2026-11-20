# 서버 이전 계획 — RDS 삭제, 아카데미 VM, 이후 EC2 로컬 DB(웹도 같은 EC2)

작성 2026-10-26. 진행 상황은 [HANDOFF](HANDOFF.md) "서버 이전"과 "그 다음 할 일"에 체크한다.

**공개 저장소다.** 아카데미 VM 내부 IP·계정·비밀번호, RDS admin 비밀번호, `.env` 값은 여기에 적지 않고 팀 비공개 공간에 둔다. 아래 `<VM>`, `<RDS admin 비밀번호>`는 자리 표시다.

## 0. 결정과 구성

결정(10-26 사용자): 비용 때문에 내린다(2주에 EC2 약 $4, RDS 약 $9). 아카데미 서버를 써야 하는 요건은 없다. **11-18 이후에는 AWS를 계속 쓰되 RDS 없이 EC2 로컬 DB로 서비스한다.** 그 사이에는 RDS만 지우고 EC2는 아카데미 VM으로 넘겨 주는 중계로만 남긴다.

```text
지금      앱·웹 ─▶ flex-able-sh.duckdns.org ─▶ EC2(Caddy ─▶ api) ─▶ RDS
이전 기간  앱·웹 ─▶ flex-able-sh.duckdns.org ─▶ EC2(Caddy 중계) ─▶ https://teongjangcare.shinhanacademy.co.kr ─▶ 아카데미 VM(api ─▶ MySQL)
복귀 뒤   앱·웹 ─▶ flex-able-sh.duckdns.org ─▶ EC2 t3.small(Caddy ─▶ api ─▶ MySQL)
          웹사이트 ─▶ <웹 서브도메인>.duckdns.org ─▶ 같은 EC2(Caddy ─▶ 웹 nginx ─▶ 웹 api ─▶ 웹 MySQL)  — §8
```

- **주소가 그대로라 바꾸지 않는 것**: 앱 `EXPO_PUBLIC_API_URL`(앱 업데이트 없음), 카카오·Google 콜백, 서버 `OAUTH_*`·`CORS_ORIGINS`, 웹 `APP_LINK_BASE_URL`, 서버 감시
- 아카데미 VM: 1코어, 8GB, 디스크 23GB, Ubuntu 22.04, Docker 설치됨, 내부망(SSH는 아카데미 네트워크 안에서만). 외부 443(HTTPS는 아카데미 처리) → VM 호스트 80
- 파일: [`backend/deploy/academy/`](../backend/deploy/academy/)(compose·`.env` 예시·배포. 백업 `backup-db.sh`·행 수 비교 `count-rows.sql`은 11-20부터 `backend/deploy/`), [`backend/deploy/relay/Caddyfile`](../backend/deploy/relay/Caddyfile)(EC2 중계)
- 이전 기간 EC2에는 `/opt/flexable/RELAY_MODE` 파일을 두고, 기존 `backend/deploy/deploy.sh`는 이 파일이 있으면 멈춘다(중계 설정을 덮어쓰지 않게)
- 비용: 이전 기간 EC2만 남아 2주에 약 $4. RDS를 10-31쯤 지우면 11-18까지 약 $11을 아낀다

## 1. 일정

10-26 사용자 결정: §2~§6을 10-26 하루에 진행하려 했고, 리허설까지 끝내고 전환은 10-27로 넘겼다. 전환 직전 웹 담당·테스터에게 점검을 알린다.

| 날짜 | 단계 | 누가 |
|---|---|---|
| 10-26(월) | §2 준비, §3 VM 준비, §4 RDS 버전 확인, §5 리허설 — **완료**(HANDOFF 기록) | 사람 |
| 10-27(화) | §6 전환 | 사람 |
| 10-28(수) 전후 | §7 RDS 삭제(전환 뒤 1~2일 문제 없으면. 그 전까지 RDS가 되돌림 수단) | 사람 |
| 11-20 | §8-1 EC2 로컬 DB·웹 동거 compose PR(아카데미 VM 종료 소식에 맞춰 늦어짐) | Claude |
| VM 종료 전 하루 | §8-2 A 유형 변경·탄력적 IP → B 전환 → C 확인 → E 웹 이전 | 사람(아카데미 PC) |
| 그 뒤 VM 종료 전 | §8-3 아카데미 VM 데이터 삭제 | 사람 |

## 2. 준비(사람)

- [ ] **작업 PC**: 아카데미 네트워크 안의 PC. Git Bash, 이 저장소, `~/.ssh/sh-flex.pem`(권한 600)이 있어야 한다. 이 PC 하나로 EC2(인터넷)와 아카데미 VM(내부망)에 모두 붙는다
- [ ] **EC2 SSH 허용**: 작업 PC의 공인 IP 확인(`curl -s https://checkip.amazonaws.com`) → AWS 콘솔 → EC2 → 보안 그룹 `flex-api-web` → 인바운드 규칙 편집 → SSH(22) 소스를 `<그 IP>/32`로
- [ ] 아카데미에 문의
  - 외부 → `teongjangcare.shinhanacademy.co.kr` → VM 80 연결이 이미 열려 있는지
  - **AWS(EC2)에서 이 주소로 들어오는 요청을 막지 않는지**(중계가 이 경로를 쓴다)
  - VM에서 밖으로 나가는 연결(Docker Hub, apt, 카카오·Google API) 허용
  - 11-18 정확한 종료 시각, VM 스냅샷 유무, 개인정보 처리 위탁에 적을 제공 주체 정보(§9)
- [ ] 웹(flexable-web) 담당·테스터에게 점검 공지(주소는 안 바뀐다고 같이 알림)

## 3. 아카데미 VM 준비(사람)

명령은 **한 줄씩** 붙인다. 채팅 답변을 터미널에서 복사하면 줄 끝에 테두리 문자 `│`가 따라와 명령이 깨진다. VM에서 `sudo`가 필요한 명령은 `ssh -t academy '...'`로 실행한다(터미널이 없으면 비밀번호를 못 받는다).

작업 PC Git Bash에서 SSH 키를 만들고 VM에 등록한다(비밀번호를 매번 치지 않게).

```bash
ssh-keygen -t ed25519 -f ~/.ssh/academy -N ""
cat ~/.ssh/academy.pub | ssh student@<VM> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'

# 이후 `ssh academy`로 붙게
cat >> ~/.ssh/config <<'EOF'
Host academy
  HostName <VM>
  User student
  IdentityFile ~/.ssh/academy
Host flex-ec2
  HostName 3.36.103.99
  User ubuntu
  IdentityFile ~/.ssh/sh-flex.pem
EOF
ssh academy 'hostname && docker --version'
```

VM 안에서 한 번:

```bash
ssh academy
sudo usermod -aG docker "$USER"          # sudo 없이 docker
sudo timedatectl set-timezone Asia/Seoul
sudo mkdir -p /opt/flexable && sudo chown "$USER":"$USER" /opt/flexable
exit
ssh academy 'docker run --rm hello-world | head -3'        # 다시 붙어서 확인
ssh academy 'curl -sI https://kauth.kakao.com | head -1; curl -sI https://oauth2.googleapis.com | head -1; df -h / | tail -1; free -h | head -2'
```

카카오·Google이 `HTTP/2 ...`로 응답해야 소셜 로그인이 된다(응답이 없으면 아카데미에 나가는 연결을 열어 달라고 한다).

## 4. RDS 버전 확인(사람)

```bash
ssh flex-ec2
cd /opt/flexable
export RDS_HOST=database-flex.cdi4cs8mempl.ap-northeast-2.rds.amazonaws.com
read -r -s -p "RDS admin 비밀번호: " MYSQL_PWD; echo; export MYSQL_PWD
docker run --rm -e MYSQL_PWD mysql:8.4 mysql -h "$RDS_HOST" -u admin --ssl-mode=REQUIRED -e 'SELECT VERSION();'
# 아카데미 중계 경로가 AWS에서 닿는지(아직 VM에 서버가 없으니 502·연결 오류라도 TLS 핸드셰이크까지 되면 된다)
curl -sv https://teongjangcare.shinhanacademy.co.kr/ -o /dev/null 2>&1 | grep -E 'SSL connection|HTTP/'
```

10-26 확인: RDS는 **8.4.9**다. 덤프 도구와 VM의 MySQL 모두 `mysql:8.4`를 쓴다.

## 5. 리허설(사람 — 운영 영향 없음)

### 5-1. RDS 덤프(EC2)

```bash
ssh flex-ec2
cd ~ && umask 077
export RDS_HOST=database-flex.cdi4cs8mempl.ap-northeast-2.rds.amazonaws.com
read -r -s -p "RDS admin 비밀번호: " MYSQL_PWD; echo; export MYSQL_PWD
docker run --rm -e MYSQL_PWD mysql:8.4 mysqldump -h "$RDS_HOST" -u admin --ssl-mode=REQUIRED \
  --single-transaction --set-gtid-purged=OFF --no-tablespaces flexable | gzip > dump-rehearsal.sql.gz
ls -lh dump-rehearsal.sql.gz
```

`flyway_schema_history`도 함께 들어가므로 새 서버가 V1~V11을 다시 돌리지 않는다.

### 5-2. `.env`·덤프 옮기기(작업 PC)

```bash
cd ~ && umask 077
scp flex-ec2:/opt/flexable/.env ec2.env
scp flex-ec2:~/dump-rehearsal.sql.gz .

cp ec2.env academy.env
sed -i 's|^DB_URL=.*|DB_URL=jdbc:mysql://db:3306/flexable?serverTimezone=UTC\&characterEncoding=UTF-8\&sslMode=DISABLED\&allowPublicKeyRetrieval=true|' academy.env
printf 'MYSQL_ROOT_PASSWORD=%s\nMYSQL_IMAGE=mysql:8.4\n' "$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)" >> academy.env
grep -E '^(DB_URL|DB_USERNAME|MYSQL_IMAGE|OAUTH_CALLBACK_BASE_URL)=' academy.env      # 값 확인(비밀번호 줄은 출력하지 않음)
grep -c '^DB_PASSWORD=.*\$' academy.env    # 0이어야 한다($가 있으면 compose가 값을 바꿔 버린다)

scp academy.env academy:/opt/flexable/.env
scp dump-rehearsal.sql.gz academy:/opt/flexable/
ssh academy 'chmod 600 /opt/flexable/.env /opt/flexable/dump-rehearsal.sql.gz'
```

`academy.env`는 비밀번호 관리자에 보관하고 PC에서는 지운다(`rm ec2.env academy.env`). `JWT_SECRET`·`WEB_LINK_SERVICE_KEYS`·카카오·Google 값과 `OAUTH_CALLBACK_BASE_URL`(옛 주소)은 EC2 값 그대로다.

### 5-3. DB만 먼저 띄우고 복원(작업 PC → VM)

**api보다 먼저 복원해야 한다.** 빈 DB에 api가 먼저 뜨면 Flyway가 새 스키마를 만들어 복원이 꼬인다.

```bash
# 저장소 루트에서
scp backend/deploy/academy/docker-compose.yml backend/deploy/count-rows.sql academy:/opt/flexable/
ssh academy
cd /opt/flexable
docker compose up -d db
docker compose ps                                   # db가 healthy가 될 때까지(1분 안팎)
gunzip -c dump-rehearsal.sql.gz | docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable'
docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable' < count-rows.sql
exit
```

같은 행 수를 RDS에서도 본다(EC2, 5-1의 변수 그대로):

```bash
scp backend/deploy/count-rows.sql flex-ec2:~/
ssh flex-ec2
export RDS_HOST=database-flex.cdi4cs8mempl.ap-northeast-2.rds.amazonaws.com
read -r -s -p "RDS admin 비밀번호: " MYSQL_PWD; echo; export MYSQL_PWD
docker run --rm -i -e MYSQL_PWD mysql:8.4 mysql -h "$RDS_HOST" -u admin --ssl-mode=REQUIRED flexable < count-rows.sql
```

리허설 중에도 운영은 계속 쓰이므로 숫자가 조금 늘어 있을 수 있다. 전환일(§6)에는 정확히 같아야 한다.

### 5-4. api 배포와 확인

```bash
# 작업 PC, 저장소 루트
backend/deploy/academy/deploy.sh academy
ssh academy 'cd /opt/flexable && docker compose ps && docker compose logs api | grep -E "Flyway|Schema|Started" | tail -5'
ssh academy 'curl -s localhost/actuator/health; echo'
curl -s https://teongjangcare.shinhanacademy.co.kr/actuator/health; echo
```

- 로그에 `Schema \`flexable\` is up to date. No migration necessary`가 나와야 한다
- health가 `{"status":"UP","components":{"db":...}}`면 된다. 1코어라 `Started`까지 1~3분 걸릴 수 있다
- 이메일 로그인 확인(선택, 리허설 DB에만 영향): `frontend/`에서 `EXPO_PUBLIC_API_URL=https://teongjangcare.shinhanacademy.co.kr npx expo start --web` → 테스트 계정 로그인·거래 1건 추가. 소셜 로그인은 콜백이 옛 주소(운영)로 가므로 리허설에서는 하지 않는다

### 5-5. 백업 확인과 정리

```bash
ssh academy
cd /opt/flexable
./backup-db.sh && ls -l backups/
docker compose down -v            # 리허설 DB 삭제(운영에서는 절대 -v 쓰지 않는다)
rm -f dump-rehearsal.sql.gz backups/*.sql.gz
exit
ssh flex-ec2 'rm -f ~/dump-rehearsal.sql.gz'
rm -f ~/dump-rehearsal.sql.gz
```

## 6. 전환(사람, 점검 약 1시간)

이 시간 동안 앱·웹은 서버 오류를 보여 준다. 시작 전 이 절을 처음부터 끝까지 한 번 읽는다.

**6-1. 쓰기 멈춤(EC2)** — EC2 인스턴스는 멈추지 않는다(자동 할당 IP라 멈추면 IP가 바뀐다)

```bash
ssh flex-ec2 'cd /opt/flexable && docker compose stop api && docker compose ps'
```

**6-2. 최종 덤프(EC2)** — 5-1과 같은 명령, 파일 이름만 `dump-final.sql.gz`. 이어서 RDS 행 수(5-3의 RDS 명령)를 화면에 남겨 둔다.

**6-3. 옮기고 복원(작업 PC → VM)**

```bash
cd ~ && umask 077
scp flex-ec2:~/dump-final.sql.gz . && scp dump-final.sql.gz academy:/opt/flexable/
ssh academy
cd /opt/flexable
docker compose up -d db
docker compose ps                                   # db healthy 확인
gunzip -c dump-final.sql.gz | docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable'
docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable' < count-rows.sql    # 6-2의 RDS 숫자와 정확히 같아야 한다
docker compose up -d
docker compose logs -f api                          # Started 나오면 Ctrl+C
curl -s localhost/actuator/health; echo
exit
curl -s https://teongjangcare.shinhanacademy.co.kr/actuator/health; echo
```

행 수가 다르면 여기서 멈추고 6-6 되돌리기.

**6-4. EC2를 중계로 바꾼다(작업 PC, 저장소 루트)**

```bash
scp backend/deploy/relay/Caddyfile flex-ec2:/opt/flexable/Caddyfile.relay
ssh flex-ec2
cd /opt/flexable
cp Caddyfile Caddyfile.aws && cp Caddyfile.relay Caddyfile
touch RELAY_MODE                                   # 기존 deploy.sh가 실수로 돌지 않게
docker compose up -d --no-deps --force-recreate caddy
docker compose ps                                  # caddy만 Up, api는 Exited
exit
curl -s https://flex-able-sh.duckdns.org/actuator/health; echo
```

**6-5. 확인**

- [ ] 옛 주소 health UP(위)
- [ ] 실기기: 이메일·카카오·Google 로그인, 홈 금액, 거래 추가·수정·삭제, 코인 check-in, 상점
- [ ] 웹 연동: 앱에서 6자리 코드 발급 → 웹 입력 → 앱 목록 표시
- [ ] 서버 감시 수동 실행: `gh workflow run server-health.yml && sleep 5 && gh run watch $(gh run list -w server-health.yml -L 1 --json databaseId -q '.[0].databaseId')`
- [ ] 백업 cron 등록:
  ```bash
  ssh academy "(crontab -l 2>/dev/null; echo '0 4 * * * /opt/flexable/backup-db.sh >> /opt/flexable/backups/backup.log 2>&1') | crontab - && crontab -l"
  ```
- [ ] 덤프 정리: `ssh academy 'rm -f /opt/flexable/dump-final.sql.gz'`. EC2·PC의 `dump-final.sql.gz`는 RDS를 지울 때(§7)까지 되돌림용으로 두었다가 같이 지운다
- [ ] HANDOFF에 전환 시각·기준 커밋 기록, 웹 담당에게 완료 알림

**6-6. 되돌리기(문제가 크면)**

```bash
ssh flex-ec2
cd /opt/flexable
cp Caddyfile.aws Caddyfile && rm -f RELAY_MODE
docker compose up -d --force-recreate        # RDS의 api + 원래 Caddy
```

전환 뒤 아카데미 DB에 쌓인 기록은 RDS에 없다. 몇 시간 안이면 아카데미 DB를 덤프해(§8-2와 같은 명령) RDS에 다시 넣는다. RDS를 지운 뒤(§7)에는 RDS로 되돌릴 수 없다.

## 7. RDS 삭제(사람, 전환 뒤 1~2일 문제 없으면)

1. AWS 콘솔 → RDS → 데이터베이스 → `database-flex` → 작업 → 삭제
2. **"최종 스냅샷 생성" 끄기**, **"자동 백업 보존" 끄기**(개인정보처리방침 "백업 최대 7일". 아카데미 VM에 매일 백업이 있다), 확인 문구 입력 → 삭제
3. RDS → 스냅샷에 수동 스냅샷이 남아 있지 않은지 확인
4. EC2 → 보안 그룹: EC2에 붙은 `ec2-rds-1`을 인스턴스에서 떼고(인스턴스 → 작업 → 보안 → 보안 그룹 변경) 그룹 삭제
5. EC2·작업 PC의 `dump-final.sql.gz` 삭제
6. 며칠 뒤 결제(Billing) → 청구서에서 RDS 과금이 멈췄는지 확인

## 8. EC2로 복귀(EC2 로컬 DB, 웹도 같은 EC2)

11-20 owner 결정: 아카데미 VM이 곧 꺼지므로 앱 서버를 EC2로 되돌리고, **웹(flexable-web)도 같은 EC2에 올린다.** 인스턴스는 t3.micro → **t3.small(2GB)**, **탄력적 IP**를 붙인다. 웹 주소는 **같은 DuckDNS 계정의 두 번째 서브도메인**(아래 `<웹 서브도메인>`). 메모리가 모자라면 **앱이 무조건 우선**이다(앱은 계속 운영, 웹은 11-24 면접까지만 살아 있으면 되고 반쯤 죽어 있어도 된다). 결정 기록: [2026-11-20 EC2 복귀와 웹 동거](decisions/2026-11-20-ec2-return-web-cohost.md).

### 8-1. 구성(코드, 이 PR)

```text
앱  ─▶ flex-able-sh.duckdns.org  ─┐                      ┌▶ 127.0.0.1:8080 앱 api ─▶ 앱 MySQL(db)          [backend/deploy/docker-compose.yml]
                                  ├▶ EC2 탄력적 IP:443 Caddy(호스트 네트워크) ┤
웹  ─▶ <웹 서브도메인>.duckdns.org ─┘                      └▶ 127.0.0.1:8081 웹 nginx ─▶ 웹 api ─▶ 웹 MySQL [flexable-web deploy/]
```

- `backend/deploy/docker-compose.yml`: `db`(MySQL 8.4) + `api` + `caddy`. db는 포트를 열지 않고, api는 호스트 `127.0.0.1:8080`에만 연다
- **Caddy는 `network_mode: host`**: 웹 nginx가 호스트 `127.0.0.1:8081`에만 열려 있어서(웹 쪽 계약) 브리지 네트워크의 `host.docker.internal`(host-gateway)로는 닿지 않는다(루프백에 묶인 포트는 docker 게이트웨이 IP로 오는 연결을 받지 않는다). 그래서 Caddy만 호스트 네트워크로 80·443을 직접 받고 두 루프백 포트로 넘긴다. 8080·8081은 밖에서 닿지 않는다
- `Caddyfile`: `API_DOMAIN` → api, `WEB_DOMAIN` → 웹 nginx. 두 도메인 모두 인증서 자동 발급. **접속 기록(`log`)은 켜지 않는다**(앱 방침 "운영 서버는 요청마다 IP 주소 등 접속 기록을 남기지 않습니다"). 웹 접속 기록은 웹 nginx가 웹 방침대로 남긴다. 웹 nginx가 보는 `remote_addr`는 Caddy(루프백·docker 게이트웨이)이므로 실제 IP는 `X-Forwarded-For`에 있다
- `.env.example`: DB가 `db:3306`, `MYSQL_ROOT_PASSWORD`·`MYSQL_IMAGE`·`WEB_DOMAIN` 추가. `setup-db.sh`는 새 서버용으로 빈 비밀값만 채운다(RDS 접속 없음, 이미 있는 값은 안 바꿈)
- `backup-db.sh`(매일 04:00 KST cron, 7일 보관)와 `count-rows.sql`은 `backend/deploy/`로 옮겼다. 백업은 EC2 디스크에만 둔다(S3 등으로 복제하지 않음 — 방침 "수동 스냅샷과 다른 지역으로의 복제는 만들지 않습니다")
- `deploy.sh`: `--upload-only`(파일만 올리고 컨테이너는 그대로 — 복귀 때 DB를 먼저 복원하려고), `.env` 검사(`MYSQL_ROOT_PASSWORD`·`WEB_DOMAIN` 등, DB_URL이 RDS면 멈춤), 기본 접속 주소를 `ubuntu@flex-able-sh.duckdns.org`로(탄력적 IP로 바뀌어도 그대로). `RELAY_MODE`가 있으면 여전히 멈춘다
- `setup-server.sh`: 호스트 MySQL 클라이언트 설치를 뺐다(컨테이너로 접속). swap 2GB는 그대로(이미 있으면 건너뜀)

#### MySQL을 둘 띄우는 이유

앱·웹 각각 자기 compose에 MySQL을 둔다(하나에 DB 두 개를 두지 않는다).

- 하나로 합치면 아끼는 메모리는 약 150~200MB(작게 줄인 mysqld 하나의 기본 사용량)다. 대신 두 저장소의 배포가 한 컨테이너에 묶인다: 웹 compose가 앱 compose 네트워크에 붙어야 하고, MySQL 버전·재시작·root 비밀번호·백업이 앱 쪽 손에 들어간다. 웹 재배포·실수(`down -v`)가 앱 DB를 건드릴 길이 생긴다
- 앱과 웹은 서버·DB·계정을 따로 쓴다는 원칙([AGENTS.md](../AGENTS.md))과 맞고, 하루 만에 끝내야 하는 이전에서 웹 compose를 거의 그대로(포트만 바꿔) 옮길 수 있다
- 150~200MB는 웹 JVM 힙을 줄이는 쪽(웹 api `-Xmx1g` → 320m만으로 600MB 이상)에서 더 크게 얻는다. 앱 우선 원칙에도 맞다: 메모리 압박이 오면 웹 MySQL만 죽고 앱 MySQL은 산다

#### 메모리 예산(t3.small 2,048MiB, swap 2GB)

"평상시"는 Spring Boot·MySQL 8.4의 일반적인 유휴~저부하 사용량으로 잡은 **추정**이다(실측 아님). 전환 뒤 `free -m`·`docker stats --no-stream`으로 실제 값을 이 표 옆에 적는다. "상한"은 compose `mem_limit`(넘으면 그 컨테이너만 OOM으로 재시작).

| 구분 | 프로세스 | 설정 | 평상시(MB) | 상한(MB) |
|---|---|---|---:|---:|
| 공통 | 커널·OS·dockerd·containerd·sshd | — | 200 | — |
| 공통 | Caddy(호스트 네트워크) | `oom_score_adj -300` | 40 | 128 |
| **앱** | api | 힙 `-Xmx448m`, Metaspace 160m, SerialGC(지금 운영값 그대로), `oom_score_adj -500` | 500 | 700 |
| **앱** | MySQL | `innodb_buffer_pool_size=128M`, `performance_schema=OFF`, `max_connections=40`, `temptable_max_ram=64M`, binlog 끔, `oom_score_adj -500` | 220 | 400 |
| | **앱 + 공통 소계** | | **960** | 1,228 |
| 웹 | nginx(호스트 `127.0.0.1:8081`) | | 15 | 64 |
| 웹 | api | **권장** 힙 `-Xmx320m`(지금 1g), `-XX:MaxMetaspaceSize=160m`, SerialGC | 420 | 512 |
| 웹 | MySQL | **권장** `innodb_buffer_pool_size=64M`, `performance_schema=OFF` | 180 | 300 |
| 웹 | worker(시세 수집) | **기본 끔**(`--profile worker`를 켤 때만). 켜면 힙 `-Xmx192m` | (0) / 280 | 320 |
| | **합계** | worker 끔 / 켬 | **1,575 / 1,855** | |

결론:

- **들어간다. 단 웹 쪽 조건이 붙는다**: 웹 api 힙을 1g → 320m로, 모든 웹 컨테이너에 `mem_limit`을 걸고, worker는 기본으로 끈다. 이 조건이면 평상시 약 1.6GB로 RAM 안에 들어가고 약 300MB가 남는다. worker를 켜면 약 1.85GB로 거의 꽉 차고 swap이 받는다
- 지금 웹 compose 그대로(api `-Xmx1g`, worker `-Xmx512m`, `mem_limit` 없음)면 웹만으로 1.5GB를 넘길 수 있어 **들어가지 않는다**
- **웹 이미지를 EC2에서 빌드하지 않는다**: 웹 백엔드 Dockerfile은 Gradle로 jar를 만든다(멀티 스테이지). 다른 컨테이너가 다 떠 있는 2GB에서 Gradle(JDK+데몬 1GB 안팎)을 돌리면 swap 폭주나 OOM이 난다. 웹 이미지는 PC에서 빌드해 옮기거나(`docker save | ssh ... docker load`), 빌드하는 동안 웹 컨테이너를 내린다
- 앱 우선 장치: 앱 컨테이너 `oom_score_adj -500`(커널이 죽일 프로세스를 고를 때 웹이 먼저), 웹은 `mem_limit`으로 웹 안에서만 죽는다. swap은 JVM 힙이 들락거리면 느려지므로 "안 죽게 받치는 것"이지 예산이 아니다
- 경보 기준과 대응: `free -m`의 available이 150MB 아래로 계속 있거나, swap 사용이 1GB를 넘거나, `dmesg | grep -i oom`에 앱 컨테이너가 보이면 → ① 웹 worker 끄기 ② 웹 전체 내리기(`docker compose -p flexable-web stop`) ③ 그래도 모자라면 t3.medium(4GB, 비용 약 2배)으로 올린다(아래 A와 같은 방법, 탄력적 IP라 주소 그대로)

### 8-2. 복귀 절차(사람, 아카데미 네트워크 안의 PC)

**작업 PC**: 아카데미 네트워크 안의 PC 한 대에서 다 한다(§2와 같다). Git Bash, 이 저장소(이 PR이 병합된 최신 `main`), JDK 21, `~/.ssh/sh-flex.pem`(600), `~/.ssh/config`의 `academy`·`flex-ec2` 별칭. 명령은 **위에서부터 한 줄씩** 붙인다(채팅에서 복사해 줄 끝에 `│`가 붙으면 지운다). 특별한 말이 없으면 **저장소 루트**에서 실행한다. `<웹 서브도메인>`은 owner가 DuckDNS에서 정한 이름으로 바꾼다.

전체 순서: **A**(유형 변경·탄력적 IP·DuckDNS, 몇 분 중단, 미리 해도 됨) → **B**(덤프·복원·전환, 점검 약 1시간) → **C**(확인) → 문제가 크면 **D**(되돌리기) → 앱 확인이 끝난 뒤 **E**(웹 이전, 웹 저장소 절차).

#### A. 인스턴스 유형 변경·탄력적 IP·DuckDNS(중계 상태 그대로, 앱 몇 분 중단)

B보다 먼저, 같은 날 또는 전날에 한다. 이 동안 EC2는 계속 아카데미로 중계한다.

0. 작업 PC 공인 IP를 EC2 보안 그룹 `flex-api-web` SSH(22) 소스에 넣는다(§2). `curl -s https://checkip.amazonaws.com`
1. AWS 콘솔(서울 리전) → EC2 → **탄력적 IP** → 탄력적 IP 주소 할당 → 할당(아직 연결하지 않음). 새 IP를 적어 둔다
2. EC2 → 인스턴스 → 앱 EC2 선택 → 인스턴스 상태 → **중지**(여기서부터 앱 중단) → 상태가 "중지됨"이 될 때까지 기다린다
3. 작업 → 인스턴스 설정 → **인스턴스 유형 변경** → `t3.small` → 적용
4. 탄력적 IP → 1의 IP 선택 → 작업 → **주소 연결** → 리소스 유형 인스턴스, 앱 EC2 선택 → 연결
5. 인스턴스 → 인스턴스 상태 → **시작**. 퍼블릭 IPv4가 1의 IP인지 확인
6. https://www.duckdns.org 로그인(담당자 계정, HANDOFF §5-1) → `flex-able-sh`의 current ip를 새 IP로 → update ip. **`<웹 서브도메인>`이 없으면 이때 만들고** 같은 IP로 맞춘다
7. 작업 PC에서 SSH 별칭을 새 주소로 바꾸고 확인:

```bash
sed -i '/^Host flex-ec2/,/^Host /s/^  HostName .*/  HostName flex-able-sh.duckdns.org/' ~/.ssh/config
grep -A3 '^Host flex-ec2' ~/.ssh/config
nslookup flex-able-sh.duckdns.org; nslookup <웹 서브도메인>.duckdns.org
ssh flex-ec2 'nproc; free -m; swapon --show; ls /opt/flexable; docker ps --format "{{.Names}} {{.Status}}"'
curl -s https://flex-able-sh.duckdns.org/actuator/health; echo
```

- `free -m` total이 약 1,900, swap 2,047이면 된다. swap이 없으면 `scp backend/deploy/setup-server.sh flex-ec2:/tmp/ && ssh flex-ec2 'bash /tmp/setup-server.sh'`
- 첫 접속에서 호스트 키 확인을 물으면 `yes`(같은 인스턴스라 키는 같다)
- health가 UP(아카데미 응답)이면 A 끝. Caddy는 재부팅 뒤 자동으로 다시 뜬다(`restart: unless-stopped`)
- MySQL 이미지를 미리 받아 둔다(운영 영향 없음): `ssh flex-ec2 'docker pull mysql:8.4 >/dev/null && docker images mysql'`

#### B. 전환(점검 약 1시간, 앱·웹 연동이 서버 오류를 보여 준다)

시작 전에 이 절을 끝까지 한 번 읽는다. 웹 담당·테스터에게 점검을 알린다.

**B-1. 아카데미 쓰기 멈춤 → 덤프 → 행 수**(덤프는 작업 PC `~`로 바로 받는다)

```bash
umask 077
ssh academy 'cd /opt/flexable && docker compose stop api && docker compose ps'
ssh academy 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysqldump --single-transaction --no-tablespaces -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable"' | gzip > ~/dump-return.sql.gz
gzip -t ~/dump-return.sql.gz && ls -lh ~/dump-return.sql.gz && gzip -cd ~/dump-return.sql.gz | tail -1
ssh academy 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable"' < backend/deploy/count-rows.sql > ~/rows-academy.txt
cat ~/rows-academy.txt
```

덤프 마지막 줄이 `-- Dump completed on ...`이어야 한다. `Using a password on the command line` 경고는 무시한다.

**B-2. EC2 `.env` 만들기**(아카데미 `.env`가 지금 운영 값이다. `DB_URL`이 이미 `db:3306`이고 `MYSQL_ROOT_PASSWORD`가 있다)

```bash
scp academy:/opt/flexable/.env ~/ec2-new.env
grep -q '^API_DOMAIN=' ~/ec2-new.env || echo 'API_DOMAIN=flex-able-sh.duckdns.org' >> ~/ec2-new.env
sed -i '/^WEB_DOMAIN=/d' ~/ec2-new.env && echo 'WEB_DOMAIN=<웹 서브도메인>.duckdns.org' >> ~/ec2-new.env
grep -E '^(API_DOMAIN|WEB_DOMAIN|DB_URL|DB_USERNAME|MYSQL_IMAGE|OAUTH_CALLBACK_BASE_URL)=' ~/ec2-new.env
grep -cE '^(DB_PASSWORD|MYSQL_ROOT_PASSWORD|JWT_SECRET|WEB_LINK_SERVICE_KEYS)=.' ~/ec2-new.env
ssh flex-ec2 'cd /opt/flexable && cp .env .env.relay-era && ls -l .env*'
scp ~/ec2-new.env flex-ec2:/opt/flexable/.env && ssh flex-ec2 'chmod 600 /opt/flexable/.env'
```

- 위 `grep -E`에서 `DB_URL`이 `jdbc:mysql://db:3306/flexable?...sslMode=DISABLED...`, `OAUTH_CALLBACK_BASE_URL`이 `https://flex-able-sh.duckdns.org`인지 본다
- `grep -c` 결과가 **4**여야 한다(비밀값 줄은 화면에 내지 않는다)

**B-3. 중계 해제 표시 → 새 파일 올리기 → 덤프 올리기**(이때 EC2의 중계 Caddy는 아직 옛 설정으로 돌고 있다. 새 Caddyfile은 B-5에서 적용된다)

```bash
ssh flex-ec2 'cd /opt/flexable && cp Caddyfile Caddyfile.relay-backup && rm -f RELAY_MODE && ls'
backend/deploy/deploy.sh --upload-only flex-ec2
scp ~/dump-return.sql.gz flex-ec2:/opt/flexable/ && ssh flex-ec2 'chmod 600 /opt/flexable/dump-return.sql.gz'
```

**B-4. EC2 DB만 띄우고 복원 → 행 수 비교**(**api보다 먼저** 복원한다. 빈 DB에 api가 먼저 뜨면 Flyway가 새 스키마를 만들어 복원이 꼬인다)

```bash
ssh flex-ec2 'cd /opt/flexable && docker compose up -d db'
ssh flex-ec2 'cd /opt/flexable && until [ "$(docker inspect -f "{{.State.Health.Status}}" $(docker compose ps -q db))" = healthy ]; do sleep 3; done; echo db healthy'
ssh flex-ec2 'cd /opt/flexable && gunzip -c dump-return.sql.gz | docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable" && echo restored'
ssh flex-ec2 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable" < count-rows.sql' > ~/rows-ec2.txt
diff ~/rows-academy.txt ~/rows-ec2.txt && echo "행 수 같음"
```

**`행 수 같음`이 안 나오면 여기서 멈추고 D(되돌리기).** db가 healthy가 안 되면 `ssh flex-ec2 'cd /opt/flexable && docker compose logs db | tail -30'`.

**B-5. 전체 기동**(jar를 다시 빌드해 올리고 api·Caddy를 새 설정으로 띄운다. Caddy가 호스트 네트워크로 바뀌며 두 도메인 인증서를 받는다)

```bash
backend/deploy/deploy.sh flex-ec2
ssh flex-ec2 'cd /opt/flexable && until [ "$(docker inspect -f "{{.State.Health.Status}}" $(docker compose ps -q api))" = healthy ]; do sleep 5; done; echo api healthy'
ssh flex-ec2 'cd /opt/flexable && docker compose ps && docker compose logs api | grep -E "Flyway|Schema|Started" | tail -5'
ssh flex-ec2 'cd /opt/flexable && docker compose logs caddy | grep -iE "certificate obtained|error" | tail -5'
curl -s https://flex-able-sh.duckdns.org/actuator/health; echo
```

- 로그에 `Schema \`flexable\` is up to date. No migration necessary`(운영 V30)
- health가 `{"status":"UP",...}`. 웹 도메인은 웹 nginx가 뜨기 전(E)까지 502가 정상이다

#### C. 확인

- [ ] 공개 health UP(위), `ssh flex-ec2 'curl -s localhost:8080/actuator/health; echo'`
- [ ] 실기기: 이메일·카카오·Google 로그인, 홈 금액, 거래 추가·수정·삭제, 코인 check-in, 상점, 거래내역서 PDF 업로드(10MB 한도)
- [ ] 웹 연동(웹이 아직 아카데미에 있어도 된다): 앱에서 6자리 코드 발급 → 웹 입력 → 앱 목록 표시
- [ ] 서버 감시 수동 실행: `gh workflow run server-health.yml`
- [ ] 백업 한 번 돌리고 cron 등록:
  ```bash
  ssh flex-ec2 '/opt/flexable/backup-db.sh && ls -l /opt/flexable/backups/'
  ssh flex-ec2 "(crontab -l 2>/dev/null | grep -v backup-db.sh; echo '0 4 * * * /opt/flexable/backup-db.sh >> /opt/flexable/backups/backup.log 2>&1') | crontab - && crontab -l"
  ```
- [ ] 메모리 기록: `ssh flex-ec2 'free -m; docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"'` → 8-1 표 옆에 실측값
- [ ] 아카데미 VM 백업 cron 끄기(빈 api로 덤프만 쌓이지 않게, DB는 D를 위해 남긴다): `ssh academy 'crontab -l | grep -v backup-db.sh | crontab -; crontab -l'`
- [ ] 정리: `ssh flex-ec2 'rm -f /opt/flexable/dump-return.sql.gz'`. 작업 PC의 `~/dump-return.sql.gz`·`~/ec2-new.env`는 비밀번호 관리자로 옮기거나 8-3 때 지운다. EC2의 `.env.relay-era`·`Caddyfile.aws`·`Caddyfile.relay-backup`은 8-3 때 지운다
- [ ] HANDOFF에 전환 시각·기준 커밋·실측 메모리 기록, 웹 담당에게 완료 알림

#### D. 되돌리기(문제가 크면, 아카데미 VM이 살아 있는 동안만)

아카데미 DB는 B-1에서 api만 멈췄으므로 그대로 있다. **EC2가 쓰기를 받았는지**에 따라 둘 중 하나를 한다.

**D-1. B-5 전에 멈춘 경우**(행 수가 다르거나 db·api가 안 뜸. EC2 api가 요청을 받은 적 없음): 아카데미 DB를 그대로 쓴다.

```bash
ssh flex-ec2 'cd /opt/flexable && docker compose stop api; cp Caddyfile.relay-backup Caddyfile && touch RELAY_MODE && docker compose up -d --no-deps --force-recreate caddy && docker compose ps'
ssh academy 'cd /opt/flexable && docker compose start api && docker compose ps'
curl -s https://flex-able-sh.duckdns.org/actuator/health; echo
```

**D-2. B-5 뒤**(EC2가 이미 운영 요청을 받음): EC2에 쌓인 기록을 아카데미로 먼저 옮기고 나서 중계로 돌린다. 양쪽 api가 모두 멈춘 상태에서 한다(덤프는 테이블을 지우고 다시 만드는 형식이라, 아카데미 api를 먼저 켜면 그 사이 기록이 덮인다).

```bash
ssh flex-ec2 'cd /opt/flexable && docker compose stop api && docker compose ps'
ssh flex-ec2 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysqldump --single-transaction --no-tablespaces -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable"' | gzip > ~/dump-back.sql.gz
gzip -t ~/dump-back.sql.gz && gzip -cd ~/dump-back.sql.gz | tail -1
ssh flex-ec2 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable" < count-rows.sql' > ~/rows-ec2-back.txt
gzip -cd ~/dump-back.sql.gz | ssh academy 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable" && echo restored'
ssh academy 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable"' < backend/deploy/count-rows.sql > ~/rows-academy-back.txt
diff ~/rows-ec2-back.txt ~/rows-academy-back.txt && echo "행 수 같음"
```

`행 수 같음`이 나온 뒤에만 D-1의 세 줄(중계로 돌리기 → 아카데미 api 시작 → health)을 실행한다. 다르면 두 api를 멈춘 채로 두고 원인을 본다(EC2 DB가 원본이다). 끝나면 `rm -f ~/dump-back.sql.gz ~/rows-*-back.txt`.

- 중계 Caddyfile은 호스트 네트워크 Caddy에서도 그대로 동작한다. EC2 db는 켜 둔 채 두어도 된다(쓰는 곳 없음)
- 아카데미 VM이 꺼진 뒤에는 되돌릴 곳이 없다

#### E. 웹 이전(앱 확인이 끝난 뒤, 웹 저장소 절차)

웹은 flexable-web 저장소 `deploy/` 문서를 따른다. 이 EC2에서 지켜야 하는 것:

- 웹 compose는 80·443을 열지 않는다. nginx는 **호스트 `127.0.0.1:8081`에만** 바인딩한다(앱 Caddy가 받는다)
- 모든 웹 컨테이너에 `mem_limit`(8-1 표), 웹 api 힙 320m, worker는 기본으로 끈다
- 웹 이미지는 EC2에서 Gradle로 빌드하지 않는다(8-1)
- 웹 소셜 로그인은 웹 서버가 따로 처리한다. 웹 `.env`의 `OAUTH_CALLBACK_BASE_URL`·`OAUTH_ALLOWED_REDIRECT_URIS`를 `https://<웹 서브도메인>.duckdns.org`로 바꾸고, 카카오·Google 콘솔에 새 콜백을 등록한다(웹 담당). 앱 서버 `.env`의 OAuth 값은 바꾸지 않는다(앱 주소 그대로)
- 웹 서버 → 앱 서버 연동(`APP_LINK_BASE_URL`)은 계속 `https://flex-able-sh.duckdns.org`. 같은 EC2라도 공인 주소로 나갔다 들어온다(동작함)
- 웹 확인 뒤 `https://<웹 서브도메인>.duckdns.org`가 열리는지, `free -m`이 8-1 경보 기준 안인지 본다

### 8-3. 아카데미 VM 정리(사람, 전환 뒤 문제없고 웹도 옮긴 뒤, VM 종료 전)

```bash
ssh academy 'crontab -r; cd /opt/flexable && docker compose down -v && docker image prune -af'
ssh -t academy 'sudo rm -rf /opt/flexable'
rm -f ~/dump-return.sql.gz ~/ec2-new.env ~/rows-academy.txt ~/rows-ec2.txt
ssh flex-ec2 'cd /opt/flexable && rm -f .env.relay-era Caddyfile.aws Caddyfile.relay-backup Caddyfile.relay dump-*.sql.gz && ls'
```

`~/.ssh/config`의 `academy` 항목과 `~/.ssh/academy*` 키도 지운다. 아카데미에 반납 완료를 알린다. 웹 VM 정리는 웹 저장소 절차.

**`auth.log`는 따로 보관하지 않는다(앱 개인정보처리방침 기준 확인, 11-20).**

- VM의 `/var/log/auth.log*`에는 운영자 계정의 SSH 로그인·`sudo` 기록과 접속한 PC의 내부 IP만 있다. 앱 이용자 정보는 없다: api·MySQL·Caddy는 syslog에 쓰지 않고, 컨테이너 로그는 `docker compose down`으로 함께 지워진다
- 앱 방침 2항은 "운영 서버: 요청마다 IP 주소 등 접속 기록을 남기지 않습니다"이고, 3항 보유 기간 표에 서버 접속 기록 항목이 없으며, "법령에 따라 따로 보존해야 하는 정보"로 적은 것도 없다. 방침이 보관을 약속하거나 요구하는 기록이 아니므로 VM과 함께 지워져도 된다
- 남는 질문(owner 판단, 방침·결정 기록에 없음): 「개인정보의 안전성 확보조치 기준」의 개인정보취급자 접속기록(1년 이상) 보관을 이 서비스에 적용할지. 적용하더라도 `auth.log`는 SSH 로그인만 있고 처리한 정보주체·수행 업무가 없어 그 접속기록을 대신하지 못한다. 그래도 보관하기로 하면 정리 전에 `ssh -t academy 'sudo tar czf /tmp/authlog.tgz /var/log/auth.log* && sudo chown $USER /tmp/authlog.tgz' && scp academy:/tmp/authlog.tgz ~/academy-authlog.tgz`로 받아 팀 비공개 공간에 두고(VM 주소·계정이 들어 있다) 저장소에는 넣지 않는다

## 9. 문서·정책 후속

- [x] **개인정보처리방침: 수탁자 표에 아카데미를 넣지 않는다**(10-26 사용자 결정 — EC2로 돌아오고 이후 쓰지 않으므로). 복귀 뒤 백업 문구(RDS 자동 백업 → EC2 매일 백업 7일)는 이미 "백업 7일, 수동 스냅샷·다른 지역 복제 없음"으로 실제 방식(8-1 `backup-db.sh`)과 맞는다. 바꿀 필요가 있으면 따로 PR
- [ ] 운영 문서(8-2 뒤): HANDOFF §5(RDS·DB 조회 방법, EC2 주소), `server-health.yml` 이슈 본문의 RDS 안내. `backend/README.md` "운영 배포"·`setup-db.sh`는 이 PR에서 바꿨다
