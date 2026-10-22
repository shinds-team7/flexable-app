# 인수인계 — 서비스 1.0.0 Google Play 비공개 테스트

마지막 갱신 2026-10-22(남은 일 정리, #105 미게시·V9 배포 기록, 공휴일·Idempotency PR). 다른 PC나 다른 사람이 이어서 작업할 때 이 문서부터 읽는다.
비밀값(키 파일, 비밀번호)은 이 문서와 저장소에 없다. "§2 따로 챙길 것"을 보고 안전한 경로로 옮긴다.
**저장소는 공개(PUBLIC)다.** 개인 계정 경위·제출 서류·결제 정보·사용자 이메일은 여기에 적지 않는다.

## 0. 다음에 이어서 할 일

### 0-코인. 10-21 코인·코스튬·추천 코드(앱 1.4.0)

규칙·파일 규격·작업 범위는 [`coin-plan.md`](coin-plan.md), API는 [`API.md` 코인·코스튬](API.md#코인코스튬), 화면별 근거는 [`FEATURES.md`](FEATURES.md).

- [x] 백엔드 배포 **10-21 완료**(`deploy.sh`, V8 `coin_wallets`·`coin_ledger`·`outfits`·`user_outfits`·`referrals`). `/actuator/health` UP, 운영 `/outfits`에 광부·잭팟 2개만 나오는 것 확인
- [x] 웹 배포 **10-21 완료**(PR #93 머지 `9bea6f3` → Vercel). 배포 번들에 코인 화면·잭팟 영상이 들어간 것 확인(브라우저로 눌러 보지는 않음)
- [x] EAS 빌드 **10-21 완료**(커밋 `ea704dc`, PR #93과 내용 같음): preview APK versionCode 11, production AAB versionCode 12(`flexable-1.4.0-vc12.aab`). versionCode 11은 처음 production 시도가 업로드 단계에서 실패하면서 올라간 번호라 production AAB에는 없다
- [x] Play Console 업로드 **10-21 완료**(사람, vc12). 출시 노트는 [`play-store/README.md` §6](play-store/README.md). 검토 통과 뒤 테스터 Play 스토어에 1.4.0이 보이는 것 확인(아래 minVersion 항목). 남은 것: App Bundle 탐색기에서 난독화 해제 파일 등록 확인
- **1.4.0이 1.3.0 남은 일을 대신한다.** 1.4.0 AAB(`ea704dc`)에 #87 디자인 시스템 v2·#88 시드머니 반영 모달·#91 웹 연동 설정이 모두 들어 있다. 그래서 아래 0-1의 "1.3.0 AAB Play 업로드"와 "preview 그룹 `68048ca1` production 승격"(`update:promote`)은 **하지 않는다**. 1.3.0 production AAB(vc10, 10-20 빌드)는 EAS에만 있다
- [ ] **웹 연동 메뉴가 1.4.0에 이미 열려 있다.** 원래는 개인정보처리방침 결정 뒤에 열기로 했던 메뉴다(아래 0-1 "사람 결정"). 사용자가 코드를 발급해 웹에 입력해야 정보가 넘어가므로, 웹 쪽 연동이 운영에 없는 동안은 실제로 넘어가는 정보가 없다. 둘 중 하나를 정한다: ① 방침에 넣고 고친다(시행 7일 전 고지) ② 정할 때까지 1.4.0용 원격 업데이트로 메뉴를 숨긴다(JS만 바뀜)
  - **→ 10-21 ①로 정했다(웹 요청).** 방침 4장에 웹사이트 연동(받는 곳·제공 항목·목적·보유·해제)을 넣고 시행 10-28, 그 전에는 앱 연동 화면에서 동의한 사람에게 동의한 때부터 적용한다. 연동 화면은 [동의하고 코드 받기]를 눌러야 코드를 발급한다. 근거 [`web-seed-entries-handoff.md`](web-seed-entries-handoff.md)
  - [x] 10-21 법률 검토안 반영: 개인정보처리방침을 14개 조항으로 다시 썼다(목적별 법적 근거, 코인·추천 코드·문의·서버 오류 기록·Vercel 접속 기록 항목, Expo 실제 전송 항목(`EAS-Client-ID`·`Expo-Fatal-Error` 등), Vercel·Gmail 국외 이전, 보관 기간과 백업 7일 구분, 웹 계정 삭제 경로, 로그인 토큰 보관). 운영자·보호책임자 강선후, AWS 수탁자 Amazon Web Services Korea LLC, Vercel Hobby(접속 기록 1시간). 10-27 개정분은 10-28 시행에 합쳤다. 이전 본문은 GitHub `fd1c11a` 링크
  - [x] 10-22 이용약관도 10-28 시행으로 맞췄다(#96): 제2조 4 코인(현금 가치 없음·바꾸거나 넘길 수 없음·탈퇴 시 삭제), 제2조 5 웹사이트 연동(선택, 해제 방법, 넘기는 정보는 방침 4장). 10-27 시행으로 알렸던 '매달 저축할 돈' 변경도 같은 날로 합쳤다. 약관 고지는 10-22 웹 반영부터라 시행까지 6일이다(약관 제6조는 '미리 알림'만 정하고 일수는 정하지 않았다). 웹 `/terms`는 머지로 바로, 앱 안 약관 화면은 10-22 원격 업데이트(`582479c0`)로 바뀌었다
  - [ ] 법률 검토안에서 남은 것(사람): Expo 항목별 보관 기간(공개 안 됨, expo.dev/contact로 문의), 개인정보처리시스템 접근 기록 1년 보관 방식(웹은 1년으로 적음), 이용약관 운영자 표기(아직 ucmnuniverse), Play Console 데이터 보안 양식 반영(`play-store/README.md` §3.6 갱신분). `KAKAO_ADMIN_KEY`는 운영 서버에 설정돼 있다(10-21 사용자 확인), 방침 문구를 '요청합니다'로 확정
  - [x] 1.4.0(runtime 1.4.0) production 원격 업데이트 **10-21 17:51 KST 게시**(사람, 그룹 `5822362e-5688-4c1e-a22b-ced4e06e0bf0`, 커밋 `7097b55`). #97(방침 개정·연동 선택 동의)과 #98(직장냥이) 포함, 실기기 반영 확인(사용자). #100(카카오 연결 끊기 문구 '요청합니다')은 이 커밋 뒤라 앱 `/privacy`에는 다음 원격 업데이트 때 들어간다(웹 `/privacy`는 반영됨). 웹 요청서의 '1.3.0 승격'은 1.4.0이 대신하므로 하지 않았다
  - [x] 10-21 18:10 KST production `22bd14e6-5022-4aec-b02d-16740bd53d41`(커밋 `6633b85`): #102 꾸미기 이동 후 영상 오류 수정, #100 방침 문구 포함
  - [x] **10-22 14:57 KST production `582479c0-e282-4268-b966-390bb28f5e5f` 게시**(사람, 커밋 `bb7e4e4`, `--clear-cache`): #103 코인·상점을 캐릭터 홈 헤더 상점 버튼으로 옮김(홈 코인 줄·마이 코인 줄 삭제, [모으기]는 상점 위쪽), #96 앱 안 이용약관 10-28 개정. 올린 번들의 API 주소가 운영(`flex-able-sh.duckdns.org`)이고 `localhost`가 없는 것 확인. 되돌릴 때는 `22bd14e6`을 production에 다시 게시한다. 실기기 반영 확인 전
  - [x] **10-22 16:18 KST production `a72735b2-1abd-4db4-9541-5790ef813e57` 게시**(사람, 커밋 `ce92b4b`, `--clear-cache`): #105(상점 목록 가격을 코인 그림+숫자로, 가지지 않은 코스튬 자물쇠·레벨 준비 중 빈 칸, '지금 적용' 배너 삭제와 다음 실행 때 조용히 적용). 올린 번들에 운영 API 주소만 있고 `localhost:8080`·'지금 적용' 문구가 없는 것 확인. 이전 앱에는 배너 코드가 있어 이 업데이트를 받을 때 배너가 마지막으로 한 번 뜰 수 있다. 되돌릴 때는 `582479c0`을 production에 다시 게시한다. 실기기 반영 확인 전
  - [x] 백엔드 V9(직장냥이 `outfit-02` 판매 켜기) 운영 배포 완료(사용자 확인, 10-22 기록. 배포 시각은 기록 없음). 운영 상점 코스튬은 광부·잭팟·직장냥이 3개
  - [ ] 웹 담당에게 게시 그룹 ID·시각 전달
  - [ ] 웹 담당에게 알릴 사실: `APP_LINK_BASE_URL`은 `https://flex-able-sh.duckdns.org`(키 없이 `/internal/v1/...` 401 확인). 앱 서버(Caddy·Spring)에는 IP 허용 목록이 없다(AWS 보안 그룹은 콘솔에서 사람이 확인). `WEB_LINK_SERVICE_KEYS`는 10-20 서버 `.env`에 넣었다(값은 팀 비공개 공간)
- [ ] 실기기 확인(preview APK): 홈 광부 영상 재생·반복 이음새(저가폰 포함), 가입 선물 모달 → 홈 헤더 셔츠 버튼(받을 코인이 있으면 빨간 점) → 상점에서 [모으기]·잭팟 구매 → [적용하기] → 홈이 잭팟 영상, 마이 추천 코드 입력 → 100코인, 다른 탭으로 갔다 오면 영상이 멈췄다 다시 도는지
- [x] Play에 1.4.0이 보인 뒤 `app-version.json` `minVersion`을 1.4.0으로 올렸다(10-21, 사용자 확인 후). 1.3.0 이하 Android 앱은 다음 실행 때 닫을 수 없는 업데이트 창이 뜬다. 되돌리려면 1.1.0으로 내린다
- 1.3.0 이하 앱은 코인 API를 부르지 않아 서버만 새로 바뀌어도 그대로 동작한다. 코인·영상은 `expo-video`·`expo-image` 네이티브 모듈이라 원격 업데이트로는 못 보내고 1.4.0 설치가 필요하다

결정(10-21, 사용자):

- 화폐 이름은 `coin`. 예전 캐릭터 2D 홈의 동전 더미(`coinStage`)는 코드에서 모두 지웠다
- 처음 계획은 "레벨 코스튬 영상 5개가 들어온 뒤 출시"였지만, **광부(`costume-lv1`)·잭팟(`outfit-01`) 2개로 먼저 출시**한다. 나머지는 V8에서 `active=FALSE`라 화면에 나오지 않는다. 영상이 들어오는 대로 `coin-plan.md` "영상을 받았을 때" 절차로 하나씩 켠다
- **잭팟은 원래 Lv.4 고양이**인데 코스튬이 목표 8개가 될 때까지 상점 상품(200코인)으로 판다. 8개가 되면 `V{n}`으로 `outfit-01`을 끄고 `costume-lv4`를 켜서 Lv.4 해금으로 옮긴다. 이미 산 사람은 계속 보유한다(코인을 돌려줄지는 그때 결정)
- 첫 화면 이미지는 제작 쪽 썸네일(`cat-000-thumbnail.jpg`)을 `prepare-outfit-video.py` 세 번째 인자로 넣어 만든다. 두 영상 모두 오른쪽 아래에 Gemini 워터마크(✦)가 흐리게 남아 있다. 다음 영상부터는 워터마크 없이 받는 것이 좋다

10-21 작업 중 생긴 일:

- **로컬 E2E가 운영 API에 붙은 사고.** `EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo export -p web`으로 만든 웹이 운영 주소를 그대로 쓰고 있었다. 여러 워크트리가 같이 쓰는 Metro 변환 캐시(OS 임시 폴더)에 운영 주소가 박힌 번들이 남아 있었기 때문이다. 그 상태로 기존 E2E를 돌려 운영에 테스트 계정(`@example.com`) 4~5개와 예산 설정이 생겼다(12:47~12:48 KST). 받을 수 없는 주소이고 남에게 보이지 않아 **그대로 두기로 했다**(사용자 결정). 재발 방지: 로컬 E2E용 웹 빌드는 `--clear`를 붙이고, 돌리기 전에 `grep -c duckdns dist/_expo/static/js/web/*.js`가 0인지 본다
- EAS 빌드 업로드가 `EBUSY ... backend/build/localdb/flexable.mv.db`로 실패했다. 로컬 H2 백엔드(`bootRun`)가 DB 파일을 잡고 있었다. 빌드 전에 로컬 백엔드를 끈다(§4-2)

### 0-0. 10-20 소셜 계정 연결 후 이메일 로그인 안내

- 10-19(PR #76): 확인된 이메일이 같은 기존 계정이 있으면 소셜 로그인 때 그 계정에 연결해 로그인한다. 전에는 "이미 가입된 이메일"로 막혔다. 이때는 연결하면서 비밀번호를 지웠다.
- 10-20 변경: 비밀번호를 지우지 않고 연결만 한다. 연결된 계정에 이메일로 로그인하면 **비밀번호가 맞아도** 401 `SOCIAL_ACCOUNT`("Google로 가입한 계정이에요. Google로 로그인해 주세요")를 받는다. 앱은 이 안내와 함께 그 소셜 버튼을 보여 준다. 남의 주소로 선가입한 계정을 막으려고 연결할 때 기존 세션을 끊는 동작은 유지한다.
- 10-19~20 사이에 연결된 계정은 비밀번호 해시가 이미 지워졌다. 이 계정도 identity가 있으므로 같은 안내를 받는다.
- 반영: 백엔드는 `deploy.sh`로 배포한다. 앱 로그인 화면의 소셜 버튼은 JS 변경이라 EAS 원격 업데이트로 반영한다. 업데이트 전 앱도 서버 안내 문구는 그대로 보여 준다(버튼만 없음).

### 0-1. 2026-10-20 — 앱·앱 API 업무

웹 제품의 기획·데이터·화면·일정은 [flexable-web 인수인계](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/HANDOFF.md)에서 관리한다. 웹 서버는 flexable-web `backend/`에서 따로 만든다(2026-10-20 분리 결정). 이 저장소에는 [앱 연동하기]용 API와 앱 설정 화면만 추가한다. 경계는 [앱·웹 서비스 경계](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/04-service-boundaries.md).

시드머니(10-20 사용자 결정, Flyway V7, 앱 1.3.0) — 코드만, 운영 반영 전:

- 결정: 가입 때 **모아둔 돈**(`seedBase`)과 **매달 저축할 돈**(기존 '보호 금액' `protectedItems`를 이름만 바꿈)을 받는다. 수입일 전날 기기 알림 → 반영 창(매달 저축할 돈 / 실제로 모은 돈 전부 / 직접 입력). 옮긴 돈은 생활비 잔액에서 빠진다. 응답하지 않으면 다음 수입일 전날까지 기다린다. 이 값(확정 시드머니)을 웹 연동으로 보낸다
- [ ] 순서: ① 백엔드 배포(V6·V7) **10-20 완료** → ② 앱 1.3.0 새 빌드(`expo-notifications` 네이티브 모듈, `app.json` 1.3.0) → Play 업로드. #83 머지(10-20)로 `main`은 runtime 1.3.0이라, 1.2.0 앱용 원격 업데이트는 #83 이전 커밋(`eae263a`)에서만 낼 수 있다. 10-20 preview 빌드(1.3.0)를 EAS에서 시작했다 — 실기기 확인 → production AAB → Play 업로드가 남았다. **→ 10-21: 1.4.0이 대신한다(위 "0-코인"). 1.3.0은 Play에 올리지 않는다**
- [ ] 1.2.0 앱(서버만 새로)은 그대로 동작한다: 예산 설정 저장 때 `seedBase`를 보내지 않아 저장값이 유지되고, 반영 창·알림은 1.3.0부터
- 반영 창은 화면 가운데 모달이다(10-20 사용자 결정, PR #88). 매달 저축할 돈이 처음 선택돼 있고, 하나를 고른 뒤 [반영하기]. 바깥을 눌러도 닫히지 않고 [나중에]·뒤로 가기로만 닫힌다. 알림을 누르면 홈 데이터를 다시 읽어, 앱이 홈에 떠 있던 경우에도 창이 뜬다
- [ ] 실기기 확인(1.3.0). preview 채널 원격 업데이트 **10-21 게시**(그룹 `68048ca1-9b66-495c-803c-c70e968efa72`, 커밋 `44bec80`, #87·#88·#91 포함). preview 앱을 두 번 껐다 켜면 받는다. 알림은 웹·E2E로 확인할 수 없다
  - [ ] 홈 첫 진입 때 알림 권한을 묻는다(거부해도 홈에서 반영 창은 뜬다)
  - [ ] 수입일 전날 20시 알림 → 누르면 홈 → 반영 모달: ① 앱이 꺼져 있을 때 ② 백그라운드에 홈이 떠 있을 때 ③ 다른 탭에 있을 때
  - [ ] 세 가지 반영(매달 저축할 돈 / 전부 / 직접 입력) 각각 → 시드머니 합계와 오늘 쓸 수 있는 돈이 바뀌는지
  - [ ] '나중에' → 다른 탭 갔다 와도 다시 안 뜨고, 앱을 다시 열면 다시 뜨는지
  - [ ] 직접 입력 때 키보드가 금액 칸과 버튼을 가리지 않는지, 가로 화면에서 모달이 스크롤되는지
  - [ ] 마이 '수입일 전날 알림'을 끄면 예약 알림이 사라지고, 다시 켜고 홈에 가면 다시 예약되는지. 로그아웃하면 취소되는지
  - 빠른 확인 방법: 예산 설정에서 수입일을 내일로 바꾸면 오늘 20시에 알림이 예약된다(20시가 지났으면 예약하지 않는다)
- [x] 개인정보처리방침·이용약관: 수집 항목 문구를 '보호 금액' → '매달 저축할 돈, 모아둔 돈, 시드머니 반영 기록'으로 바꾸고 **시행일 2026-10-27**(머지일 10-20 + 7일, 사용자 결정)로 했다. 방침 첫머리 '개정 안내'와 11장·약관 부칙에 변경 내용을 적어 7일 전 고지를 대신한다. Play Console 데이터 보안 양식은 범주(기타 금융 정보)가 같아 바꾸지 않는다(제출 전 확인만)

앱 디자인 시스템 v2(PR #87, 10-20) — 코드만, 운영 반영 전:

- 토큰은 `frontend/src/theme/index.ts`, 시안은 [디자인 개편 시안](https://claude.ai/artifact/1mmbGZNgazLQ3p5AqvNfCY)(비공개). 토스트·다이얼로그·시트는 기존 모양 유지(사용자 결정)
- [x] 백엔드 배포 **10-21 완료**(`deploy.sh`, 커밋 `44bec80`, #90 포함, 새 마이그레이션 없음). `/actuator/health` UP 확인. `todayAvailable`은 오늘 예산을 넘으면 음수다(`BudgetCalculator`). 1.2.0 앱은 계속 0원으로 보여 준다
- [ ] 앱은 JS 변경만이라 1.3.0 빌드에 원격 업데이트로 반영된다(preview 10-21 게시, 위 그룹). production 승격은 1.3.0 AAB를 Play에 올린 뒤, 그리고 아래 '웹 연동 개인정보처리방침' 결정 뒤에(#91이 연동 메뉴를 연다). **→ 10-21: 1.4.0 빌드에 들어갔으므로 승격하지 않는다(위 "0-코인")**. 실기기: 거래 저장 → 복귀 5회, 날짜→시간 연속 선택, 카드 그림자, 마이 '수입일 전날 알림' 끄면 알림이 안 오는지
- 거래 내용을 비우면 고른 카테고리 이름으로 기록한다(서버는 내용 필수 그대로). 메모 입력은 없앴고 기존 메모는 수정해도 유지된다

웹사이트 연동 API(`weblink`, Flyway V6) — 코드만 머지, 운영 반영 전:

- [x] 서버 `.env`에 `WEB_LINK_SERVICE_KEYS` 추가 → 백엔드 배포(`deploy.sh`, V6·V7 적용) — 10-20 사용자 실행. 확인: `/actuator/health` UP, 키 없는 `POST /internal/v1/web-links` 401. 키 값은 서버 `.env`와 팀 비공개 공간에만 있다. 웹 서버가 앱 연동을 구현하면 같은 값을 그쪽 환경변수에 넣는다
- [x] 앱 설정 → [웹사이트 연동]: 코드 발급·재발급 확인·만료 안내, 연동 목록 새로고침·개별 해제 확인 화면 구현(`WebLinksScreen.tsx`). 코드는 화면 메모리에만 두고 화면을 벗어나면 지운다. JS 변경만 있으며 새 패키지·네이티브 설정 변경은 없다. 배포·실기기 확인은 아직 하지 않았다
- 로컬 검증(10-21, 최신 main 기준): `npm run typecheck`, `npm run lint`, `npm run build:web` 통과. `playwright test e2e/web-links.spec.ts` 2개 통과(API 모의 응답, 390×844 브라우저). 실제 앱·웹 서버 사이 연동이나 Android 실기기 검증 결과는 아니다
- [ ] 1.3.0 출시와 아래 개인정보처리방침 결정 후 원격 업데이트 게시(사람). **→ 10-21: 원격 업데이트 없이 1.4.0 빌드로 나갔다.** 실기기 확인만 남았다. 실기기에서 코드 발급 → 웹 입력 → 앱 목록 새로고침 → 해제까지 확인한다. 웹과의 실서버 연동 검증이 남았다
- [ ] 사람 결정: 웹 연동으로 앱 이메일·로그인 방법과 확정 시드머니를 웹 서비스에 넘기는 내용을 개인정보처리방침에 넣을지와 시행일. 앱 화면에 연동 메뉴를 열기 전에 정한다. **→ 10-21: 결정 전에 1.4.0으로 메뉴가 열렸다. 위 "0-코인"의 선택지에서 정한다**
- 웹 제공 범위는 정본 [앱·웹 서비스 경계 §5-2](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/04-service-boundaries.md)가 기준이다. 기존에 적었던 ‘이후 유동자산 집계’는 이 범위 밖이다. 추가로 넘기려면 정본을 먼저 고치고 계약·개인정보 제공 항목을 합의해야 한다
- 알려진 한계: 코드 실패 제한은 API 프로세스 메모리에 있다(API 서버 1대 운영 전제, 재시작하면 초기화)

기존 앱 출시 기록(10-19, 현재 배포 상태는 재확인 필요):

1. [x] **앱 원격 업데이트 → PR #67 머지 순서 지키기(10-19 완료)**: #67(Play 경고 대응, 앱 1.2.0)보다 먼저 #64(탭바 위 + 버튼, 0원일 때 빨간 상단 패널)·#66(내역 탭 기록 버튼 삭제)을 1.1.0용으로 게시했다. main `c146127`에서 preview `1996d0c4` → production `5ed7d163`. #61(필수 업데이트 창)은 이전 그룹 `c3948c24`로 이미 나가 있었다. 이후 main의 원격 업데이트는 1.2.0 빌드만 받는다.

5. [x] **캐릭터 홈 3D 방식 결정 → 영상 방식(10-21).** 16:9 MP4를 `expo-video`로 소리 없이 반복 재생, 앱 1.4.0에 넣었다(위 "0-코인"). 아래는 결정 전 검토 기록이다.
   - 권장안(새 빌드 불필요): 3D 렌더 결과를 지금처럼 프레임 이미지(WebP 8~12장, 레벨당 150~300KB)로 넣는다. 원격 업데이트로 반영되고 투명 배경도 유지된다.
   - 영상 방식: `expo-video`(네이티브 모듈)를 써야 해서 새 빌드가 필요하다. 이 방식으로 간다면 **1.2.0 빌드(#67)에 함께 넣어야** 네이티브 출시를 한 번 더 하지 않는다. 투명 배경이 어렵고, 3~5초 반복 영상 한 편을 1MB 이하로 맞춰야 한다.
   - [x] **앱 디자인 3차 회의 제안 중 남은 것 — 10-22 대표 결정.** 탭 라벨·터치 48·마이 설정 행 정리는 디자인 시스템 v2(#87)로 반영했다. 히어로는 파란 면 유지·0원 이하 빨강(#64 정본)으로 정했고 넘으면 마이너스 금액을 보여 준다(#87). 남은 제안은 [시안 캔버스](https://claude.ai/artifact/Kb4tAJwaH6pjaeKHt9eXnC)(비공개)로 보고 정했다: **새 카테고리 색만 채택**(8색 → 회색 2개를 뺀 6색, 회색은 고정지출·기타 기본 카테고리 색으로만 남김), **반려**: 추정 고지 상시 13px, 캐릭터 160dp, 고양이 말투, 플로팅 + 버튼 제외(#64 그대로). 6색은 JS 변경이라 다음 원격 업데이트로 나간다. 웹 디자인 결정 대기 항목은 flexable-web HANDOFF 7번에 있다.


6. [ ] **1.2.0 AAB를 Play에 올리고 실기기 확인(사람).** #67 머지와 production 빌드 시작까지는 10-19 밤에 끝냈다.
   - **→ 10-21: 1.4.0(vc12)을 Play에 올렸으므로 1.2.0 AAB를 따로 올릴 필요는 없다.** 아래 휴대폰 확인 항목(R8·가로 회전 포함)은 1.4.0 앱으로 한다
   - 빌드 완료(10-19 밤): 1.2.0 / versionCode 9 / 커밋 `0b5a66b` / Play 업로드 키스토어(EAS 원격). AAB 안에 R8 매핑(`BUNDLE-METADATA/.../proguard.map`)이 들어 있다.
     https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/builds/3b5f443c-c818-45c9-9138-dd4e9f47e185
   - 위 페이지에 `ucmnuniverse-developer` 계정으로 로그인해 AAB를 받는다(어느 PC든 된다). 집 PC에는 `Downloads/flexable-1.2.0-vc9.aab`(75MB)로 받아 두었다. 다시 빌드하면 versionCode는 10이 된다.
   - **내부 테스트 또는 비공개 테스트 트랙에 먼저** 올린다. R8 코드 축소와 화면 회전이 처음 들어간 빌드다. 따로 preview APK를 만들지 않았으니 이 빌드로 바로 확인한다.
   - 휴대폰에서 확인할 것: 가입·로그인, 거래 저장·수정, 날짜 선택기, 카테고리 추가, 홈 + 버튼, 가로 회전(시트 92% 높이·스크롤, #67 본문).
   - 업로드 뒤 App Bundle 탐색기에서 난독화 해제 파일이 등록됐는지 본다. 다음 Android vitals 검사에서 'DEX 코드 최적화'와 '방향 제한' 경고가 사라졌는지 본다.
   - `public/app-version.json`의 `android.minVersion`은 테스터 Play 스토어에 1.2.0이 보인 **뒤에만** 올린다(§4-2 필수 업데이트).
   - 1.1.0 앱은 1.2.0용 원격 업데이트를 받지 않는다. 5번에서 영상 방식(`expo-video`)을 고르면 네이티브 빌드를 한 번 더 해야 한다.

### 웹 임시 로그인 연동 기록(10-19)

- 서버 `/opt/flexable/.env`의 `CORS_ORIGINS`·`OAUTH_ALLOWED_REDIRECT_URIS`에 새 웹 주소를 더하고 API를 다시 시작했다. 도메인을 사면(14번, 확정 18) 기존 DuckDNS 주소는 그대로 두고 새 주소를 **더한다**. 순서: ① 카카오·Google 콘솔에 새 API 콜백(`https://api.<도메인>/api/v1/auth/oauth/{kakao,google}/callback`)을 추가(기존 콜백은 지우지 않음) → ② 서버 `.env`의 `CORS_ORIGINS`·`OAUTH_ALLOWED_REDIRECT_URIS`에 새 웹 주소 추가 → ③ 공급자에게 넘기는 콜백을 새 주소로 옮길 때만 `OAUTH_CALLBACK_BASE_URL`을 바꾸고 `docker compose up -d`(①이 먼저 끝나 있어야 로그인이 안 깨진다) → ④ `frontend/vercel.json`의 `/m` redirect 목적지를 새 웹 주소로.

**계속 진행 중**

- Play 비공개 테스트 테스터 12명 이상, 14일 유지 → 프로덕션 액세스 신청(`docs/play-store/README.md` §5).
- 아래 0-2(10-16 목록) 중 소셜 로그인 1~5번은 10-19에 완료를 확인했다. 나머지 항목은 아직 상태를 다시 확인하지 않았다.
- EC2 SSH: 보안 그룹 `flex-api-web` 22번에 10-19 작업 PC IP를 추가했다. 작업이 끝난 PC의 IP는 지운다(§5).
- 10-16 보안·리팩토링 검토 문서(`docs/security-plan-…`, `security-presentation-brief.md`, `refactoring-review-…`)는 저장소에 넣지 않는다(10-19 결정). 고치지 않은 약점을 위치까지 나열해 공개 저장소에 두면 공격 목록이 되기 때문이다. 팀 비공개 공간(노션·드라이브)에 둔다. 리팩토링 R1·R2는 #58·#56으로 수정, R3은 #57로 만료 정리까지 했다. 보안 검토의 접근 제어 테스트 4개는 `backend/.../SecurityTest.java`로 옮겼다(#74).
- R3 기록 수 상한 후속 작업(10-20, 코드 반영·운영 배포 전): 예약 포함 이메일 최대 10,000개·이메일당 실패 기록 최대 5개. 비밀번호 확인 전에 기록 공간을 예약한다(실패 없는 예약도 10분 만료). 상한이면 만료 기록을 정리하고, 여전히 가득 차면 기록이 없는 이메일은 비밀번호 확인 전 429로 일시 차단한다. 기존 차단 기록은 보존한다. 계약은 `docs/API.md`의 `POST /auth/login`. 로컬 `gradlew test` 63개 통과(실패·건너뜀 0); 동시 요청·예약·만료 경계·상한 상태의 로그인 API 검증 포함. 실기기·운영 확인은 하지 않았다.

### 0-2. 10-16 기준 목록(상태 확인 필요)

**10-17 카카오·Google 로그인(PR `SXXNHU/feat-social-login`) — 반영 순서**
- 10-19 확인: 운영 `GET /api/v1/auth/oauth/providers`가 `["kakao","google"]`를 반환(서버 `.env` 키·V5 배포 반영), 두 공급자의 `/start`가 리다이렉트 URI 오류 없이 각 로그인 화면으로 이동(콘솔 등록 반영).
1. [x] 카카오 디벨로퍼스: 앱 생성 → [카카오 로그인] 사용 ON → [앱] > [플랫폼 키] > [REST API 키]의 리다이렉트 URI에 `https://flex-able-sh.duckdns.org/api/v1/auth/oauth/kakao/callback` 등록, 같은 화면의 클라이언트 시크릿 확인. 이메일을 받으려면 [계정 설정] 본인인증 → [앱] > [일반] > [비즈니스 정보] > [개인 개발자 비즈 앱] 전환 → [동의항목]에서 카카오계정(이메일)만 선택 동의(닉네임·프로필은 받지 않음 — 개인정보처리방침과 맞춤). 이메일이 없어도 로그인은 된다
2. [x] Google Cloud: Google Auth Platform 브랜딩·대상(외부) 설정 → 클라이언트(웹 애플리케이션) 생성, 승인된 리디렉션 URI `https://flex-able-sh.duckdns.org/api/v1/auth/oauth/google/callback`. 결제 계정은 필요 없다. '테스트' 상태면 테스트 사용자만 로그인된다(테스터 등록 또는 프로덕션 게시). scope는 `openid email`만
3. [x] 서버 `/opt/flexable/.env`에 키 추가(이름은 `backend/deploy/.env.example`): `OAUTH_CALLBACK_BASE_URL`, `OAUTH_ALLOWED_REDIRECT_URIS`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_ADMIN_KEY`(선택, 탈퇴 시 카카오 연결 끊기), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. 키가 비어 있으면 그 공급자만 "쓸 수 없어요"로 안내되고 서버는 정상 동작한다
4. [x] 백엔드 배포(`deploy.sh`, Flyway V5: `users.email`·`password_hash` NULL 허용 + `user_identities`). **웹(main 머지 시 Vercel 자동 배포)보다 먼저 또는 같이** — 옛 서버에 붙은 새 웹은 소셜 버튼을 "쓸 수 없어요"로 안내하므로 순서가 바뀌어도 깨지지는 않는다
5. [x] 앱 1.1.0 새 빌드(`expo-web-browser` 네이티브 모듈 추가, runtimeVersion이 1.1.0으로 바뀜) → Play 비공개 테스트 업로드. 1.0.0 앱은 1.1.0용 원격 업데이트를 받지 않는다
6. [ ] 실기기 확인(1.2.0 빌드로, P1 6번과 함께): 카카오·Google 로그인 후 브라우저가 닫히고 홈/온보딩으로 한 번만 이동, 동의 화면 취소 → "로그인을 취소했어요", 같은 이메일의 기존 이메일 계정 → 안내, 소셜 계정 탈퇴('탈퇴' 입력), 시작 화면 하단 링크
7. [ ] 사람 결정: 개인정보처리방침·이용약관 개정 시행일과 변경 고지(지금 표기는 10-14 그대로), 소셜 가입을 안내 문구로 동의받는 방식이 충분한지
- 알려진 한계: OAuth state·1회용 코드는 API 프로세스 메모리에 있다(상한 각 10,000개) → API 서버는 1대로만 운영. 재시작하면 진행 중이던 로그인만 실패한다

**10-16 PR #50(CI·서버 감시)·#51(문의 이메일·운영자 표시명 `ucmnuniverse` 통일) 머지 후 남은 것**
- [x] 백엔드 배포(10-16 01:01 UTC, 사용자 요청으로 Claude가 실행): `/actuator/health`에 `components`(db, diskSpace 등)가 나오고 세부값은 숨겨진 것 확인. 배포 전 디스크가 96%(남은 271MB)라 apt 캐시를 지운 뒤 배포했다(§5)
- [x] 원격 업데이트 production 승격(10-16): preview `25bdbc3d`(#47 시연 코드 정리, #49 원그래프 회전, #51 문의 이메일·운영자명)를 production 그룹 `9fd66eb2`로 승격(§4-2)
- [ ] 실기기 확인(production `9fd66eb2`를 받은 Play 앱): 업데이트 배너가 뜨고 "지금 적용"이 동작하는지(#45 이후 첫 업데이트), 마이·고객지원·계정 삭제의 문의 주소, 약관·개인정보처리방침의 운영자명, 분석 화면 원그래프 시작 위치(12시 방향). 문제가 있으면 `d63078bb`를 production에 다시 게시해 되돌린다
- [ ] Play Console 스토어 등록정보 → 자세한 설명 끝 "문의:" 줄을 `ucmnuniverse@gmail.com`으로(`docs/play-store/README.md`의 문구와 같게)
- [ ] `docs/play-store/README.md` §3.7 금융 기능 선언에 Play Console에서 실제로 고른 항목을 적고 TODO를 지운다

1. [ ] **진행 중(10-16~)** 비공개 테스트 테스터 모집: 12명 이상(여유 있게 14~15명)이 옵트인한 날부터 14일 연속 유지 → Play Console에서 프로덕션 액세스 신청. 안내 문구·옵트인 링크·피드백 주소는 `docs/play-store/README.md` §5
2. [x] Play Console 비공개 테스트에 versionCode 7 AAB 업로드 → 검토 → 출시. "이전 버전 포함"은 비워 둔다(지원 기기가 같아 예전 번들을 남길 이유가 없다). AAB는 EAS 빌드 `8699a0f4`(§4-2 빌드 목록)
3. [x] Play Console 스토어 등록정보 → 앱 아이콘을 `docs/play-store/icon-512.png`(새 광부 고양이, 32비트 PNG)로 교체
4. [ ] 실기기 확인(Play에서 versionCode 7로 업데이트한 앱): 홈 화면 아이콘이 원형·둥근 사각형 런처에서 잘리지 않는지, 테마 아이콘, 동전 4단계, 게이지 퍼센트 표시, 거래 완료 알림이 상단에 뜨는지, 다음 원격 업데이트 때 업데이트 배너가 뜨고 "지금 적용"이 동작하는지, 거래 수정·수입 저장 후 빈 화면이 다시 나오지 않는지(PR #23·#25, `docs/bug-transaction-edit-blank-screen.md`)
5. [ ] 팀원 2차 피드백 수집(노션)
6. [ ] `docs/play-store/` 스크린샷 교체 검토(예전 홈 화면·아이콘 기준)
7. [ ] 운영 DB에 남은 테스트성 계정 3개(`test1@`·`test@`·`baeh@` 로 시작) 정리 여부 결정. 목록은 §5의 조회로 확인. `play.review@flexable.app`은 지우지 않는다
8. [x] production AAB를 Play Console 내부/비공개 테스트 트랙에 업로드(10-14, versionCode 5)

지난 변경 내역은 PR 목록과 `git log`에 있다. 기능별 현재 상태는 `docs/FEATURES.md`.

## 1. 지금 상태

| 영역 | 상태 | 위치 |
|---|---|---|
| API 서버 | 운영 중 | `https://flex-able-sh.duckdns.org/api/v1` (EC2 + RDS), 코드 `backend/`, 계약 `docs/API.md` |
| 웹(앱 서비스) | Vercel이 `main`을 자동 배포 | `https://project2-flex-sh.vercel.app` (옛 `/demo`는 `https://flexable-web-delta.vercel.app/m`으로 이동, `/privacy`·`/terms`·`/support`·`/delete-account` 공개 페이지) |
| 웹사이트(해커톤)·앱 시연 | 별도 저장소, Vercel이 `main`을 자동 배포(10-19~). 초기 UI·로그인 기반 제공, 기능별 상태는 웹 저장소 README에서 관리 | `https://flexable-web-delta.vercel.app` (시연 `/m`), 코드 [`shinds-team7/flexable-web`](https://github.com/shinds-team7/flexable-web) |
| CI | PR·`main` 푸시마다 백엔드 테스트(접근 제어 보안 테스트 `SecurityTest` 포함, 10-19~), tsc·lint, 정적 웹 빌드 + E2E 자동 실행(10-16~) | `.github/workflows/ci.yml` |
| 서버 감시 | 15분마다 API(앱·DB·디스크)·웹·인증서 확인, 실패하면 이슈 자동 생성(10-16~) | `.github/workflows/server-health.yml`, §5 |
| 앱 서비스 화면 | 완료, 1차 피드백 반영(PR #15), E2E 13개를 CI에서 실행 | `frontend/src/service/`, `frontend/src/app/` (기능별 상태는 `docs/FEATURES.md`) |
| Play 제출 자료 | 초안·그래픽·스크린샷 완료 | `docs/play-store/` |
| 심사용 계정 | 운영 서버에 생성 완료 | `play.review@flexable.app` (비밀번호는 §2) |
| Android 빌드 | 비공개 테스트에 1.4.0(versionCode 12, 코인·영상·R8·화면 회전) 출시(10-21). `minVersion` 1.4.0이라 1.3.0 이하는 필수 업데이트 창. 실기기 확인 전(§0 0-코인) | §4-2 |
| Play Console | 개발자 계정 `ucmnuniverse`. 비공개 테스트 출시·스토어 아이콘 교체 완료, 테스터 모집 중(10-16) | §4-3, `docs/play-store/README.md` |

## 2. 따로 챙길 것 (저장소에 없음)

| 항목 | 어디에 있나 | 새 PC에서 |
|---|---|---|
| EC2 SSH 키 `sh-flex.pem` | 기존 PC 바탕화면 | 메신저·메일·git으로 보내지 말고 USB나 비밀번호 관리자로 옮긴다. `~/.ssh/sh-flex.pem`, 권한 600 |
| RDS 마스터(admin) 비밀번호 | 담당자가 보관 | 평소에는 필요 없음(앱은 `flexable_app` 계정 사용) |
| 서버 비밀값(DB 앱 비밀번호, JWT 비밀키) | EC2 `/opt/flexable/.env`에만 있음 | 옮길 필요 없음. **JWT_SECRET을 바꾸면 모든 사용자가 로그아웃됨** |
| 심사용 계정 비밀번호 | 2026-10-13 대화로 전달 | 팀 비밀번호 보관함에 저장 → Play Console 앱 액세스에 입력 |
| Expo 계정 | 조직 `ucmnuniverse-developer`(Owner 계정 `ucmnuniverse`), 프로젝트 `fb9b50f5-3e92-4eb3-8cea-1c1a149b23ef` | `npx eas-cli@latest login` (Claude 셸에서는 `login --device --non-interactive`로 링크 승인) |
| Play Console 개발자 계정 | — | 개인/조직 여부에 따라 14일 테스트 조건이 다름(`docs/play-store/README.md` §1) |
| DuckDNS 계정 | 담당자 계정(`flex-able-sh`) | IP가 바뀌면 여기서 갱신 |

## 3. 새 PC 준비

```bash
git clone https://github.com/shinds-team7/project2.git && cd project2
# JDK 21, Node 22+, Git Bash, GitHub CLI(gh) 설치

# 백엔드
cd backend && ./gradlew test
./gradlew bootRun --args='--spring.profiles.active=local'   # MySQL 없이 H2로 실행

# 프론트
cd ../frontend && npm ci
echo "EXPO_PUBLIC_API_URL=http://localhost:8080" > .env.local   # 로컬 백엔드에 붙일 때
npm run web
npx tsc --noEmit && npx expo lint
npx playwright test     # 로컬 백엔드(8080)와 웹(8081)을 먼저 띄운 뒤 실행
```

- 운영 웹 빌드는 `frontend/.env.production`(공개 API 주소)를 쓴다. 앱 빌드와 원격 업데이트는 EAS 환경변수(`preview`·`production` 환경의 `EXPO_PUBLIC_API_URL`)를 쓴다. 확인은 `npx eas-cli@latest env:list --environment production`.
- 운영 API의 CORS는 서버 `.env`의 `CORS_ORIGINS`로 정한다(지금 `https://project2-flex-sh.vercel.app`, `http://localhost:8081`, `https://flexable-web-delta.vercel.app`). 웹 주소를 더할 때는 `OAUTH_ALLOWED_REDIRECT_URIS`에도 `…/oauth/callback`을 더하고, `/opt/flexable`에서 `docker compose up -d`로 컨테이너를 다시 만든다(`restart`는 `.env`를 다시 읽지 않는다). 10-19에 새 웹사이트 주소를 이렇게 추가했다.
- Windows Git Bash에서 `curl -d '한글'`은 깨져서 400이 난다. 한글 요청은 UTF-8 파일(`--data-binary @file.json`)로 보낸다.
- **Windows에서 `npx expo install`로 패키지를 추가하면 `package-lock.json`에서 `node_modules/@emnapi/core`·`runtime` 항목이 빠질 수 있다.** 그대로 커밋하면 EAS(리눅스)의 `npm ci`가 실패한다(#9, #16). 커밋 전에 두 항목이 남아 있는지 확인한다.
- **EAS는 npm 10.9.8(Node 22)로 `npm ci`를 한다.** 로컬 npm 11이 넘기는 peer 불일치를 npm 10은 오류로 본다(#20 → #21로 되돌림: `expo` 57.0.28이 `react-native-worklets@0.10.4`를 요구). 패키지를 바꾼 뒤에는 `package.json`·`package-lock.json`만 빈 폴더에 복사해 `npx -y npm@10.9.8 ci --dry-run --ignore-scripts`로 먼저 확인한다. PR을 올리면 CI가 리눅스·Node 22(npm 10)로 `npm ci`를 돌려 같은 문제를 한 번 더 잡는다.
- Claude Code를 쓸 때: 권한 규칙은 PC마다 따로라 새 PC에서 다시 추가한다(`/permissions` → Allow: `Bash(gh pr merge:*)`, `Bash(ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99:*)`, `Bash(scp -i ~/.ssh/sh-flex.pem:*)`, `Bash(bash backend/deploy/deploy.sh:*)`). Claude 셸에서는 `eas login`의 입력을 받을 수 없으니 `eas login --device --non-interactive`로 받은 링크를 브라우저에서 승인한다(몇 분 뒤 만료).

## 4. 남은 일 (순서대로)

### 4-1. 웹 공개 페이지 확인
Play Console에 URL을 넣기 전에 아래 주소가 로그인 없이 열리는지 본다.
`/privacy`, `/terms`, `/support`, `/delete-account` (모두 `https://project2-flex-sh.vercel.app` 아래)

### 4-2. Android 빌드 (EAS)

```bash
cd frontend
npx eas-cli@latest login         # app.json에 owner·projectId가 이미 있다(PR #18)
# 1) 실기기 확인용 APK
npx eas-cli@latest build -p android --profile preview
# 2) Play 업로드용 AAB (versionCode 원격 자동 증가, Play 앱 서명 사용)
npx eas-cli@latest build -p android --profile production
```

- 10-13~14에 잠시 `apduis-team`으로 옮겼다가(PR #14) 원래 계정이 복구되어 `ucmnuniverse-developer/flexable`로 되돌렸다(PR #18). 서명 키가 프로젝트마다 달라서 `apduis-team` APK가 깔린 폰은 지우고 새로 설치한다. Play 업로드 키는 `ucmnuniverse-developer` 프로젝트의 키스토어(10-13 생성)다.
- 날짜·시간 선택기(`@react-native-community/datetimepicker`)는 네이티브 모듈이라 Expo Go가 아닌 빌드에서 확인한다.
- 빌드 전에 `backend`에서 `./gradlew --stop`을 실행한다. Gradle 데몬이 잡은 `backend/.gradle` 잠금 파일 때문에 EAS 업로드가 `EBUSY`로 실패한다. 로컬 H2 백엔드(`bootRun`)가 켜져 있어도 `backend/build/localdb` 파일 잠금으로 같은 오류가 난다(10-21) → 먼저 끈다.
- 명령이 2분 넘게 걸리면 Claude Code의 `!` 실행이 백그라운드로 넘어간다. `--no-wait`를 붙이면 업로드까지만 하고 끝난다. 빌드 진행은 아래 빌드 목록에서 본다.
- 원격 업데이트로 바뀌지 않는 것: 앱 아이콘, 권한, 네이티브 설정. 이런 변경은 새 production 빌드를 Play에 올리고 사용자가 앱을 업데이트해야 반영된다. Play는 사용자에게 바뀐 부분만 내려받게 하므로 AAB는 매번 전체를 올린다.
- **1.2.0부터** 릴리스 빌드에 R8 코드 축소(`expo-build-properties`의 `enableMinifyInReleaseBuilds`)를 켜고 화면 방향 고정(`orientation: portrait`)을 풀었다. Play Console의 'DEX 코드 최적화 기준 미만'·'대형 화면 크기 조절·방향 제한' 경고 대응이다. preview APK도 릴리스 빌드라 R8이 적용되니, 먼저 가입·로그인·거래 저장·날짜 선택기·가로 회전을 확인한다. AAB를 올린 뒤 App Bundle 탐색기에서 난독화 해제 파일이 등록됐는지 본다. 리소스 축소(`enableShrinkResourcesInReleaseBuilds`)는 JS에서 부르는 이미지가 지워질 수 있어 켜지 않았다.
- Play의 'Android 15 지원 중단 API(setStatusBarColor 등)' 경고는 React Native(`StatusBarModule`, `WindowUtilKt`)와 Material 라이브러리(날짜 선택기가 사용) 안의 코드라 앱 설정으로 없앨 수 없다. 기한 없는 권장 사항이고, 라이브러리가 바뀌는 SDK 업그레이드 때 다시 본다.
- 빌드 목록·다운로드: https://expo.dev/accounts/ucmnuniverse-developer/projects/flexable/builds

#### 원격 업데이트 (EAS Update)

`expo-updates`가 들어간 빌드(PR #19 이후)는 JS·이미지 변경을 다시 설치하지 않고 받는다. 앱은 실행할 때 새 업데이트를 내려받는다. 스플래시가 떠 있는 3초 안에 받아지면 바로 적용하고(`src/service/LaunchUpdate.ts`), 그보다 늦으면 안내 없이 그다음 실행(앱을 완전히 껐다 켤 때)에 적용한다. 켜 둔 채 앱으로 돌아오면 10분 간격으로 확인해 미리 받아 둔다. "새 버전이 준비됐어요 · 지금 적용" 배너는 10-22에 없앴다. 그래서 업데이트가 있거나 인터넷이 느린 날은 시작이 최대 3초 늦어진다(적용이 멈추면 10초 뒤 그냥 연다). preview APK는 `preview` 채널, Play용 AAB는 `production` 채널을 본다.

**2026-10-19 최신(1.1.0):** production `5ed7d163`(#64 홈 + 버튼·0원 빨간 패널, #66 내역 기록 버튼 삭제, preview `1996d0c4`, 커밋 c146127) ← `c3948c24`(#61 필수 업데이트 창). 되돌릴 때는 `c3948c24`를 production에 다시 게시한다. preview·production 환경변수가 같은 것을 확인했다. 1.0.0 런타임의 최신은 `a6960891`(1.1.0으로 안내하는 필수 업데이트 창)이다.

**2026-10-16 최신:** production `9fd66eb2`(#47 시연 코드 정리, #49 원그래프 회전, #51 문의 이메일·운영자명, preview `25bdbc3d`, 커밋 e77b1d7) ← `d63078bb`. 되돌릴 때는 `d63078bb`를 production에 다시 게시한다. preview·production 환경변수가 같은 것을 확인했다.

**2026-10-15 최신:** production 그룹 이력(위가 최신) — `d63078bb`(PR #45 업데이트 배너, preview `1cefd7bf`) ← `2c35943a`(PR #43 완료 알림 상단, preview `677bc2d0`) ← `1d3f76aa`(PR #37·#38, preview `aa8168a2`) ← `c2afb9ea`. 되돌릴 때는 바로 아래 그룹을 production에 다시 게시한다. 업데이트 배너는 #45를 받은 뒤 나가는 다음 원격 업데이트부터 뜬다(실기기 확인 전). 같은 날 versionCode 7을 빌드했다. `app.json`의 `version`은 그대로 1.0.0이라 런타임도 1.0.0이고, 아이콘·권한 변경은 JS와 무관해서 versionCode 5·6·7이 같은 원격 업데이트를 받아도 된다.

```bash
cd frontend
# 로그인 계정 ucmnuniverse 및 최신 main, 대상 빌드·런타임을 먼저 확인
npx eas-cli@latest whoami
# Play 내부 테스트 앱은 production 채널을 사용
npx eas-cli@latest update --channel production --environment production --platform android --message "변경 내용" --non-interactive
```

- preview APK로 먼저 검증할 때는 `npm run update:preview -- --message "변경 내용" --non-interactive`로 올린다. 결과의 `Update group ID`를 받아 같은 번들을 production으로 승격한다: `npm run update:promote -- <preview 그룹 ID> --message "변경 내용"`. 승격은 preview·production 환경변수가 같을 때만 쓴다(`npx eas-cli@latest env:list --environment preview`/`production`, `env:list`에는 `--non-interactive`가 없다).
- `update:republish`는 non-interactive 모드에서 `--channel`로 고를 수 없고 `--group`만 받는다. 그래서 `update:promote` 스크립트는 그룹 ID를 인자로 받는다. `--message`도 반드시 넣는다(없으면 non-interactive에서 실패). 예: `npx -y eas-cli@latest update:republish --group <preview 그룹> --destination-channel production --message "변경 내용"`
- Claude Code auto mode는 production 게시(`update`·`update:republish`를 production으로)를 운영 배포로 보고 막는다. 사용자가 프롬프트에 `! <명령>`으로 직접 실행한다. 이때 셸 위치는 Claude 세션의 현재 폴더(대개 `frontend/`)라 `cd frontend`를 붙이면 실패할 수 있다.
- `runtimeVersion`은 `appVersion` 정책이다. 네이티브가 바뀌는 변경(네이티브 패키지 추가·업그레이드, `app.json`의 권한·플러그인·아이콘, Expo SDK 업그레이드)은 원격 업데이트로 보낼 수 없다. 이때는 `app.json`의 `version`을 올리고(예: 1.0.0 → 1.0.1) 새로 빌드한다. 버전을 안 올리고 원격 업데이트로 보내면 예전 빌드에서 앱이 꺼질 수 있다.
- **필수 업데이트**: 앱은 시작할 때와 다시 열 때(10분 간격) `frontend/public/app-version.json`의 `android.minVersion`을 읽고, 설치된 버전이 이보다 낮으면 닫을 수 없는 업데이트 창(Play 스토어로 이동)을 띄운다. 파일을 못 읽으면 막지 않는다.
  - 새 네이티브 버전은 Play Console에서 출시가 끝나 테스터 Play 스토어에 새 버전이 보인 **뒤에** minVersion을 올리는 PR을 머지한다(Vercel 자동 배포). 먼저 올리면 업데이트할 수 없는 사용자가 갇힌다.
  - 되돌리려면 minVersion을 내린다. 앱이 다음 확인에 성공하면 창이 사라진다.
  - 1.0.0 앱은 1.1.0용 원격 업데이트를 못 받으므로, 이 창은 1.0.0 전용 원격 업데이트(브랜치 `SXXNHU/release-1.0.0-force-update`)를 올려야 1.0.0 사용자에게 뜬다.
- 승격은 preview에서 만든 번들을 그대로 쓰므로 preview·production 환경변수가 같아야 한다. 다르면 `npx eas-cli@latest update --channel production --environment production`으로 따로 올린다.
- 잘못 올렸으면 이전 업데이트를 같은 채널에 다시 게시해서 되돌린다(`npx eas-cli@latest update:republish --group <이전 그룹 ID>`). 그룹 ID는 `npx eas-cli@latest update:list --branch production`에서 확인한다.
- `expo-updates`가 없는 예전 빌드(10-14 이전 APK·AAB)는 원격 업데이트를 받지 않는다.

1차 피드백 반영본에서 특히 확인할 것: 거래 수정·저장(예전에 앱이 꺼지던 문제 — 빌드 4에서는 빈 화면이 뜨고 뒤로가기 시 종료, `docs/bug-transaction-edit-blank-screen.md`), 거래 날짜 달력·시간 휠, 온보딩 '이전'·'취소'·'확인' 접기, 마이 → 홈 화면 → 캐릭터 홈, 수입일이 주말일 때 남은 날짜.

실기기(APK)에서 확인할 것: 가입·로그인, 예산 설정 키보드·스크롤, 거래 입력 바텀시트, 글꼴 크게 설정, 앱 재시작 후 로그인 유지(SecureStore), 계정 삭제. 시연은 앱에 없다(웹사이트 저장소 `/m`).

### 4-3. Play Console
- 등록비를 낸 Google 계정이 복구되었다(10-14). 그 계정으로 등록(본인·주소 확인, 전화번호 인증)을 이어 간다.
- 연락처 이메일은 앱·정책 문서·Play Console 모두 `ucmnuniverse@gmail.com`이다(10-16 통일). 바꿀 때는 `frontend/src/service/config.ts`, `docs/play-store/*.md`, Play Console(연락처·스토어 설명의 "문의:" 줄)을 함께 바꾼다.
- 운영자 표시명(개인정보처리방침·약관의 운영자·개인정보 보호책임자)도 Play 개발자 표시명과 같은 `ucmnuniverse`다(10-16 통일, 예전 표시명은 쓰지 않는다). 값은 `frontend/src/service/config.ts`의 `OPERATOR_NAME`과 `docs/play-store/privacy-policy.md`·`terms.md`에 있다.

`docs/play-store/README.md` 순서대로 진행: 앱 만들기 → 앱 콘텐츠 → 스토어 등록정보(그래픽·스크린샷은 `docs/play-store/`) → 비공개 테스트 트랙 → AAB 업로드 → 테스터 12명 이상(여유 있게 14~15명) → 검토 → 옵트인 링크 배포 → 14일 유지 → 프로덕션 액세스 신청.

## 5. 서버 운영

```bash
ssh -i ~/.ssh/sh-flex.pem ubuntu@3.36.103.99
cd /opt/flexable && docker compose ps && docker compose logs api --tail 100
```

- 코드 변경 배포: 로컬에서 `backend/deploy/deploy.sh` (jar 빌드 → 업로드 → 재기동)
- **EC2 루트 디스크는 15GB다(10-20 확인, 사용 40%). 예전 6.7GB 때 문제였다.** Docker 빌드 캐시가 쌓이면 배포 빌드가 `apt-get update`(exit 100)에서 실패하는데 실제 원인은 디스크 부족이다(10-15 발생, 이슈 #31). `deploy.sh`가 배포마다 빌드 캐시·이전 이미지를 지우고 마지막에 `df` 결과를 보여 준다. 사용량이 90%를 넘으면 `docker system df`로 확인하고, 계속 부족하면 EBS 볼륨을 늘린다
- **10-16 배포 전 디스크 96%(남은 271MB)였다.** 헬스 체크 기준(300MB 미만이면 DOWN)보다 적어 배포하면 바로 DOWN이 될 상태였다. 큰 항목은 swap 2GB(유지), Docker 이미지 0.7GB, Docker 빌드 캐시 0.65GB(`deploy.sh`가 지움), apt 패키지 캐시 0.4GB. `sudo apt-get clean`으로 apt 캐시를 지워(설치된 프로그램과 무관) 683MB를 만든 뒤 배포했고, 배포 뒤 84%(남은 1.2GB). apt 캐시는 자동 업데이트로 다시 쌓일 수 있다 → 감시 이슈에 `DOWN: diskSpace`가 뜨면 `sudo apt-get clean`부터 하고, 근본적으로는 EBS를 늘린다(§6)
- 구성: `backend/deploy/` (Docker Compose: api + Caddy 자동 HTTPS), 절차는 `backend/README.md`
- **외부 감시**(`.github/workflows/server-health.yml`, 10-16 추가): 15분마다 아래를 확인한다. 예약 실행은 `main`의 파일로만 돌고, GitHub 사정으로 몇 분씩 늦거나 한 번씩 빠질 수 있다. 일시적인 오류(연결 실패, 응답 중단, 502·503)는 10초 간격으로 3번 더 시도한 뒤 판단한다.
  - `https://flex-able-sh.duckdns.org/actuator/health` — 앱, DB(RDS), 디스크(남은 공간 300MB 미만이면 DOWN). 응답의 `components`에 항목별 상태만 나온다(용량 같은 세부값은 숨김). 10-16 배포로 반영됐다
  - 웹 `/privacy`(Play에 등록한 개인정보처리방침 주소)
  - HTTPS 인증서 만료가 10일 미만으로 남았는지(Caddy 자동 갱신 실패). 만료일을 읽지 못해도 실패로 본다
  - 실패하면 저장소에 `server-health` 라벨을 단 `[서버 감시] 운영 서버 확인 실패` 이슈를 하나 연다(라벨 붙은 열린 이슈가 있으면 새로 만들지 않음). 정상으로 돌아오면 확인 기록을 댓글로 남기고 자동으로 닫는다. **팀 전체 알림은 이 이슈로 받는다**(저장소 Watch 설정)
  - 실패한 실행의 GitHub 메일은 한 사람에게만 간다. 처음에는 워크플로를 만든 사람, 그 뒤 `cron` 줄을 바꾸면 바꾼 사람, 꺼진 워크플로를 다시 켜면 다시 켠 사람이다. 그 사람의 GitHub 알림 설정(Settings → Notifications → Actions)이 켜져 있어야 한다
  - 이슈 본문에 원인별 확인 순서가 있다. 요청 실패(연결 실패·시간 초과)는 EC2 정지·IP 변경(DuckDNS), HTTP 502는 API 컨테이너, `DOWN: db`는 RDS, `DOWN: diskSpace`는 디스크
  - **공개 저장소는 60일 동안 저장소 활동(커밋 등)이 없으면 예약 실행이 자동으로 꺼진다.** Actions 탭 → 서버 상태 감시 → Enable workflow로 다시 켠다. 손으로 한 번 돌릴 때는 같은 화면의 Run workflow
- EC2: Ubuntu 26.04, t3.micro, swap 2GB. 보안 그룹 `flex-api-web`(22는 관리자 IP만, 80, 443) + `ec2-rds-1`
  - **새 PC나 사무실에서는 공인 IP가 달라 SSH가 막힌다.** EC2 → 보안 그룹 `flex-api-web` → 인바운드 22번 소스를 새 IP로 바꾼다.
- RDS: `database-flex` (MySQL), DB `flexable`, 앱 계정 `flexable_app`. 퍼블릭 액세스 없음, EC2에서만 접근
- 스키마 변경은 `backend/src/main/resources/db/migration/V{n}__*.sql` 추가(기존 파일 수정 금지)
- 운영 DB 조회: EC2에 `mysql` 클라이언트가 있다. `/opt/flexable/.env`는 값에 `&`가 있어 `source`하면 깨진다 → `grep '^DB_URL=' .env | cut -d= -f2-`처럼 값만 읽고 `mysql --ssl-mode=REQUIRED -h <RDS 호스트> -u flexable_app flexable`로 접속(비밀번호는 `MYSQL_PWD` 환경 변수로).
- 사용자 삭제는 앱의 `AccountDeletionService.deleteAll` 순서를 따른다: transactions → categories → fixed_expenses → fixed_expense_postings → protected_items → budget_settings → users(`transactions`가 `categories`를 연쇄 삭제 없이 참조). `user_identities`(소셜 로그인 연결)는 users 삭제 시 연쇄 삭제된다.

## 6. 미뤄 둔 일

- [ ] 도메인 구매 → 서버 `.env`의 `API_DOMAIN`, `frontend/.env.production`, EAS 환경변수 `EXPO_PUBLIC_API_URL`(preview·production) 변경 → 앱 재빌드 또는 원격 업데이트
- [x] EBS 루트 볼륨 확장(10-20 기준 15GB 확인. 당시 6.7GB, 10-16 배포 전 96%까지 참): AWS 콘솔 → EC2 → 볼륨 → 크기 수정(예: 16GB) 뒤 서버에서 `sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/nvme0n1p1`(10-16 확인: 루트 파티션 p1이 디스크 맨 끝이라 늘릴 수 있다). 재부팅 없이 된다
- [ ] EC2 탄력적 IP 할당(지금은 자동 할당 IP라 인스턴스를 멈추면 바뀜 → DuckDNS 갱신 필요)
- [x] 문의 이메일을 팀 계정으로 교체(10-16): `ucmnuniverse@gmail.com`. 앱은 원격 업데이트, 웹은 머지 후 Vercel 배포로 반영. Play Console 스토어 설명의 "문의:" 줄은 사람이 직접 바꾼다
- [x] API 요청(Codex): `GET /budget/today`에 `weekDaysLeft`·`weekAvailable`·`hasTransactions` 추가, 홈에 "이번 주 쓸 수 있는 돈"과 "아직 기록한 거래가 없어요" 반영(2026-10-13 운영 배포)
- [x] 같은 `Idempotency-Key`로 동시에 들어온 요청은 하나가 500을 받는다(재전송하면 정상): PR #107로 수정(10-22, 머지·운영 배포 전). 진 쪽은 새 트랜잭션에서 먼저 저장된 거래를 200으로 받는다
- [x] RDS 자동 백업 보관 기간이 7일 이하인지 확인(개인정보처리방침에 "최대 7일"이라고 적음). 2026-10-14 보관 기간 7일로 설정, 리전 간 복제 없음, 수동 스냅샷 없음, AWS Backup 미사용 확인
- [ ] 수입 저장·거래 수정 저장 후 빈 화면 → 뒤로가기 시 앱 종료(이슈 #24): PR #23·#25로 수정, `production` 원격 업데이트 게시 완료, 실기기 확인 대기. 원인·재발 방지 규칙·검증 체크리스트는 `docs/bug-transaction-edit-blank-screen.md`
- [x] R8 난독화 켜기(Play가 "가독화 파일 없음" 경고, 10-14 versionCode 5 업로드 시): 1.2.0(#67, versionCode 9)에서 `enableMinifyInReleaseBuilds`로 켰고 AAB에 매핑 파일이 들어 있다. 남은 것은 Play 업로드와 실기기 확인으로, §0-1 P1 6번에서 한다
- [x] 수입일 공휴일 처리: PR #106(10-22, 머지·운영 배포 전). 토·일·공휴일이면 다음 평일. 공휴일 목록 `budget/PublicHolidays.java`는 2026-12-25부터라 지난 주기·시드머니 반영 기록이 바뀌지 않는다 → **12-24까지 배포**하면 바뀌는 사용자가 없다
- [ ] 2027년 6월쯤 우주항공청 2028 월력요항이 나오면 `PublicHolidays.java`에 2028 공휴일을 더한다(임시공휴일은 지정될 때). 목록이 끝나면 토·일만 미룬다
- [x] 캐릭터 홈 단계를 하루 단위 점수로 변경(이슈 #29, PR #30): 처음 쓴 날 광부 0%에서 시작, 예산을 지킨 날 +15·넘긴 날 −50(100점이 한 단계). 날짜별 하루 예산은 `daily_budgets`(V4)에 저장. 규칙은 `docs/API.md` "GET /budget/today"
- [ ] 홈 진행 바에 달리는 캐릭터(1차 피드백, 다음 버전)
- [x] 웹 개발 모드 "Invalid DOM property transform-origin" 경고: `Donut`의 `rotation`·`origin`을 `transform="rotate(-90 cx cy)"`로 바꿔 해결. 이 경고 토스트가 탭 바를 가려 실패하던 E2E도 통과(PR #49)
- [x] 다 쓴 브랜치 정리(10-22): 로컬은 `main`만, 원격은 머지된 브랜치와 닫힌 #78 브랜치를 지우고 `SXXNHU/release-1.0.0-force-update`(§4-2 1.0.0 필수 업데이트)만 남겼다
- [x] 개발 도구 정리: Codex 작업 브랜치 `SXXNHU/feat-service-frontend`는 로컬·원격 모두 없다(10-22 확인)
