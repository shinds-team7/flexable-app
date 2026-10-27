# 웹에서 고친 시드머니를 앱에 반영

- 날짜: 2026-10-27 · 결정한 사람: 리드(SXXNHU) · 관련: Issue #187, 웹 shinds-team7/flexable-web#83
- 영향: 앱 서버 / 웹

## 결정

- 웹사이트 홈 [수정하기]로 연동 회원이 시드머니 총액을 고치면, 웹 서버가 `PUT /internal/v1/web-links/{linkId}/seed-money` `{total}`을 부른다.
- 앱은 **모아둔 돈(seedBase) = 총액 − 반영한 돈 합**으로 바꾼다. 주기별 반영 기록과 예산 계산(추정 잔액·오늘 쓸 수 있는 돈)은 바꾸지 않는다. 설정의 `updatedAt`을 저장 시각으로 바꾼다.
- 총액이 반영한 돈 합보다 작으면 모아둔 돈이 음수가 되므로 400 `VALIDATION_FAILED`(`fields.total`)로 거절한다.
- 앱 반영에 실패하면 웹은 웹에만 저장하고 화면에 알린다. 성공하면 웹은 직접 수정값을 지우고 앱 값을 따른다(웹 쪽 결정, 웹 저장소 기록).

## 이유

- 앱 시드머니는 모아둔 돈 + 반영 기록의 합이라, 반영 기록을 건드리지 않고 맞출 수 있는 값은 모아둔 돈뿐이다. 반영 기록에 조정 건을 넣으면 "주기당 한 번" 규칙과 음수 기록이 생긴다.
- 금액 검증·계산은 앱 서버가 한다(웹은 앱 값을 다시 계산하지 않는다).

## 바뀌는 것(문서·코드·설정)

- `docs/contracts/web-link-api.yaml` PUT 추가, `docs/API.md` "웹사이트 연동", `docs/policies.md` §3, `docs/FEATURES.md` 웹사이트 연동 행
- `budget.SeedMoneyService.setTotalFromWeb`, `weblink.InternalWebLinkController`
- 개인정보처리방침 §4(웹사이트 연동 목적)에 "웹사이트에서 고친 시드머니 반영"을 더할지는 리드가 정한다(이 PR에서는 바꾸지 않음)
