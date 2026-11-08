# 오류 기록 보는 법(운영 DB `error_events`)

앱에서 난 오류와 서버 500은 운영 MySQL의 `error_events` 테이블에 쌓인다. 전용 화면은 없어서 서버에 접속해 SQL로 본다. 왜 테이블로 했는지는 [결정](decisions/2026-11-07-error-events.md)에 있다.

> **조회(`SELECT`)만 한다.** `UPDATE`·`DELETE`·`DROP`은 하지 않는다. 30일 지난 기록은 서버가 매일 04:30(KST)에 지운다.
> 기록에는 회원 번호(`user_id`)가 있다. 결과를 메신저·이슈·PR에 붙일 때는 `user_id` 열을 빼고, 공개 저장소에는 올리지 않는다.

## 1. 접속

서버 비밀값(DB 비밀번호)은 서버 `.env`에만 있고 아래 명령이 컨테이너 안에서 알아서 읽는다. 비밀번호를 따로 받을 필요가 없다.

| 기간 | 서버 | 접속 |
|---|---|---|
| ~11-14 | 아카데미 VM(아카데미 네트워크 PC에서만) | `ssh academy` |
| EC2 복귀 뒤(11-14~16 이후) | EC2 | `ssh -i ~/.ssh/sh-flex.pem ubuntu@<EC2 주소>`(보안 그룹 22번에 내 IP가 있어야 한다, [HANDOFF](HANDOFF.md) 5-4) |

접속한 뒤:

```bash
cd /opt/flexable
docker compose exec db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" flexable'
```

`mysql>` 프롬프트가 나오면 아래 SQL을 붙여 넣는다. 나갈 때는 `exit`. 결과가 옆으로 길면 SQL 끝의 `;`를 `\G`로 바꾸면 한 줄씩 세로로 나온다.

## 2. 자주 쓰는 SQL

**최근 오류 50건**(먼저 이것부터)

```sql
select last_at, source, kind, status, code, method, path, message, occurrences, app_version
from error_events order by last_at desc limit 50;
```

**오늘 많이 난 순서**

```sql
select source, kind, status, code, path, message, occurrences, app_version
from error_events where event_day = current_date order by occurrences desc limit 20;
```

> 서버 시간대가 KST가 아니면 `current_date`가 하루 어긋날 수 있다. 그때는 `where event_day = '2026-11-09'`처럼 날짜를 직접 적는다.

**날짜별 건수(최근 30일)**

```sql
select event_day, source, count(*) kinds, sum(occurrences) total
from error_events group by event_day, source order by event_day desc, source;
```

**한 건 자세히**(스택·화면 포함, `id`는 위 결과에서)

```sql
select * from error_events where id = 123\G
```

**특정 API만**(예: 거래 저장 실패)

```sql
select last_at, status, code, message, occurrences from error_events
where path like '/api/v1/transactions%' order by last_at desc limit 20;
```

**특정 앱 버전·원격 업데이트 이후만**

```sql
select last_at, kind, status, code, path, message, occurrences from error_events
where app_version = '1.9.0' order by last_at desc limit 50;
```

## 3. 열 읽는 법

| 열 | 뜻 |
|---|---|
| `event_day` | 오류가 난 날(KST). 같은 날 같은 오류는 한 줄로 묶인다 |
| `occurrences` | 그날 그 오류가 난 횟수 |
| `first_at` / `last_at` | 그날 처음·마지막으로 난 시각 |
| `source` | `APP`(앱이 보냄) / `SERVER`(서버가 직접 남긴 500) |
| `kind` | `API`(앱이 받은 4xx·5xx 응답), `CRASH`(화면이 깨져 오류 화면이 뜸), `JS`(처리 못 한 앱 코드 오류), `SERVER`(서버 500) |
| `status` / `code` | HTTP 상태와 서버 오류 코드(예: `400` / `VALIDATION_FAILED`). 코드 뜻은 [API.md](API.md) |
| `method` / `path` | 요청 종류와 주소. 숫자 id는 `{id}`로 바뀌어 있다 |
| `screen` | 앱 화면 경로(앱 오류일 때) |
| `message` / `stack` | 오류 문구와 스택 앞부분. 문구의 3자리 이상 숫자는 `#`, 이메일은 `***@***`로 가려져 있다(스택은 이메일만) |
| `app_version` / `update_id` / `platform` | 오류가 난 앱 버전, 적용된 원격 업데이트 id, `android`·`web` |
| `user_id` | 마지막으로 겪은 회원 번호(로그인 전이면 비어 있음). 밖으로 옮기지 않는다 |

기록되지 않는 것: 연결 끊김(인터넷 없음), 401(로그인 만료), 사용자가 고칠 수 있는 예상 오류(코인 부족, 시도 횟수 초과, 광고 보상 없음, 이미 쓰는 이메일 등 — `frontend/src/service/errorReportRules.ts`). 앱은 한 번 실행에 20건, 서버는 보낸 사람마다 10분에 30건, 하루 새 줄 500개까지만 저장한다.

## 4. 오류를 찾았을 때

1. 같은 `path`·`code`가 여러 날 이어지는지(날짜별 건수 SQL) 본다. 하루 한두 번이면 대개 일시적이다.
2. 고쳐야 하면 GitHub Issue를 만든다. 본문에는 `kind`·`status`·`code`·`path`·`message`·`app_version`·날짜·횟수만 적고 `user_id`는 적지 않는다.
3. 서버 500이면 서버 로그도 같이 본다: `docker compose logs --since 1h api | grep -i error`.
