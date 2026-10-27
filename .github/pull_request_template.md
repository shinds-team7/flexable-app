## #️⃣ Issue

<!-- 이 PR이 처리하는 Issue. 예) Closes #12. 긴급 수정으로 Issue가 없으면 no-issue 라벨과 사유를 적어 주세요. -->
Closes #

## 📝 변경 내용

<!-- 무엇을 왜 바꿨는지. 어떻게보다 무엇·왜. -->

## 📚 참고한 문서

<!-- AI·사람이 기준으로 삼은 저장소 문서. 경로와 절을 적어 주세요. -->
- [ ] docs/FEATURES.md (행: )
- [ ] API 계약·계산식 docs/API.md (절: )
- [ ] docs/decisions/ (파일: )

## 🧩 영향받는 파트

- [ ] 앱 화면(`frontend/`) — 반영: 웹은 머지 시 자동, 앱은 원격 업데이트 또는 새 빌드
- [ ] 앱 서버(`backend/`) — 반영: `deploy.sh`, DB 마이그레이션 여부:
- [ ] 웹(flexable-web) 연동(`/internal/v1/web-links/*`) — 웹 저장소에 알림
- [ ] 문서·계약·정책·지침(→ `spec-change` 라벨 + `docs/CHANGELOG.md` 한 줄)
- [ ] `docs/HANDOFF.md` "코드에는 있지만 운영에 아직 없는 것"에 이 PR 한 줄 추가(반영 방법·배포 순서)

## 🧭 정책에 없어서 새로 내린 결정

<!-- 없으면 "없음". 다른 파트에 영향을 주면 docs/decisions/에도 기록해 주세요. -->

## ✅ 검증 결과

<!-- 돌린 명령과 결과를 그대로. 실기기·배포 확인은 코드 검증과 따로, 확인하지 못한 것도 적어 주세요. -->
- [ ] `npx tsc --noEmit` · `npx expo lint` · `npm run test:unit`
- [ ] `npx playwright test`(또는 CI E2E)
- [ ] `(cd backend && ./gradlew test)`

## 📸 스크린샷 (선택)
