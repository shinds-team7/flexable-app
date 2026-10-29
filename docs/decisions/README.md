# 결정 기록

개발 중 내린 결정 가운데 **다른 파트(앱 화면·앱 서버·웹)에 영향을 주는 것**을 한 파일에 하나씩 남긴다. 작은 결정은 PR 템플릿의 "정책에 없어서 새로 내린 결정" 칸에 적는다.

- 파일 이름: `YYYY-MM-DD-짧은-제목.md`
- 기록을 더하는 PR에는 `spec-change` 라벨과 [CHANGELOG](../CHANGELOG.md) 한 줄이 필요하다. 정책·계약을 함께 바꿔야 하면 같은 PR에서 고친다.
- 2026-10-24까지의 결정은 각 문서에 흩어져 있다. 그 기록은 그대로 두고 새 결정은 여기에 쓴다.
  - 앱·웹 서비스 분리(10-20): [ARCHITECTURE "앱과 웹사이트"](../ARCHITECTURE.md#앱과-웹사이트), 웹 [decisions.md](https://github.com/shinds-team7/flexable-web/blob/main/docs/product/decisions.md)
  - 옛 시연 주소 redirect 유지: [FEATURES "호환 경로 결정 기록"](../FEATURES.md#호환-경로-결정-기록)
  - 배포·출시·운영 결정: [HANDOFF](../HANDOFF.md)

양식:

```markdown
# 제목

- 날짜: YYYY-MM-DD · 결정한 사람: · 관련: Issue #, PR #
- 영향: 앱 화면 / 앱 서버 / 웹

## 결정
## 이유
## 바뀌는 것(문서·코드·설정)
```

| 날짜 | 결정 |
|---|---|
| 2026-10-25 | [작업 방식: 저장소 기준본·Issue 단위·spec-change 절차](2026-10-25-dev-process.md) |
| 2026-10-27 | [웹에서 고친 시드머니를 앱에 반영(모아둔 돈을 맞춤)](2026-10-27-web-seed-money-write.md) |
| 2026-10-27 | [요일별 생활비 배분: 요일 비중으로 하루 예산을 나눈다](2026-10-27-day-weights.md) |

| 2026-10-29 | [신한카드 결제 알림 자동 기록](2026-10-29-shinhan-notification-import.md) |
