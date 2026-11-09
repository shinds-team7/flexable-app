# 캐릭터 6단계(광부~왕족), 직장냥이·잭팟은 200코인 상품으로

- 날짜: 2026-11-05 · 결정한 사람: SXXNHU(채팅에서 선택) · 관련: PR(이 기록을 더한 PR)
- 영향: 앱 서버(점수 상한·마이그레이션 V21·V22) / 앱 화면(홈 단계 표시·상점 레벨 칸) / 앱 API 계약. 웹은 영향 없음

## 결정

1. 캐릭터 단계를 3개에서 6개로 늘린다. 시대상: Lv.1 광부 · Lv.2 마구간지기 · Lv.3 상인 · Lv.4 기사 · Lv.5 귀족 · Lv.6 왕족(사용자 문서의 "0단계 광부 … 5단계 왕족"과 같은 순서. 서버·API는 1부터 센다).
2. 점수는 100점이 한 단계 그대로이고 **상한만 200에서 500**으로 올린다. 점수는 기록에서 매번 다시 계산하므로 기존 사용자도 이어서 오른다. 계약 `characterPoints` 최대 500, `peakLevel` 최대 6.
3. 화면의 단계 표시를 새싹·묘목·나무에서 단계 이름과 아이콘(⛏️·🐴·💰·🛡️·🎩·👑)으로 바꾼다.
4. 레벨 코스튬 id는 `costume-lv1`(광부)~`costume-lv6`(왕족)이다(`costume-lv6`은 V22에서 새로 넣음). 새 5개는 디자인 중이라 **꺼 둔 채(`active = FALSE`) 잠금**이다. 레벨이 되어도 열리지 않고 목록에서 빠지며, 앱은 `cat-unlock.png` 실루엣과 자물쇠로 채운 칸을 보여 준다. 디자인이 들어오면 영상·첫 장면을 넣은 뒤 V{n}으로 `active = TRUE`로 켠다.
5. 직장냥이(`outfit-02`)·잭팟(`outfit-01`)은 레벨 코스튬에서 **200코인 상품**으로 바꾼다(V22). 이미 레벨로 열어 둔 사용자(최고 점수 100점 이상은 직장냥이, 200점 이상은 잭팟)는 **계속 무료로 보유**한다. V21(Java 마이그레이션)이 그 사용자에게 `user_outfits`를 넣는다. 반드시 V22보다 먼저 돈다.

## 이유

- 4: 사용자가 "아직 디자인 중이라 다운로드 폴더의 cat-unlock 파일을 쓰고 잠금 상태로" 요청했다. 서버가 켜 두면 레벨 도달만으로 빈 코스튬이 열리므로 `active = FALSE`로 둔다.
- 5의 보존: 점수 계산이 SQL로 어려워 Java 마이그레이션에서 `CharacterScore`와 같은 규칙으로 최고 점수를 낸다. 상한이 200에서 500으로 늘어도 100점·200점에 처음 닿는 날은 같아서 예전 규칙과 같은 사람이 고른다.
- 서버가 `active = FALSE` 레벨 코스튬을 `equip`·목록에서 열린 것으로 치지 않도록 막았다(`OutfitService`).

## 남은 일

- 11-08: Lv.2(`costume-lv2`)는 `cat-farmer.mp4`를 연결하고 V24로 켰다(#303). 같은 날 영상에 맞춰 단계 이름을 농부(🌾)로 바꿨다(#304, V24에 이름 변경 포함, 앱 `LevelIcon`).
- 11-08: Lv.3 상인·Lv.4 기사(`costume-lv3`·`lv4`)도 영상(`cat-trader.mp4`·`cat-knight.mp4`)을 연결하고 V25로 켰다. 농부는 영상 속 캐릭터가 커서 `--scale 0.8`로 다시 만들었다.
- 11-09: Lv.5 귀족·Lv.6 왕족(`costume-lv5`·`lv6`)도 영상(`cat-noble.mp4`·`cat-king.mp4`)을 연결하고 V26으로 켰다. 6단계가 모두 열린다(앱 원격 업데이트 먼저, 서버는 나중).
- 배포 순서: 앱 원격 업데이트(runtime 1.7.0)와 서버(V21·V22)는 순서 제약이 약하다. 옛 앱이 직장냥이·잭팟 상품을 코인 상품으로 보는 것은 목록 응답만으로 처리된다. 다만 서버를 먼저 배포하면 옛 앱의 "레벨 N 달성 시 열림" 문구가 없는 칸으로 바뀔 뿐 동작은 같다.
- V21은 운영에 적용하기 전 대상 수(`select count(distinct user_id) from daily_budgets`)를 확인한다.

## 바뀌는 것(문서·코드·설정)

- 문서: `docs/policies.md` §4, `docs/coin-plan.md`, `docs/API.md`, `docs/FEATURES.md`, `docs/contracts/app-api.yaml`, `tests/policy/character.json`
- 서버: `budget/CharacterScore`(MAX 500), `outfit/OutfitService`·`OutfitDtos`, `db/migration/V21__keep_level_costume_owners`(Java)·`V22__six_level_costumes.sql`
- 앱: `components/CharacterStage`·`LevelIcon`, `service/LevelGuide`·`HomeScreen`·`CustomizeScreen`, `assets/outfits/cat-unlock.png`, `src/service/api/schema.d.ts`(생성)
