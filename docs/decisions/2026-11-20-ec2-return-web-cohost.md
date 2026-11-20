# EC2 복귀와 웹 동거(한 대에 앱·웹)

- 날짜: 2026-11-20 · 결정한 사람: owner(인스턴스·도메인·우선순위), Claude(MySQL 개수·Caddy 연결 방식, 아래 "새로 정한 것") · 관련: Issue #379
- 영향: 앱 서버 / 웹

## 결정

1. 아카데미 VM이 곧 꺼지므로 앱 서버를 EC2 로컬 MySQL로 되돌린다. 인스턴스는 t3.micro → **t3.small(2GB)**, **탄력적 IP**를 붙인다(콘솔 작업은 사람).
2. 웹(flexable-web)도 **같은 EC2**에 올린다. 웹 주소는 같은 DuckDNS 계정의 **두 번째 서브도메인**.
3. 메모리가 모자라면 **앱이 우선**이다. 웹은 11-24 면접까지만 살아 있으면 되고, 반쯤 죽어 있어도 된다. 웹 worker는 기본으로 끄고 필요할 때만 켠다.
4. (새로 정한 것) 앱 Caddy가 TLS를 맡고 호스트 이름으로 나눈다. 웹 nginx는 호스트 `127.0.0.1:8081`에만 바인딩한다(웹 쪽 계약). 루프백 포트는 브리지 네트워크의 host-gateway로 닿지 않으므로 **Caddy만 `network_mode: host`**로 띄우고, 앱 api는 호스트 `127.0.0.1:8080`에 연다.
5. (새로 정한 것) MySQL은 **앱·웹 각각 하나씩** 둔다. 하나에 DB 둘을 두면 약 150~200MB를 아끼지만 두 저장소의 배포·재시작·root 비밀번호·백업이 묶이고, 웹 쪽 실수가 앱 DB에 닿을 길이 생긴다.
6. (새로 정한 것) 앱 컨테이너는 `oom_score_adj`를 낮게(-500) 두고, 웹 컨테이너는 모두 `mem_limit`을 건다. 웹 api 힙 1g → 320m 권장. 웹 이미지는 EC2에서 Gradle로 빌드하지 않는다.
7. (새로 정한 것) 앱 DB 백업은 EC2 디스크에만 7일(S3 등 다른 곳으로 복제하지 않음 — 개인정보처리방침 문구 그대로). 아카데미 VM의 `auth.log`는 앱 방침상 보관 대상이 아니라 VM과 함께 지운다. 안전성 확보조치 기준의 접속기록 보관 적용 여부는 owner가 따로 정한다.

## 이유

- 아카데미 VM 종료로 운영 DB를 옮길 곳이 필요하고, 주소(`flex-able-sh.duckdns.org`)를 그대로 쓰면 앱·OAuth·웹 연동 설정을 바꾸지 않아도 된다.
- 웹 VM도 같이 없어지므로 따로 서버를 늘리지 않고 한 대에 올린다(비용). 2GB 예산은 [server-migration §8-1](../server-migration.md) 표: 웹 조건(힙 축소·`mem_limit`·worker 끔)을 지키면 평상시 약 1.6GB.

## 바뀌는 것(문서·코드·설정)

- 코드: `backend/deploy/docker-compose.yml`(db 추가, api 루프백 포트, Caddy 호스트 네트워크), `Caddyfile`(`WEB_DOMAIN` → 127.0.0.1:8081), `.env.example`(`WEB_DOMAIN`·`MYSQL_ROOT_PASSWORD`), `setup-db.sh`(RDS 없이 빈 비밀값만), `deploy.sh`(`--upload-only`, 기본 주소 도메인), `backup-db.sh`·`count-rows.sql` 이동.
- 문서: [server-migration §8](../server-migration.md), [backend/README](../../backend/README.md) "운영 배포".
- 웹(flexable-web): compose의 nginx를 `127.0.0.1:8081`에만, 모든 컨테이너 `mem_limit`, 웹 api 힙 320m, worker 기본 끔, 소셜 로그인 콜백을 새 도메인으로.
