# 정책 공통 테스트 케이스

[`docs/policies.md`](../../docs/policies.md)의 입력→기대값 예시 표를 그대로 옮긴 JSON이다. 백엔드 테스트가 이 파일을 읽어 코드와 맞는지 확인한다.

| 파일 | 정책 | 읽는 테스트 |
|---|---|---|
| `budget.json` | §1 수입일·정산 주기(`payday`), §2 오늘 쓸 수 있는 돈(`today`) | `backend/src/test/.../budget/BudgetPolicyTest` |
| `seed-money.json` | §3 시드머니 반영(API로 검사, 시계 고정) | `backend/src/test/.../budget/SeedMoneyPolicyTest` |
| `character.json` | §4 캐릭터 점수 | `backend/src/test/.../budget/CharacterPolicyTest` |

- 정책을 바꾸면 `policies.md` 표와 이 JSON을 같은 PR에서 고치고 `spec-change` 라벨과 CHANGELOG 한 줄을 붙인다(CODEOWNERS 리뷰).
- 실행: `cd backend && ./gradlew test --tests "*PolicyTest"`(CI의 `./gradlew test`에 포함). 테스트는 `backend/` 기준 `../tests/policy/`를 읽는다. 시각(`at`, `balanceAt`)은 `Asia/Seoul` 현지 시각이다.
