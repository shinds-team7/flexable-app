# 텅장관리 학습 가이드 생성기

팀이 이 저장소를 이해하려고 만든 학습 자료(HTML 한 장)를 만드는 스크립트다. 서비스 앱과 무관하고, 앱·백엔드 의존성을 쓰지 않는다(Node 표준 라이브러리만).

- 공유본: https://claude.ai/artifact/L79GFVo73CHLSPaX4M8kEg (비공개, 공유받은 사람만 열림)
- 내용: 전체 구조, 프론트·백엔드 코드 지도, 거래 등록·수정 16단계 추적, ERD(17개 테이블), 핵심 설계, 기능 수정·문제 조사 지도, 실행·테스트·배포(작업 방식·계약·정책 테스트 포함), 10분 발표 모드

## 추가 보완(2026-10-29, PR #201)

코드 기준을 `main` `b32af03`(#198 포함)에 맞춰 출석 조회·지급 API 두 개와 출석 기능 설명을 추가했다. 누락된 매핑으로 가이드 생성이 실패하던 문제를 고쳤고, 거래 수정 시 날짜가 같으면 기존 시각을 유지한다는 설명, `BudgetCalculator.compute`의 요일 비중·이번 주 계산식, HANDOFF의 운영 V12 배포 보고 출처를 바로잡았다. 로컬에서 백엔드 전체 128개(정책 포함)·프론트 단위 52개·가이드 생성이 통과했다(Java 21·Node 22). 아래 10-28 테스트 수는 당시 기준의 실행 기록이다. 이번 보완본의 공유본 재게시는 확인하지 않았다.

## 갱신 상태(2026-10-28)

main `2f3d0b4`(10-26~28: 코인 내역 #175, 지출 달력 #173, 알림함 #186, 시드머니 슬라이드 #188, 웹 시드머니 총액 #189, 스크린샷 가져오기·날짜만 입력 #183, 요일별 배분 #192, minVersion 1.5.0 #196) 기준으로 다시 빌드했다. 이번에 반영한 것:

- API 4개: `GET·PUT /budget/day-weights`, `GET /coins/ledger`, 웹 연동 `PUT …/seed-money`
- 스키마: V12(`budget_settings.day_preset·day_weights`)로 CSV를 다시 뽑고 ERD·열 설명·Flyway 표를 맞춤(다음 번호 V13)
- 기능·화면·코드: 요일별 배분, 스크린샷 가져오기, 알림함, 코인 내역, 날짜만 입력. 알림함과 스크린샷 가져오기는 외부 결제 알림 수집이나 계좌 연결이 아님을 명시(결제 알림 자동 기록은 여전히 없음)
- 테스트: 백엔드 19개 클래스 125개, 프론트 단위 51개(10-28 로컬 통과)
- 계산식 설명에 요일 비중을 덧붙임(시뮬레이터는 기본 배분만 다룸)

## 이전 갱신 상태(2026-10-25)

main `a0b934c`(10-25 작업 방식·정책·계약 PR #132~#142, 기록 알림 #146, 앱 타입 전환 #148 머지 후) 기준으로 다시 빌드해 공유 아티팩트를 갱신했다(2026-10-25, 공유 범위는 기존 '링크가 있는 사람'). 이번에 반영한 것:

- 테스트: 정책 테스트(`BudgetPolicyTest`·`CharacterPolicyTest`·`SeedMoneyPolicyTest`)와 `ContractTest`를 목록에 추가, 백엔드 17개 클래스 116개(10-25 로컬 `./gradlew test` 통과), 고정 시계 테스트의 가입 시각 수정(#138)
- 계약·정책: 계산 규칙의 정본이 `docs/policies.md`·`tests/policy/`로, API 계약이 `docs/contracts/*.yaml`로 옮겨진 것에 맞춰 '기능 수정 지도'·설계 설명·코드 지도를 고침. `gen:api`·`check:api`·`mock:api`
- 작업 방식: '실행·테스트·배포'에 'PR이 머지되기까지'(Issue → PR 템플릿 → `pr-rules` → `main` 보호 → `spec-change` 뒤 rebase·새 세션)와 기준 문서 표 추가, 용어(API 계약·정책 예시 표·spec-change)
- 어긋남: 화면 코드가 생성 타입 `schema.d.ts` 대신 손으로 맞춘 `types.ts`를 쓰던 문제는 #148에서 전환해 없앴고, '분석 기준'에 처리 결과로 남김
- 기록 알림(#146): 기능·코드(`entryReminder`·`localNotifications`)·단위 테스트(프론트 12개) 추가

`CI 확인` 배지는 로컬 실행이나 운영 배포를 뜻하지 않는다. 백엔드 운영 배포는 사람이 별도로 진행한다. 다음에 코드가 바뀌면 아래 '코드가 바뀌었을 때'대로 main에서 다시 빌드하고, 같은 공유본 URL로 재게시한다(`out/`은 커밋하지 않는다).

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
- **정책 표·계약이 바뀜**(`docs/policies.md`·`tests/policy/`·`docs/contracts/`): 테스트 목록(`content/e-misc.mjs`)의 케이스 수와 '기능 수정 지도'(`content/views-d.mjs`)를 다시 읽는다.
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
