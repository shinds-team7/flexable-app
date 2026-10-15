# Flex-able 텅장관리

사회초년생을 위한 생활비 관리 앱 — 잔액·수입일·고정지출과 직접 기록한 거래로
**오늘 쓸 수 있는 돈**을 계산해 보여준다.

신한 DS 금융SW아카데미 7팀

- 웹: https://project2-flex-sh.vercel.app (시연: `/demo`)
- Android: Google Play 비공개 테스트 중

| 디렉토리 | 내용 |
|---|---|
| `frontend/` | Expo(React Native) 앱 — Android / Web ([README](frontend/README.md)) |
| `backend/` | Spring Boot API 서버 — MySQL, EC2 + RDS ([README](backend/README.md)) |
| `docs/` | API 계약, 기능 기준표, 운영 인수인계, Play 제출 자료 |

## 처음 보는 사람이 읽는 순서

1. [`docs/FEATURES.md`](docs/FEATURES.md) — 지금 되는 기능, 시연에만 있는 기능, 아직 없는 기능
2. [`AGENTS.md`](AGENTS.md) — 폴더 구조, 의존 방향, 검증 명령, 작업 규칙 (AI 도구도 이 파일을 읽는다)
3. [`docs/API.md`](docs/API.md) — API와 "오늘 쓸 수 있는 돈" 계산식
4. [`frontend/README.md`](frontend/README.md), [`backend/README.md`](backend/README.md) — 로컬 실행
5. [`docs/HANDOFF.md`](docs/HANDOFF.md) — 배포·출시 현황과 다음 할 일
