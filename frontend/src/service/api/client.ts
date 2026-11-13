export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public retryAfterSeconds?: number,
    /** SOCIAL_ACCOUNT: 이 이메일 계정에 붙은 로그인 방법(kakao·google) */
    public provider?: string,
  ) {
    super(message);
  }
}
let token: string | null = null;
let unauthorized: (() => Promise<void>) | undefined;
// Bumped on every login/logout so a late response from an earlier session cannot touch the current one.
let generation = 0;
export function setApiSession(
  value: string | null,
  expired?: () => Promise<void>,
) {
  token = value;
  unauthorized = expired;
  generation++;
}
export function sessionGeneration() {
  return generation;
}
/** 오류 기록(errorReport.ts)이 회원 번호를 남기려고 쓴다 */
export function currentToken() {
  return token;
}
export type ApiFailure = {
  path: string;
  method: string;
  status: number;
  code?: string;
  message: string;
};
let failureListener: ((f: ApiFailure) => void) | undefined;
/** 서버가 오류로 답한 요청을 알린다(오류 기록용). 본문은 넘기지 않는다. */
export function setApiErrorListener(listener: (f: ApiFailure) => void) {
  failureListener = listener;
}
/** Full URL of an API path, e.g. for opening the social login start page in a browser. */
export function apiUrl(path: string) {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base)
    throw new ApiError(
      "CONFIGURATION",
      "연결 주소를 확인할 수 없어요. 고객지원에 문의해 주세요",
    );
  return `${base.replace(/\/$/, "")}/api/v1${path}`;
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    token?: string | null;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const url = apiUrl(path);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  try {
    const auth = options.token === undefined ? token : options.token;
    const started = generation;
    // 파일 업로드(FormData)는 fetch가 multipart 경계를 붙이도록 Content-Type을 비워 둔다.
    const form =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(form ? {} : { "Content-Type": "application/json" }),
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : form
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: controller.signal,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json();
    if (!res.ok) {
      try {
        failureListener?.({
          path,
          method: options.method ?? "GET",
          status: res.status,
          code: data.code,
          message: data.message ?? "",
        });
      } catch {}
      if (
        data.code === "UNAUTHORIZED" &&
        options.token === undefined &&
        started === generation
      )
        await unauthorized?.();
      throw new ApiError(
        data.code ?? "INTERNAL_ERROR",
        data.message ?? "잠시 후 다시 시도해 주세요",
        data.fields,
        data.retryAfterSeconds,
        data.provider,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // 연결은 됐지만 답이 늦은 경우(예: AI 메이트)는 연결 문제로 안내하지 않는다.
    if (timedOut) {
      try {
        failureListener?.({
          path,
          method: options.method ?? "GET",
          status: 0,
          code: "TIMEOUT",
          message: `응답 없음 ${options.timeoutMs ?? 15000}ms`,
        });
      } catch {}
      throw new ApiError(
        "TIMEOUT",
        "응답이 늦어지고 있어요. 입력한 내용은 그대로 있어요. 잠시 뒤 다시 시도해 주세요",
      );
    }
    throw new ApiError(
      "NETWORK",
      "연결이 불안정해요. 입력한 내용은 그대로 있어요. 연결 후 다시 시도해 주세요",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
export function errorText(e: unknown, deletion = false) {
  if (!(e instanceof ApiError)) return "문제가 생겼어요. 다시 시도해 주세요";
  if (e.code === "INVALID_CREDENTIALS")
    return deletion
      ? "비밀번호가 맞지 않아요. 다시 확인해 주세요"
      : "이메일 또는 비밀번호가 맞지 않아요";
  if (e.code === "EMAIL_UNAVAILABLE")
    return "이 이메일로 가입할 수 없어요. 로그인하거나 비밀번호를 찾아보세요";
  if (e.code === "TOO_MANY_ATTEMPTS")
    return `잠시 후 다시 시도해 주세요${e.retryAfterSeconds ? ` (${e.retryAfterSeconds}초 후)` : ""}`;
  if (e.code === "INTERNAL_ERROR")
    return deletion
      ? "삭제하지 못했어요. 잠시 후 다시 시도해 주세요"
      : "불러오지 못했어요. 잠시 후 다시 시도해 주세요";
  return e.message;
}
