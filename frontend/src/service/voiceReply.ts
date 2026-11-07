import { requireOptionalNativeModule } from "expo";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { readStorage, writeStorage } from "./storage";

type SpeechApi = typeof import("expo-speech");

/**
 * AI 음성 답변. 휴대폰(웹은 브라우저)에 내장된 음성 합성으로 읽고, 글자를 서버로 보내지 않는다.
 * 읽는 것은 예정 지출 확인 질문 한 줄뿐이다(scheduleDraft.confirmSpeech).
 * 네이티브 모듈은 1.8.0 빌드부터 있다. 옛 빌드에서는 패키지 JS가 바로 오류를 내므로 모듈을 먼저 확인하고 늦게 불러온다.
 */
function load(): SpeechApi | null {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return null;
    } else if (!requireOptionalNativeModule("ExpoSpeech")) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-speech") as SpeechApi;
  } catch {
    return null;
  }
}

let cached: SpeechApi | null | undefined;
function speech() {
  if (cached === undefined) cached = load();
  return cached;
}

export const VOICE_REPLY_KEY = "chatbot.voiceReply";

export function voiceReplyAvailable() {
  return !!speech();
}

export function speak(text: string) {
  const mod = speech();
  if (!mod) return;
  try {
    void mod.stop();
    mod.speak(text, { language: "ko-KR" });
  } catch {}
}

export function stopSpeaking() {
  try {
    void speech()?.stop();
  } catch {}
}

/**
 * 음성 답변 설정. null이면 아직 묻지 않은 것(AI 메이트에 처음 들어오면 선택 모달을 띄운다).
 * 기기에 저장하고 서버로 보내지 않는다.
 */
export function useVoiceReply() {
  const available = voiceReplyAvailable();
  const [on, setOn] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    readStorage(VOICE_REPLY_KEY)
      .then((v) => {
        if (!alive) return;
        setOn(v === "on" ? true : v === "off" ? false : null);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
      stopSpeaking();
    };
  }, []);
  const set = useCallback((value: boolean) => {
    setOn(value);
    if (!value) stopSpeaking();
    writeStorage(VOICE_REPLY_KEY, value ? "on" : "off").catch(() => {});
  }, []);
  return {
    available,
    /** 아직 고르지 않았으면 선택 모달을 띄운다 */
    needsChoice: available && loaded && on === null,
    on: available && on === true,
    set,
  };
}
