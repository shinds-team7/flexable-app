import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { router } from "expo-router";
import { Linking } from "react-native";
import { api, ApiError, sessionGeneration, setApiSession } from "./api/client";
import { readStorage, writeStorage } from "./storage";
import type { AuthResponse, User } from "./types";
import { useToast } from "@/components/Toast";
import { cancelEntryReminder } from "./entryReminder";
import { clearInbox } from "./inboxStore";
import { cancelSeedReminder } from "./seedReminder";
const KEY = "flexable.service.token";
/** True when the app or page was opened on /oauth/callback (web: the current address). */
async function opensOnOAuthCallback() {
  try {
    const url = await Promise.race([
      Linking.getInitialURL(),
      // getInitialURL can stay pending in some environments; don't hold up the restore for it.
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    return !!url && url.split(/[?#]/)[0].endsWith("/oauth/callback");
  } catch {
    return false;
  }
}
type Session = {
  user: User | null;
  ready: boolean;
  error: unknown;
  revision: number;
  accept: (auth: AuthResponse) => Promise<void>;
  clear: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retry: () => void;
  invalidate: () => void;
};
const Ctx = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>();
  const [revision, bump] = useState(0);
  const [attempt, retryAttempt] = useState(0);
  const toast = useToast();
  const userId = useRef<number | null>(null);
  const clear = useCallback(async () => {
    setApiSession(null);
    setUser(null);
    setError(undefined);
    bump((x) => x + 1);
    const id = userId.current;
    userId.current = null;
    await writeStorage(KEY, null);
    if (id !== null) await writeStorage(`flexable.service.draft.${id}`, null);
    // 로그아웃·탈퇴한 기기에 다음 수입일 알림·기록 알림이 남지 않게 한다.
    await cancelSeedReminder().catch(() => {});
    await cancelEntryReminder();
    if (id !== null) await clearInbox(id).catch(() => {});
  }, []);
  const expired = useCallback(async () => {
    await clear();
    router.replace("/");
    toast("다시 로그인해 주세요");
  }, [clear, toast]);
  const refreshUser = useCallback(async () => {
    const started = sessionGeneration();
    const value = await api<User>("/me");
    if (started !== sessionGeneration()) return;
    userId.current = value.id;
    setUser(value);
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      // A login or logout that finishes while restoring owns the session; drop the restore result.
      let started = sessionGeneration();
      const current = () => alive && started === sessionGeneration();
      try {
        const saved = await readStorage(KEY);
        if (!current()) return;
        // Opened on the social login callback (app launched by the link, or web first load): an
        // expired saved token is only dropped, so the callback screen stays and finishes the login.
        const quiet = !!saved && (await opensOnOAuthCallback());
        if (!current()) return;
        setApiSession(saved, quiet ? clear : expired);
        started = sessionGeneration();
        if (saved) {
          const value = await api<User>("/me");
          if (current()) {
            userId.current = value.id;
            setUser(value);
            // The quiet handling covers only this first check; later expiry behaves as usual.
            if (quiet) {
              setApiSession(saved, expired);
              started = sessionGeneration();
            }
          }
        }
      } catch (e) {
        if (current() && !(e instanceof ApiError && e.code === "UNAUTHORIZED"))
          setError(e);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [clear, expired, attempt]);
  const accept = async (auth: AuthResponse) => {
    await writeStorage(KEY, auth.accessToken);
    setApiSession(auth.accessToken, expired);
    userId.current = auth.user.id;
    setUser(auth.user);
    setError(undefined);
    bump((x) => x + 1);
  };
  return (
    <Ctx.Provider
      value={{
        user,
        ready,
        error,
        revision,
        accept,
        clear,
        refreshUser,
        retry: () => {
          setReady(false);
          setError(undefined);
          retryAttempt((x) => x + 1);
        },
        invalidate: () => bump((x) => x + 1),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
