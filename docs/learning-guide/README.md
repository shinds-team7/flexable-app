# 텅장관리 학습 가이드 생성기

팀이 이 저장소를 이해하려고 만든 학습 자료(HTML 한 장)를 만드는 스크립트다. 서비스 앱과 무관하고, 앱·백엔드 의존성을 쓰지 않는다(Node 표준 라이브러리만).

- 공유본: https://claude.ai/artifact/L79GFVo73CHLSPaX4M8kEg (비공개, 공유받은 사람만 열림)
- 내용: 전체 구조, 프론트·백엔드 코드 지도, 거래 등록·수정 16단계 추적, ERD(17개 테이블), 핵심 설계, 기능 수정·문제 조사 지도, 실행·테스트·배포, 10분 발표 모드

## 갱신 상태(2026-10-25)

#129(고정지출 이름 변경 수정, `807fb30`)·#130(문서·주석 정리, `5e31651`)은 CI 통과 후 main에 머지했다. 가이드의 코드 발췌·고정지출 설명·회귀 테스트 목록·테스트 수(13개 클래스 86개)·문서 정리 결과도 갱신했다. `CI 확인` 배지는 로컬 실행이나 운영 배포를 뜻하지 않는다. 백엔드 운영 배포는 사람이 별도로 진행한다.

공유 아티팩트는 아직 갱신하지 않았다. 저장소 변경과 #128 머지는 Codex가 진행하고, 아티팩트 재게시는 Claude가 맡는다.

### Claude에게 남기는 작업

1. 최신 main을 받아 `node docs/learning-guide/build.mjs`로 HTML을 다시 만든다. 빌드는 현재 HEAD의 코드 발췌 줄 번호와 GitHub 고정 링크를 넣으므로, 머지 후 main에서 다시 만들어야 한다.
2. 결과 `docs/learning-guide/out/guide.html`을 브라우저로 열어 고정지출 기록 이어받기 설명·회귀 테스트 발췌·86개 테스트 수·문서 정리 결과와 발표 모드를 확인한다.
3. 위 기존 공유 아티팩트를 이 HTML로 갱신하고 다시 게시한다. 공유 범위는 기존 설정을 유지한다. `out/`은 커밋하지 않는다.
4. 아티팩트 URL이 바뀌면 README의 공유본 링크도 갱신한다. 재게시 후 이 절의 미완료 상태와 게시 날짜를 실제 결과에 맞춘다.

운영 배포·운영 DB 접속·사용자 중복 거래 정리는 이 인계 작업에 포함되지 않는다. 고정지출 수정은 코드에 반영됐지만 운영 배포 완료로 설명하면 안 된다.

## 만들기

```bash
# 저장소 루트에서. Node 22 이상
node docs/learning-guide/build.mjs
# → docs/learning-guide/out/guide.html (브라우저로 바로 연다. out/은 커밋하지 않는다)
```

빌드는 아래를 검사하고, 하나라도 어긋나면 파일을 만들지 않고 무엇이 틀렸는지 출력한다.

| 검사 | 어긋나면 고칠 곳 |
|---|---|
| 코드 발췌의 기준 문자열이 실제 파일에 한 번 있는지(줄 번호는 손으로 적지 않는다) | `content/snippets.mjs` |
| 본문의 모든 내부 링크(`{{a:…}}`, `{{t:…}}`, `{{v:…}}` 등)가 있는 항목을 가리키는지 | 해당 `content/*.mjs` |
| 컨트롤러의 모든 `@…Mapping`이 API 목록에 있는지 | `content/e-api.mjs` |
| ERD 데이터가 H2에 마이그레이션을 실제로 적용한 스키마와 같은지(열 순서·NULL·기본값·PK·UNIQUE·FK·삭제 규칙·인덱스) | `content/e-tables.mjs`, 필요하면 `schema/*.csv` 다시 뽑기 |
| 계산 시뮬레이터가 `BudgetCalculatorTest` 기대값과 같은지(공휴일은 `PublicHolidays.java`에서 읽음) | `content/sim.mjs`(계산식을 바꿨다면) |

검사는 '코드가 있다'만 본다. 설명 문장이 맞는지는 사람이 다시 읽어야 한다.

## 코드가 바뀌었을 때

- **코드가 움직였을 뿐**: 다시 빌드하면 줄 번호와 GitHub 고정 링크(현재 커밋)가 바뀐다.
- **발췌한 코드가 바뀌거나 지워짐**: 빌드가 실패한 발췌의 `from`/`to`를 고치고 그 발췌를 쓰는 설명을 다시 읽는다.
- **새 API**: `content/e-api.mjs`에 항목 추가(빌드가 빠진 매핑을 알려 준다).
- **새 마이그레이션(V12…)**: 아래 '스키마 다시 뽑기' 후 `content/e-tables.mjs`를 맞추고, `content/views-c.mjs`의 Flyway 표에 한 줄 더한다.
- **새 테스트·화면·용어**: `content/e-misc.mjs`.
- **실행 결과 배지(직접 실행)**: 날짜가 붙은 기록이다. 다시 실행했으면 문구와 날짜를 고친다(`content/e-misc.mjs`의 `RAN_BE`, `views.mjs`의 `scope.ran`).

### 스키마 다시 뽑기

운영 DB에는 접속하지 않는다. 로컬 H2에 마이그레이션을 적용한 뒤 뽑는다.

```bash
# 1) 기본 로컬 DB를 건드리지 않게 임시 파일로 서버를 한 번 띄웠다가 끈다(Flyway가 모든 버전을 적용)
cd backend
./gradlew bootRun --args="--spring.profiles.active=local --server.port=18080 --spring.datasource.url=jdbc:h2:file:./build/guide-schema/db;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE"
# 'Started ApiApplication' 이 보이면 Ctrl+C

# 2) 저장소 루트에서 CSV로 뽑기(H2 jar는 Gradle 캐시에 있다)
cd ..
H2=$(find ~/.gradle/caches/modules-2 -name 'h2-2*.jar' | head -1)
java -cp "$H2" org.h2.tools.RunScript -url "jdbc:h2:file:./backend/build/guide-schema/db;MODE=MySQL;DATABASE_TO_LOWER=TRUE" -user sa -script docs/learning-guide/schema/export.sql
```

## 파일

| 경로 | 내용 |
|---|---|
| `build.mjs` | 발췌 추출, 검사, HTML 출력 |
| `content/snippets.mjs` | 코드 발췌 목록(기준 문자열) |
| `content/e-*.mjs`, `entities.mjs` | 기능·화면·API·코드·테이블·테스트·용어 데이터 |
| `content/views*.mjs`, `flow.mjs`, `present.mjs` | 본문, 거래 흐름 단계, 발표 장면 |
| `content/diagrams.mjs` | 구조도·배포도·계층도·흐름 레인·ERD(SVG) |
| `content/sim.mjs` | 학습용 계산 시뮬레이터(`BudgetCalculator`를 옮긴 것, 서비스 코드 아님)와 검사 |
| `template/` | 페이지 CSS·JS |
| `schema/` | H2에서 뽑은 최종 스키마(CSV)와 뽑는 SQL |

비밀번호·키·서버 주소·실제 사용자 데이터는 넣지 않는다(저장소가 공개다). 발췌에서 주소가 보이면 `snippets.mjs`의 `mask`로 가린다.
