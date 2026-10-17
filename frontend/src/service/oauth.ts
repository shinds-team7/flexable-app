// 카카오·Google 로그인 (계약: 앱이 verifier를 만들고, 서버가 준 1회용 code를 verifier와 함께 교환한다)
import { requireOptionalNativeModule } from "expo";
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytesAsync,
} from "expo-crypto";
import type * as WebBrowserModule from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { api, ApiError, apiUrl, errorText } from "./api/client";
import { readStorage, writeStorage } from "./storage";
import type { AuthResponse, User } from "./types";

export type OAuthProvider = "kakao" | "google";
export const PROVIDER_NAME: Record<OAuthProvider, string> = {
  kakao: "카카오",
  google: "Google",
};

export const OAUTH_FAILED = "로그인하지 못했어요. 다시 시도해 주세요";
export const OAUTH_UNAVAILABLE = "지금은 이 로그인 방법을 쓸 수 없어요";
const MESSAGES: Record<string, string> = {
  cancelled: "로그인을 취소했어요",
  provider_unavailable: OAUTH_UNAVAILABLE,
  email_in_use:
    "이미 가입된 이메일이에요. 처음 가입한 방법으로 로그인해 주세요",
};

const VERIFIER_KEY = "flexable.service.oauth.verifier";
const NATIVE_REDIRECT_URI = "flexable://oauth/callback";

// Web keeps the verifier per tab (sessionStorage survives the full-page trip to the provider and back),
// so attempts in two tabs cannot overwrite each other. The app keeps it in SecureStore: a new build
// holds the start button until the login browser closes, so attempts cannot overlap. Only the
// Linking fallback of an old 1.0.0 binary can start a second attempt that replaces the first verifier.
async function readVerifier() {
  if (Platform.OS !== "web") return readStorage(VERIFIER_KEY);
  try {
    return sessionStorage.getItem(VERIFIER_KEY);
  } catch {
    return null;
  }
}
async function writeVerifier(value: string | null) {
  if (Platform.OS !== "web") return writeStorage(VERIFIER_KEY, value);
  if (value === null) sessionStorage.removeItem(VERIFIER_KEY);
  else sessionStorage.setItem(VERIFIER_KEY, value);
}

function redirectUri() {
  return Platform.OS === "web"
    ? `${window.location.origin}/oauth/callback`
    : NATIVE_REDIRECT_URI;
}

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** base64url without padding (32 bytes -> 43 characters). */
function base64url(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const rest = bytes.length - i;
    const n =
      (bytes[i] << 16) |
      ((rest > 1 ? bytes[i + 1] : 0) << 8) |
      (rest > 2 ? bytes[i + 2] : 0);
    const chars = Math.min(4, Math.ceil((rest * 8) / 6));
    for (let j = 0; j < chars; j++) out += ALPHABET[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

async function verifierPair() {
  const verifier = base64url(await getRandomBytesAsync(32));
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: CryptoEncoding.BASE64 },
  );
  const challenge = digest
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { verifier, challenge };
}

/**
 * False only when the server says no: the provider is not in its list, or the server is older than
 * social login (401/404 instead of a list). Connection problems, 5xx and unreadable answers throw,
 * so the start page reports them instead of opening a browser.
 */
async function providerAvailable(provider: OAuthProvider) {
  let data: { providers?: unknown };
  try {
    data = await api<{ providers?: unknown }>("/auth/oauth/providers", {
      token: null,
    });
  } catch (e) {
    if (
      e instanceof ApiError &&
      (e.code === "UNAUTHORIZED" || e.code === "NOT_FOUND")
    )
      return false;
    throw e;
  }
  if (!Array.isArray(data?.providers))
    throw new ApiError("INTERNAL_ERROR", "잠시 후 다시 시도해 주세요");
  return data.providers.includes(provider);
}

type WebBrowser = typeof WebBrowserModule;
/**
 * expo-web-browser first ships in app 1.1.0. Its JS throws at load time when the native part is
 * missing, so an older binary that somehow runs this code must never load it: check the native
 * module first, require lazily, and fall back to the system browser.
 */
function nativeBrowser(): WebBrowser | null {
  if (Platform.OS === "web") return null;
  try {
    if (!requireOptionalNativeModule("ExpoWebBrowser")) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-web-browser") as WebBrowser;
  } catch {
    return null;
  }
}

export type CallbackParams = { code?: string; error?: string };
function callbackParams(url: string): CallbackParams {
  const out: CallbackParams = {};
  const query = url.split("#")[0].split("?")[1] ?? "";
  for (const part of query.split("&")) {
    const [key, value = ""] = part.split("=");
    if (key !== "code" && key !== "error") continue;
    try {
      out[key] = decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export type StartResult =
  /** 서버에서 이 로그인 방법이 꺼져 있음 */
  | { type: "unavailable" }
  /** 웹: 페이지가 로그인 화면으로 넘어가는 중 */
  | { type: "leaving" }
  /** 앱: 브라우저가 닫혔거나 넘겨줬음. 결과는 /oauth/callback 딥링크가 처리 */
  | { type: "returned" }
  /** 앱(iOS): 브라우저가 돌려준 주소를 콜백 화면에 넘겨야 함 */
  | { type: "redirect"; params: CallbackParams };

// One attempt at a time, even if two start screens exist (e.g. after "처음으로"). Taken before the
// first await and released only by the attempt that took it.
let attemptOpen = false;

/**
 * Resolves only after the login browser has closed (app) or the page starts leaving (web), so the
 * caller can keep its buttons locked for the whole attempt.
 */
export async function startOAuth(provider: OAuthProvider): Promise<StartResult> {
  if (attemptOpen) return { type: "returned" };
  attemptOpen = true;
  try {
    if (!(await providerAvailable(provider))) return { type: "unavailable" };
    const { verifier, challenge } = await verifierPair();
    const back = redirectUri();
    const url = apiUrl(
      `/auth/oauth/${provider}/start?redirectUri=${encodeURIComponent(back)}&codeChallenge=${challenge}`,
    );
    await writeVerifier(verifier);
    if (Platform.OS === "web") {
      window.location.assign(url);
      return { type: "leaving" };
    }
    const browser = nativeBrowser();
    if (!browser) {
      // Old 1.0.0 binary: returns at once, so a second attempt can replace this verifier (see above).
      await Linking.openURL(url);
      return { type: "returned" };
    }
    const result = await browser.openAuthSessionAsync(url, back);
    // Android only reports success when the app receives the redirect link, and Expo Router already
    // opens /oauth/callback from that same link. Navigating here as well would stack a second screen.
    if (result.type !== "success" || Platform.OS === "android")
      return { type: "returned" };
    return { type: "redirect", params: callbackParams(result.url) };
  } finally {
    attemptOpen = false;
  }
}

/** Message for a failure before the browser opened, in the app's usual wording for that error. */
export function startErrorText(e: unknown) {
  if (!(e instanceof ApiError))
    return "로그인 화면을 열지 못했어요. 다시 시도해 주세요";
  if (e.code === "NETWORK")
    return "연결이 불안정해요. 연결 후 다시 시도해 주세요";
  return errorText(e);
}

type Attempt = { exchange: Promise<AuthResponse>; login?: Promise<User> };
const attempts = new Map<string, Attempt>();

/**
 * A one-time code is exchanged once (on a phone both the browser result and the deep link can
 * deliver it, and web dev mode runs effects twice), and the session is switched at most once.
 * The first caller that still wants the result when the answer arrives signs in; callers that left
 * the screen, or saw another login or logout meanwhile, do not. Resolves null when nobody signed in
 * for this caller and no one else did either.
 */
export async function completeOAuth(
  code: string,
  accept: (auth: AuthResponse) => Promise<void>,
  stillWanted: () => boolean,
): Promise<User | null> {
  let attempt = attempts.get(code);
  if (!attempt) {
    attempt = { exchange: exchange(code) };
    attempts.set(code, attempt);
  }
  const auth = await attempt.exchange;
  if (!attempt.login) {
    if (!stillWanted()) return null;
    attempt.login = accept(auth).then(() => auth.user);
  }
  return attempt.login;
}

async function exchange(code: string) {
  const codeVerifier = await readVerifier();
  // Started in another tab, browser or device: this code cannot be ours.
  if (!codeVerifier) throw new ApiError("OAUTH_CODE_INVALID", OAUTH_FAILED);
  const auth = await api<AuthResponse>("/auth/oauth/exchange", {
    method: "POST",
    token: null,
    body: { code, codeVerifier },
  });
  // A late answer for an earlier attempt must not remove the verifier of a newer one.
  const stored = await readVerifier().catch(() => null);
  if (stored === codeVerifier) await writeVerifier(null).catch(() => {});
  return auth;
}

/** The provider or server ended the attempt without a code; the verifier is no longer useful. */
export function oauthErrorText(error: unknown) {
  if (typeof error === "string") return MESSAGES[error] ?? OAUTH_FAILED;
  if (error instanceof ApiError) {
    if (error.code === "NETWORK")
      return "연결이 불안정해요. 연결 후 다시 시도해 주세요";
    if (error.code === "TOO_MANY_ATTEMPTS" || error.code === "CONFIGURATION")
      return error.message;
  }
  return OAUTH_FAILED;
}
