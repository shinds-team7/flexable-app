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
import { api, ApiError, setApiSession } from "./api/client";
import { readStorage, writeStorage } from "./storage";
import type { AuthResponse, User } from "./types";
import { useToast } from "@/components/Toast";
const KEY = "flexable.service.token";
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
  }, []);
  const expired = useCallback(async () => {
    await clear();
    router.replace("/");
    toast("다시 로그인해 주세요");
  }, [clear, toast]);
  const refreshUser = useCallback(async () => {
    const value = await api<User>("/me");
    userId.current = value.id;
    setUser(value);
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await readStorage(KEY);
        setApiSession(saved, expired);
        if (saved) {
          const value = await api<User>("/me");
          if (alive) {
            userId.current = value.id;
            setUser(value);
          }
        }
      } catch (e) {
        if (alive && !(e instanceof ApiError && e.code === "UNAUTHORIZED"))
          setError(e);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [expired, attempt]);
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
