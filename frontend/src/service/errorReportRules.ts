// 오류 기록(POST /client-errors)에 무엇을 보낼지 정하는 규칙. 외부 모듈을 쓰지 않아 test/error-report.test.cjs가 바로 돌린다.
// 결정: docs/decisions/2026-11-07-error-events.md

/** 사용자가 고칠 수 있거나 화면이 이미 안내하는, 예상된 서버 응답. 기록하지 않는다. */
export const EXPECTED_CODES = new Set([
  "UNAUTHORIZED",
  "INVALID_CREDENTIALS",
  "SOCIAL_ACCOUNT",
  "OAUTH_CODE_INVALID",
  "EMAIL_UNAVAILABLE",
  "CATEGORY_DUPLICATE",
  "CATEGORY_DEFAULT",
  "SEED_NOT_PENDING",
  "OUTFIT_OWNED",
  "OUTFIT_LOCKED",
  "COINS_NOT_ENOUGH",
  "REFERRAL_CODE_INVALID",
  "REFERRAL_ALREADY",
  "LINK_CODE_INVALID",
  "LINK_NOT_FOUND",
  "TOO_MANY_ATTEMPTS",
  "AD_NOT_REWARDED",
  "BUDGET_NOT_SET",
  "CHAT_UNAVAILABLE",
]);

/** 한 번 앱을 켠 동안 보내는 최대 건수(같은 오류는 한 번만) */
export const SESSION_LIMIT = 20;

/**
 * API 실패를 기록할지. 연결 끊김(응답 없음)은 흔하고 고칠 게 없어 보내지 않는다.
 * 다만 연결된 채 답이 늦어 앱이 끊은 경우(TIMEOUT, status 0)는 서버나 AI 쪽이 느린 신호라 기록한다.
 */
export function shouldReportApi(status: number, code: string | undefined) {
  if (code === "TIMEOUT") return true;
  if (status < 400) return false;
  if (status === 401) return false;
  return !code || !EXPECTED_CODES.has(code);
}

/** 같은 실행 안에서 같은 오류인지 */
export function reportKey(r: {
  kind: string;
  status?: number;
  code?: string;
  method?: string;
  path?: string;
  message: string;
}) {
  return [r.kind, r.status, r.code, r.method, r.path?.split("?")[0], r.message]
    .map((v) => v ?? "")
    .join("|");
}

/** API 경로에서 쿼리를 뺀다(날짜·검색어가 들어갈 수 있다). 숫자 id는 서버가 묶는다. */
export function cleanPath(path: string) {
  return path.split("?")[0].slice(0, 300);
}

export function cut(text: string | undefined, max: number) {
  if (!text) return undefined;
  return text.length <= max ? text : text.slice(0, max);
}
