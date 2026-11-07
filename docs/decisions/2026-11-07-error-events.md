# 오류 기록: 운영 DB 테이블 `error_events`

- 날짜: 2026-11-07 · 결정한 사람: SXXNHU(채팅에서 ① 테이블 방식 선택) · 상태: **승인, 구현**
- 영향: 앱 서버(V23 `error_events`, `POST /client-errors`, 서버 500 기록, 매일 30일 지난 기록 삭제), 앱 화면(오류 보고, 1.9.0 빌드부터), API 계약, 개인정보처리방침 추가 개정(4), Play 데이터 보안
- 바뀌는 기준 문서: `contracts/app-api.yaml`, `play-store/privacy-policy.md`·`README.md` §3.6, `API.md`, `FEATURES.md`

## 배경

11-07 신한카드 자동 기록이 서버의 400("요청 키가 너무 길어요")로 한 건도 저장되지 않았는데, 사용자가 화면에서 보고 알려 주기 전까지 아무도 몰랐다. 서버는 처리 못 한 500만 로그 파일(50MB 순환)에 남기고, 앱 쪽 오류는 어디에도 남지 않았다.

## 검토한 방법

| 방법 | 판단 |
|---|---|
| ① 운영 MySQL에 테이블 | **채택.** 비용 0, 데이터가 우리 서버에만 있음, 새 외부 업체·국외 이전 없음, 이번 같은 400도 잡힘 |
| ② Sentry 무료 | 기능은 가장 좋지만 네이티브 SDK·소스맵 설정·국외 이전 개정이 필요. 필요해지면 나중에 붙인다 |
| ③ Firebase Crashlytics | Firebase 설정·새 빌드, JS 오류는 직접 보내야 함 |
| ④ Play Console Android vitals | 이미 무료로 볼 수 있지만 네이티브 크래시·ANR만 보이고 서버 거절은 안 보임 |

## 결정

1. **테이블** `error_events`(V23): 날짜(`event_day`, KST)·`fingerprint`(출처·종류·상태·코드·메서드·경로·가린 메시지·스택 첫 3줄의 SHA-256) 유니크. 같은 날 같은 오류는 한 줄로 묶고 `occurrences`만 올린다. 마지막으로 겪은 회원·앱 버전·업데이트 id를 남긴다. 하루 새 줄은 500개까지.
2. **가리기**: 서버가 저장 전에 3자리 이상 숫자(쉼표·점 포함)와 이메일을 가린다. 경로는 쿼리를 버리고 숫자·긴 id 조각을 `{id}`로 묶는다. 요청·응답 본문은 받지 않는다.
3. **앱 보고** `POST /api/v1/client-errors`(로그인 없이도 받음, 토큰이 맞으면 회원 번호, 항상 204):
   - API 실패: 401과 사용자가 고칠 수 있는 예상 코드(`COINS_NOT_ENOUGH`, `TOO_MANY_ATTEMPTS`, `AD_NOT_REWARDED`, `EMAIL_UNAVAILABLE` 등, `errorReportRules.ts`)를 뺀 모든 4xx·5xx. 연결 끊김은 보내지 않는다.
   - 화면 오류(`CrashScreen`), 처리 못 한 JS 오류(Android 전역 핸들러, 웹 `error`·`unhandledrejection`)
   - 한 번 실행에 20건, 같은 오류는 한 번만. 서버는 보낸 사람마다 10분에 30건까지만 저장한다(넘어도 204).
4. **서버 500**은 `GlobalExceptionHandler`가 같은 테이블에 남긴다(로그 파일 기록은 그대로).
5. **보관**: 매일 04:30(KST) 30일 지난 줄 삭제. 계정 삭제 때 그 회원 줄 삭제.
6. **보는 방법**: 지금은 서버 DB에서 SQL로 본다(예: `select event_day, source, kind, status, code, path, message, occurrences from error_events order by last_at desc limit 50`). 화면·알림은 필요해지면 만든다.
7. **개인정보처리방침 추가 개정(4)**: 11-07 공고, **11-14 시행**(출시 뒤라 14장대로 7일 전 공고). 앱 쪽은 main 1.9.0 빌드부터라 그 전에는 나가지 않는다.

## 확인이 남은 것(사람)

- 서버 배포(V23 마이그레이션). 배포 직전 DB 백업.
- 1.9.0 빌드 업로드 때 Play 데이터 보안 양식에 "진단" 행 추가(`play-store/README.md` §3.6).
- 1.9.0 프로덕션 출시는 방침 시행일(11-14) 이후로 하거나 시행일을 정리한다.
