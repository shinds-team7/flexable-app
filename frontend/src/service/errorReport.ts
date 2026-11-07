// 앱이 겪은 오류를 서버 오류 기록(POST /client-errors)에 보낸다. 결과를 기다리지 않고, 실패해도 앱 동작에 영향을 주지 않는다.
// 보내는 것: 오류 종류·메시지·스택(앱 코드 위치), 화면 경로, API 경로(쿼리 제외)·상태·코드, 앱 버전·원격 업데이트 id·플랫폼.
// 보내지 않는 것: 요청·응답 본문(거래 제목·메모·금액 입력값). 숫자·이메일은 서버가 저장 전에 한 번 더 가린다.
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import {
  ApiError,
  apiUrl,
  currentToken,
  setApiErrorListener,
} from "./api/client";
import { APP_VERSION } from "./config";
import {
  cleanPath,
  cut,
  reportKey,
  SESSION_LIMIT,
  shouldReportApi,
} from "./errorReportRules";

type Kind = "API" | "CRASH" | "JS";
type Report = {
  kind: Kind;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  status?: number;
  code?: string;
};

let screen: string | undefined;
let sent = 0;
const seen = new Set<string>();

/** 지금 화면 경로(루트 레이아웃이 바꿀 때마다 알린다) */
export function setErrorScreen(path: string) {
  screen = path.slice(0, 100);
}

function updateId() {
  try {
    return Updates.updateId ?? undefined;
  } catch {
    return undefined;
  }
}

async function post(body: object, withToken: boolean) {
  const token = withToken ? currentToken() : null;
  return fetch(apiUrl("/client-errors"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function reportError(r: Report) {
  const message = cut(r.message?.trim() || "(메시지 없음)", 2000)!;
  const key = reportKey({ ...r, message });
  if (seen.has(key) || sent >= SESSION_LIMIT) return;
  seen.add(key);
  sent++;
  const body = {
    kind: r.kind,
    message,
    stack: cut(r.stack, 8000),
    screen,
    method: r.method,
    path: r.path ? cleanPath(r.path) : undefined,
    status: r.status,
    code: cut(r.code, 40),
    appVersion: cut(APP_VERSION, 20),
    updateId: cut(updateId(), 64),
    platform:
      Platform.OS === "android" ||
      Platform.OS === "ios" ||
      Platform.OS === "web"
        ? Platform.OS
        : undefined,
  };
  void (async () => {
    try {
      const res = await post(body, true);
      // 토큰이 만료됐으면 회원 번호 없이 한 번 더 보낸다
      if (res.status === 401) await post(body, false);
    } catch {
      // 오류 기록이 실패해도 아무것도 하지 않는다
    }
  })();
}

/** 화면이 죽었을 때(CrashScreen) */
export function reportCrash(error: Error) {
  reportError({
    kind: "CRASH",
    message: `${error.name}: ${error.message}`,
    stack: error.stack,
  });
}

let installed = false;

/** 앱 시작 때 한 번. API 실패와 처리하지 못한 JS 오류를 기록한다. */
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  setApiErrorListener((e) => {
    if (e.path.startsWith("/client-errors")) return;
    if (!shouldReportApi(e.status, e.code)) return;
    reportError({
      kind: "API",
      message: e.message,
      method: e.method,
      path: `/api/v1${e.path}`,
      status: e.status,
      code: e.code,
    });
  });
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: unknown, fatal?: boolean) => void;
      setGlobalHandler: (h: (error: unknown, fatal?: boolean) => void) => void;
    };
    addEventListener?: (type: string, fn: (e: unknown) => void) => void;
  };
  if (Platform.OS !== "web" && g.ErrorUtils) {
    const previous = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((error, fatal) => {
      const err = error instanceof Error ? error : new Error(String(error));
      reportError({
        kind: "JS",
        message: `${fatal ? "[fatal] " : ""}${err.name}: ${err.message}`,
        stack: err.stack,
      });
      previous(error, fatal);
    });
  } else if (
    Platform.OS === "web" &&
    typeof g.addEventListener === "function"
  ) {
    g.addEventListener("error", (e) => {
      const ev = e as { error?: unknown; message?: string };
      const err = ev.error instanceof Error ? ev.error : undefined;
      reportError({
        kind: "JS",
        message: err
          ? `${err.name}: ${err.message}`
          : (ev.message ?? "Script error"),
        stack: err?.stack,
      });
    });
    g.addEventListener("unhandledrejection", (e) => {
      const reason = (e as { reason?: unknown }).reason;
      // 서버 응답 실패(ApiError)는 위 API 기록이 따로 남긴다
      if (reason instanceof ApiError) return;
      const err = reason instanceof Error ? reason : new Error(String(reason));
      reportError({
        kind: "JS",
        message: `Unhandled promise: ${err.name}: ${err.message}`,
        stack: err.stack,
      });
    });
  }
}
