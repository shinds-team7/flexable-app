# 서버 이전 계획 — RDS 삭제, 11-18까지 아카데미 VM, 이후 EC2 로컬 DB

작성 2026-10-26. 진행 상황은 [HANDOFF](HANDOFF.md) 맨 앞 "서버 이전"에 체크한다.

**공개 저장소다.** 아카데미 VM 내부 IP·계정·비밀번호, RDS admin 비밀번호, `.env` 값은 여기에 적지 않고 팀 비공개 공간에 둔다. 아래 `<VM>`, `<RDS admin 비밀번호>`는 자리 표시다.

## 0. 결정과 구성

결정(10-26 사용자): 비용 때문에 내린다(2주에 EC2 약 $4, RDS 약 $9). 아카데미 서버를 써야 하는 요건은 없다. **11-18 이후에는 AWS를 계속 쓰되 RDS 없이 EC2 로컬 DB로 서비스한다.** 그 사이에는 RDS만 지우고 EC2는 아카데미 VM으로 넘겨 주는 중계로만 남긴다.

```text
지금      앱·웹 ─▶ flex-able-sh.duckdns.org ─▶ EC2(Caddy ─▶ api) ─▶ RDS
이전 기간  앱·웹 ─▶ flex-able-sh.duckdns.org ─▶ EC2(Caddy 중계) ─▶ https://teongjangcare.shinhanacademy.co.kr ─▶ 아카데미 VM(api ─▶ MySQL)
11-18 뒤  앱·웹 ─▶ flex-able-sh.duckdns.org ─▶ EC2(Caddy ─▶ api ─▶ MySQL)
```

- **주소가 그대로라 바꾸지 않는 것**: 앱 `EXPO_PUBLIC_API_URL`(앱 업데이트 없음), 카카오·Google 콜백, 서버 `OAUTH_*`·`CORS_ORIGINS`, 웹 `APP_LINK_BASE_URL`, 서버 감시
- 아카데미 VM: 1코어, 8GB, 디스크 23GB, Ubuntu 22.04, Docker 설치됨, 내부망(SSH는 아카데미 네트워크 안에서만). 외부 443(HTTPS는 아카데미 처리) → VM 호스트 80
- 파일: [`backend/deploy/academy/`](../backend/deploy/academy/)(compose·`.env` 예시·배포·백업·행 수 비교), [`backend/deploy/relay/Caddyfile`](../backend/deploy/relay/Caddyfile)(EC2 중계)
- 이전 기간 EC2에는 `/opt/flexable/RELAY_MODE` 파일을 두고, 기존 `backend/deploy/deploy.sh`는 이 파일이 있으면 멈춘다(중계 설정을 덮어쓰지 않게)
- 비용: 이전 기간 EC2만 남아 2주에 약 $4. RDS를 10-31쯤 지우면 11-18까지 약 $11을 아낀다

## 1. 일정

10-26 사용자 결정: §2~§6을 10-26 하루에 진행하려 했고, 리허설까지 끝내고 전환은 10-27로 넘겼다. 전환 직전 웹 담당·테스터에게 점검을 알린다.

| 날짜 | 단계 | 누가 |
|---|---|---|
| 10-26(월) | §2 준비, §3 VM 준비, §4 RDS 버전 확인, §5 리허설 — **완료**(HANDOFF 기록) | 사람 |
| 10-27(화) | §6 전환 | 사람 |
| 10-28(수) 전후 | §7 RDS 삭제(전환 뒤 1~2일 문제 없으면. 그 전까지 RDS가 되돌림 수단) | 사람 |
| ~11-10 | §8 EC2 로컬 DB용 compose PR | Claude |
| 11-14~11-16 | §8 EC2로 복귀 | 사람 |
| 11-17 | §8 아카데미 VM 데이터 삭제 | 사람 |

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
scp backend/deploy/academy/docker-compose.yml backend/deploy/academy/count-rows.sql academy:/opt/flexable/
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
scp backend/deploy/academy/count-rows.sql flex-ec2:~/
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

## 8. 11-18 전 EC2로 복귀(EC2 로컬 DB)

### 8-1. 준비(Claude, ~11-10, PR)

- `backend/deploy/docker-compose.yml`에 아카데미와 같은 `db`(MySQL) 서비스를 넣고 `.env.example`·`setup-db.sh`를 로컬 DB용으로 바꾼다. 백업 cron(`backup-db.sh`)도 EC2에 둔다
- **메모리**: t3.micro(1GB)는 api(700MB)+MySQL이면 빠듯하다. MySQL을 작게(`innodb_buffer_pool_size=128M`, `performance_schema=OFF`) 잡고 swap 2GB로 시작한다. `free -m`·OOM이 문제가 되면 t3.small(2GB, 비용 약 2배)로 올린다(인스턴스 중지 → 유형 변경 → 시작, IP가 바뀌니 탄력적 IP를 같이)
- **탄력적 IP**: 공인 IP 요금은 자동 할당 IP와 같으니 복귀 때 붙인다(EC2 → 탄력적 IP → 할당 → 인스턴스에 연결 → DuckDNS를 새 IP로)
- 덤프는 매일 백업을 S3로도 올릴지 정한다(VM 디스크 하나에만 두지 않게)

### 8-2. 복귀(사람, 11-14~11-16, 점검 약 1시간)

명령은 §6과 방향만 반대다. 8-1 PR에 확정본을 적는다.

```bash
# 1) 아카데미 쓰기 멈춤 + 덤프
ssh academy 'cd /opt/flexable && docker compose stop api && umask 077 && \
  docker compose exec -T db sh -c "exec mysqldump --single-transaction --no-tablespaces -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable" | gzip > dump-return.sql.gz'
ssh academy 'cd /opt/flexable && docker compose exec -T db sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" flexable" < count-rows.sql'
# 2) 옮기기
scp academy:/opt/flexable/dump-return.sql.gz . && scp dump-return.sql.gz flex-ec2:/opt/flexable/
# 3) EC2: db만 띄우고 복원 → 행 수 비교 → 중계 해제 → 전체 기동
ssh flex-ec2
cd /opt/flexable
cp Caddyfile.aws Caddyfile && rm -f RELAY_MODE
docker compose up -d db
gunzip -c dump-return.sql.gz | docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable'
docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable' < count-rows.sql
docker compose up -d --build --force-recreate
```

확인은 §6-5와 같다.

### 8-3. 아카데미 VM 정리(사람, 11-17)

```bash
ssh academy
crontab -r                                   # 백업 cron 제거
cd /opt/flexable && docker compose down -v   # DB 볼륨 삭제
docker image prune -af
sudo rm -rf /opt/flexable                    # .env·백업·덤프 삭제
exit
rm -f ~/dump-return.sql.gz; ssh flex-ec2 'rm -f /opt/flexable/dump-return.sql.gz'
```

`~/.ssh/config`의 `academy` 항목과 `~/.ssh/academy*` 키도 지운다. 아카데미에 반납 완료를 알린다.

## 9. 문서·정책 후속

- [x] **개인정보처리방침: 수탁자 표에 아카데미를 넣지 않는다**(10-26 사용자 결정 — 11-18 전에 EC2로 돌아오고 이후 쓰지 않으므로). 11-18 복귀 뒤 백업 문구(RDS 자동 백업 → EC2 매일 백업 7일)만 실제 방식에 맞춰 손본다
- [ ] 운영 문서(8-2 뒤): HANDOFF §5(RDS·DB 조회 방법), `backend/README.md` "운영 배포", `server-health.yml` 이슈 본문의 RDS 안내, `setup-db.sh`
