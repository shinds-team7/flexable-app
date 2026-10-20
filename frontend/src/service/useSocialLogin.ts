// 카카오·Google 로그인 버튼의 동작. 시작 화면과 이메일 로그인 화면(소셜 계정 안내)이 같이 쓴다.
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useToast } from "@/components/Toast";
import {
  OAUTH_UNAVAILABLE,
  startErrorText,
  startOAuth,
  type OAuthProvider,
} from "./oauth";

export function useSocialLogin() {
  const toast = useToast();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const lock = useRef(false);
  // Web: coming back from the login page with the browser's back button can restore this page as it was left.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const reset = () => {
      lock.current = false;
      setBusy(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const start = async (provider: OAuthProvider) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(provider);
    // In the app this waits until the login browser closes, so the buttons stay locked meanwhile.
    let failure: unknown = null;
    const result = await startOAuth(provider).catch((e: unknown) => {
      failure = e;
      return null;
    });
    // Web: the page is moving to the login page; pageshow resets this if the user comes back.
    if (result?.type === "leaving") return;
    // Release before any navigation (docs/bug-transaction-edit-blank-screen.md rule 2).
    lock.current = false;
    setBusy(null);
    if (!result) toast(startErrorText(failure));
    else if (result.type === "unavailable") toast(OAUTH_UNAVAILABLE);
    else if (result.type === "redirect")
      router.push({ pathname: "/oauth/callback", params: result.params });
  };
  return { busy, start };
}
