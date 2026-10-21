# 코인·코스튬 작업 계약 (1.4.0)

앱 안에서 쓰는 코인을 모아 고양이 캐릭터 코스튬을 사고 적용하는 기능. 여러 세션이 나눠 만들 때 이 문서가 기준이다.
API 요청·응답은 [`API.md` "코인·코스튬"](API.md#코인코스튬), DB는 `backend/src/main/resources/db/migration/V8__coins_outfits.sql`.
둘을 바꿔야 하면 이 문서·API.md·V8을 같이 고치고 이유를 보고한다(V8은 아직 운영에 적용 전이라 고칠 수 있다. 운영 배포 뒤에는 V9 이후를 추가한다).

## 1. 확정한 규칙

| 항목 | 규칙 |
|---|---|
| 가입 선물 | 모든 사용자에게 200코인 1회(1.4.0 이후 첫 check-in). 모달: "업데이트 기념 200코인 선물" |
| 시간 적립 | KST 00시 이후 **그날 처음 check-in한 시각부터** 1시간에 1개, 하루 최대 10개. 쌓인 코인은 홈 [모으기]로 받는다. 받지 않은 코인은 자정에 사라진다 |
| 예산 보너스 | 어제 예산을 지켰으면 +5. **어제 하루치만**(며칠 만에 열어도 몰아서 주지 않음). 판정은 캐릭터 점수와 같다: 어제 지출 합(고정지출 자동 기록 제외) ≤ 어제 하루 예산(`daily_budgets`, 기록이 없으면 그 전 마지막 값). 지출 0원도 지킨 날. 하루 예산 기록이 하나도 없으면 주지 않는다. 00시 이후 첫 check-in에서 모달 |
| 추천 코드 | 코드를 등록한 사람과 코드 주인에게 각각 100. 한 사람은 한 번만 등록, 자기 코드 불가. 기간·인원 제한 없음. 소셜 가입은 가입 화면이 없으므로 **마이페이지에서 입력** |
| 상점 상품 | 한 벌 의상(부위 조합 없음), 하나에 200코인, 10개 예정. 사도 바로 적용되지 않고 구매 완료 모달의 [적용하기]로 적용 |
| 레벨 코스튬 | 기존 캐릭터 Lv.1~5를 코스튬 5개로 옮긴다. **코인으로 살 수 없고** 지금까지 도달한 최고 레벨로 열린다(레벨이 내려가도 유지). 기본 캐릭터 = Lv.1 코스튬 |
| 캐릭터 화면 | 캐릭터 뒤 동전 더미(`coinStage`, 4단계 PNG)는 삭제. 홈 캐릭터는 적용 중인 코스튬 애니메이션 하나만 보여 준다. 레벨 게이지·문구는 그대로 |
| 홈 스타일 | 기존 "classic" 홈(캐릭터 없음)은 그대로 둔다. 코스튬은 "character" 홈에서만 보인다 |

이름 주의: 기존 코드의 `coins`/`coinStage`는 **동전 더미 단계**다. 삭제하면서 새 화폐와 헷갈리지 않게 한다.

## 2. 애니메이션 파일 넣기 (파일이 아직 없음)

애니메이션은 아직 준비되지 않았다. **코드는 파일 없이 끝까지 만들고, 파일은 나중에 넣기만 하면 반영되게** 한다.

### 파일 규격

- 2초 반복 **animated WebP**(GIF도 동작하지만 용량 때문에 WebP), 정사각 660×660px(화면 220pt × 3), 투명 배경(무대 배경은 앱이 그린다)
- 한 개 300KB 이하 목표
- 파일 이름 = 코스튬 id: `frontend/assets/outfits/costume-lv1.webp` … `costume-lv5.webp`, `outfit-01.webp` … `outfit-10.webp`

### 파일이 없을 때 (개발 중)

- `frontend/src/service/outfits.ts`의 `outfitSource(id)`가 임시 그림을 준다: 레벨 코스튬은 기존 `assets/characters/lvN-1.png`, 그 밖에는 Lv.1 그림.
- `hasAnimation(id)`가 `false`면 꾸미기 화면 상품 카드에 "준비 중" 표시를 붙인다.
- 화면 코드는 **항상 `outfitSource`만 거쳐** 그림을 얻는다. 화면에서 `require`로 그림 파일을 직접 부르지 않는다.
- 이미지는 `expo-image`의 `Image`로 그린다(PNG와 WebP 애니메이션 모두 같은 컴포넌트).
- 상점 상품 10개는 V8에서 `active=FALSE`라 운영에는 안 보인다. 로컬·CI는 `app.outfits.show-inactive=true`(`application-local.yml`)로 모두 보여서 구매 흐름을 시험할 수 있다.

### 파일이 저장소에 들어왔을 때 (반영 절차)

1. `frontend/assets/outfits/<id>.webp` 추가
2. `outfits.ts`의 `ANIMATIONS`에 `"<id>": require("../../assets/outfits/<id>.webp"),` 한 줄 추가 → 화면 수정은 필요 없다
3. 상점 상품이면 백엔드에 `V{n}__outfits_<내용>.sql` 추가: `UPDATE outfits SET name = '<상품 이름>', active = TRUE WHERE id = 'outfit-0N';`
4. 배포 순서: **앱(원격 업데이트 또는 1.4.0 빌드) 먼저, 서버(마이그레이션) 나중**. 서버를 먼저 켜면 옛 앱에서 임시 그림으로 팔린다

### 출시 조건

| 바뀐 것 | 언제 머지·배포해도 되나 |
|---|---|
| 백엔드(코인 API, V8) | 언제든. API만 추가하고 상점 상품은 꺼져 있어 1.3.0 앱에 영향 없음 |
| 프론트 PR | **레벨 코스튬 WebP 5개가 저장소에 들어온 뒤** main에 머지한다(main 머지 = 웹 즉시 배포, 홈 기본 캐릭터가 바뀜). 그 전에는 기능 브랜치에 둔다 |
| 1.4.0 네이티브 빌드 | 프론트 PR 머지 + 백엔드 배포 뒤. `expo-image`가 네이티브 모듈이라 원격 업데이트로는 안 된다 |
| 상점 상품 | 파일이 들어오는 대로 위 반영 절차. 0개여도 출시 가능(꾸미기 화면은 레벨 코스튬 + "곧 새 코스튬이 나와요") |

## 3. 화면

- **홈**(character 스타일): 적용 중인 코스튬 애니메이션, 코인 잔액, [모으기](받을 것이 없으면 다음 적립 시각), [꾸미기] → `/customize`. 앱을 열 때·앞으로 돌아올 때 `POST /coins/check-in`, 받은 `rewards`를 순서대로 모달로 띄우고 닫을 때 `POST /coins/rewards/ack`
- **꾸미기** `src/app/(service)/customize.tsx` → `src/service/CustomizeScreen.tsx`: 위에 미리보기(처음엔 적용 중인 코스튬), 아래 목록(레벨 코스튬 → 상점 상품). 고르면 미리보기만 바뀐다.
  - 상점 상품, 안 삼: [200코인으로 구매] (잔액이 모자라면 비활성 + 모자란 개수)
  - 산 상품·열린 레벨 코스튬: [적용하기] / 적용 중이면 "적용 중"
  - 잠긴 레벨 코스튬: 자물쇠 + "Lv.N 달성 시 열림"
  - 구매 성공 → 구매 완료 모달, 하단 [적용하기] → `PUT /outfits/equipped` → 홈으로 이동(홈은 돌아올 때 다시 불러 새 코스튬을 보여 준다)
- **마이페이지**: 코인 잔액, [꾸미기] 진입, 내 추천 코드 + 공유(`Share`), 추천 코드 입력(등록했으면 숨김)
- 문구: 코인은 "앱에서만 쓰는 코인"으로 설명한다. 현금·환불·적립금처럼 읽히는 말은 쓰지 않는다

## 4. 작업 나누기

기반 브랜치 `SXXNHU/서비스-내부-화폐-등록`(이 문서·V8·API.md·`types.ts`·`coinApi.ts`(API 호출 함수 전부)·`outfits.ts`·`expo-image` 설치·`app.json` 1.4.0까지 커밋됨)에서 각자 워크트리를 따로 만든다.
**자기 범위 밖 파일은 고치지 않는다.** 필요하면 보고만 한다. 저장소 전체를 둘러보지 말고 아래 파일부터 연다.

| 세션 | 브랜치 | 범위(고칠 수 있는 파일) | 먼저 볼 파일 |
|---|---|---|---|
| A 백엔드 | `SXXNHU/feat-coin-backend` | `backend/` 전부: 새 패키지 `coin`(지갑·내역·check-in·수집·보너스), `outfit`(목록·구매·적용), `referral`. `CharacterScore`에 최고 점수(peak) 추가, `ErrorCode`, `AccountDeletionService`, `application-local.yml`(`app.outfits.show-inactive`) | `budget/CharacterScore.java`, `budget/BudgetService.java`(`characterScore`), `weblink/`(패키지 구성 예), `common/ErrorCode.java`, `user/AccountDeletionService.java` |
| B 홈·캐릭터 | `SXXNHU/feat-coin-home` | `src/components/CharacterStage.tsx`, `src/service/HomeScreen.tsx`, 새 파일 `src/service/RewardModal.tsx` | `CharacterStage.tsx`, `HomeScreen.tsx`, `coinApi.ts`, `outfits.ts` |
| C 꾸미기·마이 | `SXXNHU/feat-coin-custom` | 새 파일 `src/app/(service)/customize.tsx`, `src/service/CustomizeScreen.tsx`, `src/service/PurchaseModal.tsx`. 수정 `src/service/MyScreen.tsx`(코인 잔액은 `getWallet`) | `MyScreen.tsx`, `WebLinksScreen.tsx`(하위 화면 예), `coinApi.ts`, `outfits.ts` |
| D 통합 | 기반 브랜치 | 세 브랜치 합치기, 로컬 서버로 화면 확인·수정, E2E(`frontend/e2e/`), `docs/FEATURES.md`, 약관을 고치면 `docs/play-store/*.md`와 웹 약관 화면 | 이 문서 |

- 백엔드 테스트 필수: 가입 선물 두 번 안 줌, 시간 적립(시작 전 0·1시간 1개·10개 상한·자정 초기화), 어제 보너스(지킴·넘김·0원·기록 없음·이틀 전은 안 줌), 동시에 두 번 구매해도 한 번만 차감, 레벨 코스튬 구매 거절, 최고 레벨 유지, 추천(양쪽 100·두 번·내 코드·초대한 사람 탈퇴 뒤), 남의 내역 ack 무시. 시각은 `Clock` 주입으로 고정한다
- 구매는 지갑 행을 잠그고(`PESSIMISTIC_WRITE` 또는 `version` 낙관적 잠금) 처리한다. 모든 지급은 `coin_ledger` 유니크 키로 막는다(`SIGNUP_GIFT`·`REFERRAL_INVITEE`=`once`, `BUDGET_BONUS`=날짜, `REFERRAL_INVITER`=초대받은 사람 id, `PASSIVE`=`날짜#받은 뒤 누적 개수`, `PURCHASE`=코스튬 id)
- B와 C는 가짜 응답을 만들지 않는다. API는 `coinApi.ts` 함수만 쓰고(`api()` 직접 호출·새 API 파일 금지), `types.ts` 타입으로 `tsc`를 통과시키면 된다. 실제 서버에 붙여 보는 일은 D가 한다(A가 먼저 끝났으면 로컬 H2 서버에 붙여 봐도 된다)
- 공유 파일(`types.ts`, `coinApi.ts`, `outfits.ts`, API.md)은 A·B·C 모두 고치지 않는다. 틀렸으면 보고만 하고 D가 고친다
- 검증: A `./gradlew test`, B·C `npx tsc --noEmit`·`npx expo lint`. E2E와 웹 빌드는 D만 돌린다
- 커밋 메시지 `feat(backend): …` / `feat(frontend): …`. PR은 D가 올린다
