# 인수인계 — 텅장관리 앱 (main 1.6.0)

마지막 갱신 2026-11-01 저녁. 이 문서는 **지금 상태와 남은 일**만 적는다. 끝난 작업의 상세 기록(게시 그룹 ID, 날짜별 로그, 실기기 확인 내역)은 `git log`·PR·[`CHANGELOG.md`](CHANGELOG.md)에 있다(이 문서의 이전 판은 PR #226 직전 커밋). 기능별 현재 동작은 [`FEATURES.md`](FEATURES.md).

**코드 병합과 운영 반영은 다르다.** 배포(서버 `deploy.sh`, EAS 게시·빌드 제출, Play 업로드)는 사람이 직접 한다.
**저장소는 공개(PUBLIC)다.** 비밀값(키 파일, 비밀번호), 개인 계정 경위, 사용자 이메일은 여기에 적지 않는다.

## 1. 지금 상태

| 영역 | 상태 |
|---|---|
| 코드 | `main` `115b372`까지 #223 출석 누적 보상·모달, #224 3·7일 보너스 합산(55), #225 시드머니 [+]·기록 시트 수정 병합. 앱 버전 **1.6.0**, CI 통과 |
| 1.6.0 앱 빌드 | EAS 빌드 `6b2918b2-4b73-4b17-aeee-5948edbca22b`(production, versionCode 16, 소스 `115b372`). 11-01 사용자가 AAB와 출시 노트를 Play Console에 올렸다고 알려 줌. **검토 결과·테스터 Play 스토어 노출은 미확인.** AAB는 작업 PC `~/Downloads/flexable-1.6.0-vc16.aab`(저장소에 넣지 않음). 출시 노트 문구는 [`play-store/README.md` §6](play-store/README.md) |
| 현재 운영 앱 | 설치된 스토어 앱 1.5.0 + 원격 업데이트(runtime 1.5.0). 최신 그룹 `31ff4409-c03d-44e3-ba0e-31a7d756ae92`(Android `01a188e9-f7fc-7e0f-a070-d69c6a4c1190`, 알림 개별 읽음 포함, 소스 `SXXNHU/release-1.5.0-notification-read` `9189fcd`). 되돌림 기준 직전 그룹 `63e63129-e23f-4d32-b562-2b81bc57acb9`. **1.6.0은 runtime이 달라 이 원격 업데이트와 별개**이고, 1.5.0 앱은 스토어에서 1.6.0으로 올라가야 새 기능을 받는다. 공개 `app-version.json` `minVersion`은 Android 1.5.0 |
| 서버 | 아카데미 VM에서 동작(EC2는 중계, 아래 "서버 이전"). 마지막 배포 소스 `b51e8ea`(10-29, 고양마녀 V13). **이후 변경은 아직 서버에 없다**(아래 4번). 배포는 아카데미 네트워크 PC에서만 된다 |
| 웹 | Vercel이 `main` 자동 배포. 시연·웹사이트는 별도 저장소 `flexable-web` |
| 감시·CI | 서버 감시 15분 간격(`server-health.yml`), PR마다 백엔드·프론트·E2E |
| Play | 비공개 테스트 중(테스터 12명 이상 14일 유지 → 프로덕션 액세스 신청 전) |

## 2. 11/2 출근하면 할 일 (순서대로, 모두 사람)

| 순서 | 할 일 | 완료 기준·주의 |
|---|---|---|
| 1 | **Gemini(AI 메이트) 켜기 전 조건 확인** | Google 전송 안내가 개인정보처리방침 정본(`play-store/privacy-policy.md`)·웹 공개 화면·Play 데이터 보안 항목에 있는지. 부족하면 별도 `spec-change` PR로 개정. 서버 `.env`에 기존 `GEMINI_API_KEY`가 있는지 **값을 출력하지 않고** 확인하고, `GEMINI_MODEL`을 따로 적어 뒀다면 지우거나 `gemini-3.5-flash-lite`로(#221) |
| 2 | **아카데미 PC에서 서버 배포** `bash backend/deploy/academy/deploy.sh <user@VM 내부 IP>` | 주소·계정은 팀 비공개 공간. 이 PC(집)에서는 안 된다(`academy` SSH 설정 없음, `backend/deploy/deploy.sh`는 `RELAY_MODE`로 거부). Flyway가 **V14**(카테고리 정렬)·**V15**(예정 지출)·**V16**(`outfit-06` 출석 보상 코스튬)·**V17**(`seed_money_additions`)를 자동 적용한다. 기존 V13 이하 파일·체크섬은 건드리지 않는다 |
| 3 | 서버 배포 확인 | `https://flex-able-sh.duckdns.org/actuator/health` 전체 `UP`. API만으로: `GET /coins/attendance`에 `total`·`todayOutfitId`, `GET /budget/seed-money`에 `movable`, 카테고리 정렬·예정 지출·`POST /chat/messages` 응답. 1.5.0 앱 기존 화면이 그대로인지 한 번 확인 |
| 4 | **Play 1.6.0 검토 통과 확인 → 서버 배포(2~3번)가 끝난 뒤 테스터에게 배포** | 서버보다 앱이 먼저 사용자에게 나가면 출석·시드머니·카테고리·예정 지출·AI 화면이 새 필드·API를 못 받는다. 검토는 서버 배포 전에 받아 둬도 된다 |
| 5 | **1.6.0 실기기 확인** | ① 출석 모달: "1번째 출석 시작", 3일차 +55, 7일차 코스튬, 원이 겹치지 않는지, 어제 예산을 지킨 +5가 출석 모달 설명 줄에 합쳐 뜨는지 ② 시드머니 카드 [+]로 보내기(남은 생활비 초과 거절)·카드를 누르면 기록 시트·맨 아래 [시드머니 수정] ③ AI 메이트 실제 답변·배분 제안 ④ 예정 지출 등록·수정·삭제, 카테고리 삭제·정렬 ⑤ 갤럭시 시스템 바·키보드·모달·복귀·글꼴 ⑥ 알림 개별 읽음, 원본·자른 OCR 이미지(후보·검토·저장), 사용자 지정 글꼴·큰 글씨, 고양마녀 구매·적용(1.5.0 원격 업데이트 때 못 한 확인을 1.6.0으로) |
| 6 | **`minVersion` 판단** | 테스터 Play 스토어에 1.6.0이 보이고 설치까지 확인한 **뒤에만** `frontend/public/app-version.json`을 올린다. 먼저 올리면 업데이트하지 못한 사용자가 닫을 수 없는 창에 갇힌다 |
| 7 | **코스튬 2개 추가**(사용자가 파일 제공) | 영상은 JS 번들 에셋이라 1.6.0 설치 뒤 **원격 업데이트(runtime 1.6.0)**로 올릴 수 있고 새 빌드는 필요 없다. `scripts/prepare-outfit-video.py`로 변환해 `frontend/assets/outfits/`에 넣고 `src/service/outfits.ts`에 연결. 서버 자리는 먼저 정한다: `outfit-06`(출석 보상, 영상만 같은 id로 연결)·상점 자리 `outfit-07`~`10`. 마이그레이션이 필요하면 V18부터. 절차는 [`coin-plan.md`](coin-plan.md) "영상을 받았을 때" |
| 8 | **flexable-web에 알림** | 웹 연동 시드머니 `entries[].choice`에 `EXTRA`(앱에서 바로 보낸 돈)가 올 수 있다. 웹이 이 값을 처리하는지 확인([`web-link-api.yaml`](contracts/web-link-api.yaml)) |

결정은 끝났다: 3·7일 보너스는 기본 +5에 합산(55), 7일째 코스튬은 처음 7일에 한 번(`outfit-06`, 영상이 없어 기본 캐릭터 그림).

## 3. 그 다음 할 일

### 출시·Play Console
- [ ] 1.6.0이 테스터에게 나간 뒤 **테스터 12명 이상 14일 유지 → 프로덕션 액세스 신청**(`play-store/README.md` §5)
- [ ] 데이터 보안 양식 반영(`play-store/README.md` §3.6), 금융 기능 선언 실제 선택지 기록(§3.7 TODO), 스토어 설명 끝 "문의:" 줄을 `ucmnuniverse@gmail.com`으로, 알림 권한 반영 여부(§3.8)
- [ ] 신한카드 결제 알림 자동 기록 [#206](https://github.com/shinds-team7/flexable-app/pull/206)(#205, 11-02 main 병합): 새 네이티브 빌드(1.6.0 versionCode 17 이상)로 실제 승인·취소, 권한, 앱 종료·복귀, 중복, 계정 전환, 권한 철회를 실기기에서 확인한다. 방침 개정·공개 페이지·Play 데이터 보안 안내를 맞춘 뒤에 배포(고지 기간은 사람이 판단)

### 서버·인프라
- [ ] **EC2 로컬 DB로 복귀 11-14~16 → 아카데미 VM 데이터 삭제 11-17**(계획 [`server-migration.md`](server-migration.md) §8). 복귀 뒤에는 이 PC에서 `backend/deploy/deploy.sh`로 배포할 수 있다. 개인정보처리방침 백업 문구 손보기(§9)
- [ ] 작업 PC 홈의 `ec2.env`·`academy.env`(비밀값)는 비밀번호 관리자로 옮기고 지운다. 되돌림용 `dump-final.sql.gz`(EC2 `~`, 작업 PC `~`)도 지운다
- [ ] 도메인 구매 → 서버 `API_DOMAIN`, `frontend/.env.production`, EAS 환경변수 `EXPO_PUBLIC_API_URL`(preview·production) 변경 → 재빌드 또는 원격 업데이트. EC2 탄력적 IP 할당(지금은 인스턴스를 멈추면 IP가 바뀜)

### 제품·기능
- [ ] 결정 대기: 홈 "Lv.1 새싹" 배지·말풍선을 넣을지(#123에서 뺌, 게이지는 기존 유지)
- [ ] 홈 진행 바에 달리는 캐릭터(1차 피드백, 다음 버전)
- [ ] 팀원 2차 피드백 수집(노션)
- [ ] 웹 시드머니 인수인계 남은 체크 2개([`web-seed-entries-handoff.md`](web-seed-entries-handoff.md)): 가짜 테스트 계정 연동 응답 확인(서비스 키 필요), 예시·계약을 웹 담당에게 전달
- [ ] 2027년 6월쯤 2028 월력요항이 나오면 `PublicHolidays.java`에 2028 공휴일 추가
- [ ] 앱 안 코인 결제는 붙이지 않는다. 붙이기로 하면 약관 제2조 4항, 통신판매업 신고, 사업자 정보 표시, 환불 규정을 함께 손본다

### 법률·문서
- [ ] Expo 항목별 보관 기간 문의(expo.dev/contact), 개인정보처리시스템 접근 기록 1년 보관 방식
- [ ] PRD의 날짜·일부 기능 상태에 과거 표현이 남아 있다(예정 지출·카테고리 관리·AI 메이트는 정책 §6~8과 CHANGELOG #213·#214 기준). 후속 `spec-change`로 정리
- [ ] 열린 HANDOFF PR [#222](https://github.com/shinds-team7/flexable-app/pull/222)(10-30 퇴근 현황)는 이 개편으로 내용이 대체됐다. 충돌을 정리하거나 닫는다(리드 판단)

### 이슈 정리(실기기·운영 확인 뒤에 닫는다)
- [ ] #212 UI/UX 전체·Gemini 연결 → 위 2번 1~5번 확인 후
- [ ] #203·#211 OCR(토스·카카오페이, 잘라낸 이미지) → 실제 이미지 후보·검토·저장 확인 후
- [ ] #209 글꼴 → 사용자 지정 글꼴·큰 글씨 확인 후
- [ ] #207 고양마녀 → 10-30 운영 배포·실기기 확인 완료로 닫을 수 있다
- [ ] #191 요일별 배분·#181 스크린샷으로 거래 가져오기 → 1.6.0 실기기 확인 후
- [ ] #205 신한카드 → #206 검증 후

## 4. 코드에는 있지만 운영에 아직 없는 것

기능·수정 PR은 같은 PR에서 이 목록 끝에 한 줄을 더한다(무엇이 바뀌었는지, PR 번호, 반영 방법, 배포 순서 제약). 서버 배포가 끝나면 해당 줄을 지운다.

**서버(아카데미 배포 대기, 위 2번에서 한 번에 나감)**
- [ ] 카테고리 정렬·기본 항목 삭제 V14, 예정 지출 CRUD V15(#213·#214·#219)
- [ ] AI 메이트(Gemini): `POST /chat/messages`(#214, #221). 기본 모델 `gemini-3.5-flash-lite`, 운영 `.env`의 `GEMINI_MODEL` 정리, 운영 키 사용은 개인정보처리방침 개정 조건을 따른다
- [ ] 출석 누적 보상 V16(#223·#224): 누적 3일째 55·7일째 코스튬 `outfit-06` 1회·8일째부터 7일 주기 3·7번째 55. `Attendance`에서 `streak`·`days` 제거, `total`·`todayOutfitId` 추가
- [ ] 시드머니 바로 보내기·모아둔 돈 고치기 V17(#225): `POST /budget/seed-money/transfers`, `PUT /budget/seed-money/base`, `SeedMoney.movable`, 웹 연동 `entries[].choice`에 `EXTRA`
- [ ] 출석 7일째 코스튬을 `outfit-06`→`outfit-07`로 변경(#240): 서버는 상수만 바뀌어 마이그레이션 없음. 앱 출석 모달이 `outfit-07` 그림을 쓰므로 **앱 원격 업데이트(runtime 1.6.0) 뒤 서버를 배포**한다

**앱(1.6.0 스토어 빌드 vc16)**
- [ ] 위 서버 변경을 쓰는 화면 전부와 NavigationBar 숨김, 최신 홈·분석·알림·OCR·글꼴·고양마녀. **서버를 먼저 배포하고 그다음 테스터에게 배포한다**
- [ ] 신한카드 결제 알림 자동 기록(#206, Android 네이티브 모듈 `payment-notifications`): **vc16에는 들어 있지 않다.** 반영은 새 EAS 빌드(1.6.0, versionCode 17 이상)와 Play 업로드뿐이고 원격 업데이트로는 못 보낸다(모듈이 없는 빌드에서는 '지원하지 않아요'로 보인다). 서버 변경 없음. 빌드 전에 방침 정본·웹 공개 페이지·Play 데이터 보안 항목이 맞는지 확인
- [ ] 코스튬 영상 `outfit-07`(달밤 낚시 고양이, #228): 영상·첫 장면만 추가라 1.6.0 설치 뒤 원격 업데이트(runtime 1.6.0)로 반영한다. 서버의 `outfit-07`은 아직 `active = FALSE`("상품 07")라 상품 이름이 정해지면 V18로 켠다. **앱 원격 업데이트를 먼저, 서버 V18은 나중에**(서버가 먼저면 옛 앱에서 기본 캐릭터 그림으로 팔린다). 2026-11-03 원격 업데이트 게시 완료(production, runtime 1.6.0, group `9d2bc26b-6e54-493a-81b9-37d6063e2de8`), 실기기 적용 확인은 아직
- [ ] `minVersion` 1.5.0 → 1.6.0(`frontend/public/app-version.json`): Play에 1.6.0 등록 뒤 올린다. 반영은 웹 배포(머지 시 자동). 1.5.0 이하 앱은 업데이트 안내 창이 닫히지 않으므로 테스터 Play 스토어에 1.6.0이 보이는지 먼저 확인한다
- [ ] 캐릭터 점수 규칙 변경(#232): 출석 +10·예산 지킴 +20·넘김 −50, 새싹·묘목·나무 아이콘과 레벨 안내. **서버 배포(점수 소급 재계산, 마이그레이션 없음) + 앱 원격 업데이트(runtime 1.6.0)**. 순서 제약은 없다(옛 앱은 서버 점수를 그대로 받아 "Lv.N" 문구와 +15 안내만 낡아 보인다). 배포 뒤 기존 사용자 점수가 크게 오를 수 있으니 레벨 코스튬 해금(peakLevel)이 바뀌는지 한 번 확인
- [ ] 상점에 `outfit-07` 달밤 낚시 고양이 200코인 켜기(V18, 이 PR): 앱 영상은 원격 업데이트로 이미 게시했다(2026-11-03, group `9d2bc26b…`·`1b7b9e0c…`). **서버 배포만 하면 상점에 나온다**(Flyway "now at version v18" 확인). 앱 1.6.0 이전 기기는 영상 없이 기본 그림으로 보인다
- [ ] 승급 게이지 양쪽을 아이콘만으로(글자·▼▲ 제거), 왼쪽은 현재 단계·오른쪽은 다음 단계(최고 단계는 오른쪽 비움): 앱 화면만이라 원격 업데이트(runtime 1.6.0)로 반영. 서버 변경 없음
- [ ] 업데이트 기념 200코인(V19, 이 PR): 서버 배포 때 **지갑이 있는 모든 사용자에게 한 번** 200코인을 넣고(`SIGNUP_GIFT`, ref_key `update-1.6.0`) 다음 앱 실행의 홈 보상 모달로 안내한다. 코인 내역에는 "가입 선물"로 보인다. 지갑이 없는 사용자는 첫 실행의 가입 선물 200을 받는다. 되돌리기 어려우니 배포 전에 대상 수(`select count(*) from coin_wallets`)를 확인하고 한 번만 배포한다. 앱 변경 없음
- [ ] 광고 보상(이 PR): 상점 [광고 보기]=보상형 광고 하루 3번×10코인, [모으기]는 코인 내역으로 이동, 홈 캐릭터 탭=상점. 서버: 마이그레이션 없음, `GET /api/v1/ads/reward-callback`(로그인 없이 구글이 부름) 추가 — **서버를 먼저 배포한 뒤** AdMob 콘솔 콜백 URL 확인. 선택 env `ADMOB_REWARDED_UNIT_ID=ca-app-pub-3401841469269585/7434171761`. 앱: `react-native-google-mobile-ads`(네이티브)라 **새 EAS 빌드 필요**, 원격 업데이트 불가. 실제 AdMob 앱 ID(`app.json`)와 광고 단위 ID(`adReward.native.ts`, 배포 빌드만. 개발 빌드는 테스트 광고)를 넣었다. 새 광고 단위는 게재까지 최대 1시간 걸린다. 개인정보처리방침(웹 포함)은 #243·#244로 반영, 시행일 2026-11-04(정식 출시 전이라 즉시). **2026-11-04 진행**: PR #241·#242·#243·#244·#245 병합, 서버 재배포 완료(운영 health 200, 잘못된 서명 콜백 403 확인), 앱 1.7.0(versionCode 20, EAS production AAB)을 Play Console에 업로드, Play 양식(광고 있음·데이터 보안·광고 ID 선언 목적 '광고 또는 마케팅'+'사기 예방·보안·규정 준수') 제출. 앱 버전을 1.7.0으로 올려 원격 업데이트 런타임이 1.6.0 앱과 갈라졌다(1.6.0 앱에는 광고 코드를 원격으로 보내지 않는다). **미확인**: 실기기 광고 재생·구글 실제 콜백으로 코인 +10·하루 3번 제한, Play 검토 결과. `minVersion`은 올리지 않았다(1.6.0 유지, 옛 앱은 광고 버튼만 없다)
- [ ] 상점에 `outfit-08` 산타냥이 200코인 켜기(V20, #249): 영상·첫 장면(`cat-santa.mp4`/`.png`)은 앱 에셋이라 **앱 원격 업데이트(runtime 1.6.0)를 먼저 게시하고 수신을 확인한 뒤 서버 V20을 배포**한다(서버가 먼저면 옛 앱·미수신 기기에서 기본 캐릭터 그림으로 보인다). 새 빌드는 필요 없다. Flyway "now at version v20" 확인. 2026-11-05 원격 업데이트 게시 완료(production, runtime 1.7.0, group `d7f8c615-9f65-4176-8af9-0f24561a8a99`, 소스 `7fa4f12`, 광고 버튼 +10 코인·보유 중 표시·산타냥이 포함), 실기기 반영 확인함. runtime 1.6.0 앱에는 이 업데이트가 가지 않는다
- [ ] 캐릭터 6단계(광부·마구간지기·상인·기사·귀족·왕족, 점수 상한 500)와 직장냥이·잭팟 200코인 상품 전환(V21 Java·V22 SQL, 이 PR): 반영은 **앱 원격 업데이트(runtime 1.7.0) + 서버 배포**이고 새 빌드는 필요 없다. 순서 제약은 약하다(옛 서버에서는 레벨 칸이 3개로 보일 뿐). **V21이 기존 레벨 해금자에게 직장냥이(최고 점수 100점 이상)·잭팟(200점 이상)을 보유로 넣으므로** 서버 배포 전 대상 수(`select count(distinct user_id) from daily_budgets`)를 확인하고 한 번만 배포한다(V21은 V22보다 먼저 돌아야 한다). 새 5단계 코스튬은 디자인 중이라 꺼 둔 잠금 상태(`cat-unlock.png` 임시 그림). 디자인이 오면 영상을 넣고 `active`를 켠다. [결정 기록](decisions/2026-11-05-six-level-costumes.md)
- [ ] AI 메이트 채팅 입력창이 Android 키보드에 반쯤 가려지던 문제 수정(이 PR): edge-to-edge에서 `KeyboardAvoidingView` 계산이 어긋나 키보드 높이를 직접 읽어 올린다. 앱 화면만이라 **원격 업데이트(runtime 1.7.0)**로 반영, 서버 변경 없음. 실기기 확인 필요
- [ ] 예정 지출 카테고리를 거래 등록과 같은 아이콘 칸으로 통일하고 카테고리 추가 버튼 제거(#256 일부, 이 PR): 앱 화면만이라 **앱 원격 업데이트(runtime 1.7.0)**, 서버 변경 없음

## 5. 참고(자주 바뀌지 않는 정보)

### 5-1. 따로 챙길 것(저장소에 없음)

| 항목 | 어디에 있나 | 새 PC에서 |
|---|---|---|
| EC2 SSH 키 `sh-flex.pem` | 담당자 PC | 메신저·메일·git으로 보내지 말고 USB나 비밀번호 관리자로 옮긴다. `~/.ssh/sh-flex.pem`, 권한 600 |
| 아카데미 VM 주소·계정, SSH 설정(`academy`) | 팀 비공개 공간 | `~/.ssh/config`에 `academy` 별칭을 등록. 아카데미 네트워크 안에서만 접속된다 |
| 서버 비밀값(DB 비밀번호, JWT 비밀키, 각종 API 키) | VM `/opt/flexable/.env`에만 있음 | 옮길 필요 없음. **JWT_SECRET을 바꾸면 모든 사용자가 로그아웃된다** |
| 심사용 계정 비밀번호 | 팀 비밀번호 보관함 | Play Console 앱 액세스에 입력 |
| Expo 계정 | 조직 `ucmnuniverse-developer`(Owner 계정 `ucmnuniverse`), 프로젝트 `fb9b50f5-3e92-4eb3-8cea-1c1a149b23ef` | `npx eas-cli@latest login` |
| Play Console 개발자 계정 | — | 개인/조직 여부에 따라 14일 테스트 조건이 다름(`play-store/README.md` §1) |
| DuckDNS 계정 | 담당자 계정(`flex-able-sh`) | IP가 바뀌면 여기서 갱신 |

### 5-2. 새 PC 준비

```bash
git clone https://github.com/shinds-team7/flexable-app.git && cd flexable-app
# JDK 21, Node 22+, Git Bash, GitHub CLI(gh) 설치
cd backend && ./gradlew test
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2로 실행
cd ../frontend && npm ci
echo "EXPO_PUBLIC_API_URL=http://localhost:8080" > .env.local   # 로컬 백엔드에 붙일 때
npm run web
npx tsc --noEmit && npx expo lint && npm run test:unit
npx playwright test     # 로컬 백엔드(8080)와 웹(8081)을 먼저 띄운 뒤 실행
```

- **로컬 E2E용 웹 빌드는 로컬 API로, 캐시를 지우고 만든다**: `EXPO_PUBLIC_API_URL=http://localhost:8080 EXPO_NO_DOTENV=1 npx expo export -p web -c`. 운영 주소가 박힌 번들로 E2E를 돌리면 운영에 테스트 계정이 생긴다(10-21·10-29에 발생). E2E는 시작 전에 앱 요청 주소가 로컬이 아니면 중단한다.
- 로컬 `backend/build/localdb`의 H2 파일은 마이그레이션 번호가 바뀌면 체크섬이 어긋난다. 이때는 `--spring.datasource.url=jdbc:h2:mem:e2e;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1`로 메모리 DB를 쓴다.
- 운영 웹 빌드는 `frontend/.env.production`, 앱 빌드·원격 업데이트는 EAS 환경변수(`preview`·`production`의 `EXPO_PUBLIC_API_URL`)를 쓴다. 확인은 `npx eas-cli@latest env:list --environment production`.
- API CORS는 서버 `.env`의 `CORS_ORIGINS`로 정한다. 웹 주소를 더할 때는 `OAUTH_ALLOWED_REDIRECT_URIS`에도 `…/oauth/callback`을 더하고 `/opt/flexable`에서 `docker compose up -d`로 컨테이너를 다시 만든다(`restart`는 `.env`를 다시 읽지 않는다).
- Windows Git Bash에서 `curl -d '한글'`은 깨진다. 한글 요청은 UTF-8 파일(`--data-binary @file.json`)로 보낸다.
- Windows에서 `npx expo install`로 패키지를 추가하면 `package-lock.json`에서 `node_modules/@emnapi/core`·`runtime` 항목이 빠질 수 있다. 그대로 커밋하면 EAS(리눅스)의 `npm ci`가 실패한다. EAS는 npm 10.9.8(Node 22)로 `npm ci`를 하므로, 패키지를 바꾼 뒤에는 `package.json`·`package-lock.json`만 빈 폴더에 복사해 `npx -y npm@10.9.8 ci --dry-run --ignore-scripts`로 먼저 확인한다.

### 5-3. 빌드와 원격 업데이트 (EAS)

```bash
cd frontend
npx eas-cli@latest build -p android --profile preview      # 실기기 확인용 APK
npx eas-cli@latest build -p android --profile production   # Play 업로드용 AAB (versionCode 원격 자동 증가)
```

- 빌드 전에 `backend`에서 `./gradlew --stop`을 하고 로컬 H2 백엔드(`bootRun`)도 끈다. 로컬 DB 파일 잠금 때문에 EAS 업로드가 `EBUSY`로 실패한다.
- 빌드 목록·다운로드: https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/builds
- 새 production 빌드는 AAB를 Play에 올리고 사용자가 업데이트해야 반영된다. 아이콘·권한·네이티브 모듈 변경은 원격 업데이트로 못 보낸다.
- `runtimeVersion`은 `appVersion` 정책이다. **앱 버전이 다르면 서로 원격 업데이트를 받지 못한다**(1.5.0 앱은 1.6.0 번들을 못 받는다). 네이티브가 바뀌면 `app.json`의 `version`을 올리고 새로 빌드한다.
- **원격 업데이트**(JS·이미지·영상만): `npm run update:preview -- --message "…" --non-interactive`로 preview 게시 → 실기기 확인 → `npm run update:promote -- <preview 그룹 ID> --message "…"`로 production 승격(preview·production 환경변수가 같을 때만). 직접 게시는 `npx eas-cli@latest update --channel production --environment production --platform android --message "…" --non-interactive`. 되돌리기는 이전 그룹을 `update:republish --group <이전 그룹 ID>`로 다시 게시한다(그룹은 `update:list --branch production`).
- **운영 앱이 1.5.0일 때 원격 업데이트는 1.5.0 호환 릴리스 브랜치에서만** 낸다(`SXXNHU/release-1.5.0-*`, 마지막 `release-1.5.0-notification-read`). 1.6.0이 스토어에 나간 뒤에는 `main`(runtime 1.6.0)에서 낸다.
- 앱은 실행할 때 새 업데이트를 받는다. 스플래시 3초 안에 받으면 바로, 늦으면 다음 실행에 적용한다. preview APK는 `preview` 채널, Play AAB는 `production` 채널을 본다.
- **필수 업데이트**: 앱은 시작할 때와 다시 열 때(10분 간격) `frontend/public/app-version.json`의 `android.minVersion`을 읽고, 설치된 버전이 더 낮으면 닫을 수 없는 업데이트 창(Play 스토어로 이동)을 띄운다. 새 버전이 테스터 Play 스토어에 보이고 설치까지 확인한 **뒤에** minVersion을 올리는 PR을 머지한다(Vercel 자동 배포). 되돌리려면 minVersion을 내린다.
- Claude Code auto mode는 production 게시를 운영 배포로 보고 막는다. 사람이 `! <명령>`으로 직접 실행한다.
- Play 'Android 15 지원 중단 API' 경고는 React Native·Material 라이브러리 안의 코드라 설정으로 없앨 수 없다. SDK 업그레이드 때 다시 본다.

### 5-4. 서버 운영

- 운영 API: `https://flex-able-sh.duckdns.org/api/v1`. 코드 `backend/`, 계약 `docs/API.md`·`docs/contracts/`. 구성은 `backend/deploy/`(Docker Compose: api + Caddy 자동 HTTPS), 절차는 `backend/README.md`.
- **지금 배포는 `backend/deploy/academy/deploy.sh`다**(jar 빌드 → VM 업로드 → api 재기동). EC2의 `backend/deploy/deploy.sh`는 `RELAY_MODE` 때문에 멈춘다. EC2 복귀 뒤에는 다시 `backend/deploy/deploy.sh`를 쓴다.
- 배포 뒤 `/actuator/health`(앱·DB·디스크 `UP`)와 Flyway 로그의 "now at version vN"을 확인한다. 스키마 변경은 `backend/src/main/resources/db/migration/V{n}__*.sql`을 **추가**한다(배포된 파일 수정 금지, 운영 DB의 체크섬을 임의로 고치지 않는다). 지금 최신은 V17.
- **외부 감시**(`.github/workflows/server-health.yml`): 15분마다 API 상태·웹 `/privacy`·HTTPS 인증서(만료 10일 미만이면 실패)를 확인하고, 실패하면 `server-health` 라벨 이슈를 연다(정상이 되면 자동으로 닫음). 팀 알림은 이 이슈로 받는다. 공개 저장소는 60일 동안 활동이 없으면 예약 실행이 꺼지므로 Actions 탭에서 다시 켠다.
- 디스크가 부족하면(남은 300MB 미만이면 `DOWN: diskSpace`) `docker system df`로 확인하고 `sudo apt-get clean`부터 한다. `deploy.sh`는 배포마다 빌드 캐시·이전 이미지를 지운다.
- EC2: `ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99`, 보안 그룹 `flex-api-web`의 22번은 관리자 IP만 허용한다. **새 PC나 사무실에서는 공인 IP가 달라 SSH가 막히므로** 22번 소스를 새 IP로 바꾸고, 끝나면 지운다.
- 사용자 삭제는 `AccountDeletionService.deleteAll` 순서를 따른다. 직접 지우기보다 앱·웹의 계정 삭제를 쓴다.
- 운영 DB의 테스트 계정은 그대로 둔다(정리 안 함).

### 서버 이전

비용 때문에 **RDS는 삭제됐고(10-27)** 운영 API·MySQL은 신한 아카데미 앱 전용 VM(1코어·8GB, Ubuntu 22.04, Docker)에 있다. EC2는 Caddy 중계(`relay/Caddyfile`)로 `flex-able-sh.duckdns.org` 요청을 아카데미로 넘기고, **주소가 그대로라 앱·OAuth·웹 설정은 바꾸지 않았다.** 이전 기간에는 EC2에 `RELAY_MODE` 파일이 있다. VM 자동 백업은 매일 04:00(cron, `backup-db.sh`)이고 10-30에 확인했다. 단계별 명령은 [`server-migration.md`](server-migration.md).

- 11-14~16 EC2 로컬 DB(RDS 없음)로 복귀 → 11-17 VM 데이터 삭제는 위 3번 목록. 복귀 전에는 RDS로 되돌릴 수 없다.
- 개인정보처리방침에 아카데미를 수탁자로 넣지 않는다(10-26 결정, 11-18 전 EC2 복귀).
- VM에서 `sudo`는 `ssh -t academy '...'`. 터미널로 복사한 명령 끝에 `│`가 붙으면 지우고 한 줄씩 붙인다. 배포 스크립트는 jar 권한을 직접 고친다.
