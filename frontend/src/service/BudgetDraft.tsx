import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api/client";
import { useSession } from "./Session";
import { readStorage, writeStorage } from "./storage";
import type { BudgetSettings } from "./types";
const initial = (): BudgetSettings => ({
  balance: 0,
  balanceAt: new Date().toISOString(),
  payday: 25,
  incomeAmount: 0,
  cardUnpaid: 0,
  fixedExpenses: [],
  protectedItems: [],
});
type Draft = { value: BudgetSettings; step: string; editing: boolean };
const Ctx = createContext<{
  draft: Draft | null;
  error: unknown;
  set: (value: BudgetSettings, step?: string) => void;
  begin: (editing: boolean) => Promise<void>;
  reset: () => Promise<void>;
} | null>(null);
export function BudgetDraftProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return <DraftProvider key={user?.id ?? "guest"}>{children}</DraftProvider>;
}
function DraftProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<unknown>();
  const queue = useRef(Promise.resolve());
  const active = useRef(user?.id);
  const id = user?.id;
  const key = `flexable.service.draft.${id}`;
  useEffect(() => {
    let alive = true;
    active.current = id;
    if (id !== undefined)
      readStorage(key)
        .then((saved) => {
          if (alive)
            setDraft(
              saved
                ? JSON.parse(saved)
                : { value: initial(), step: "index", editing: false },
            );
        })
        .catch((e) => {
          if (alive) setError(e);
        });
    return () => {
      alive = false;
      active.current = undefined;
    };
  }, [key, id]);
  const persist = (next: Draft) => {
    setDraft(next);
    const id = user?.id;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (active.current === id)
          await writeStorage(key, JSON.stringify(next));
      })
      .catch((e) => setError(e));
  };
  const set = (value: BudgetSettings, step = draft?.step ?? "index") =>
    persist({ value, step, editing: draft?.editing ?? false });
  const begin = async (editing: boolean) => {
    const value = editing
      ? await api<BudgetSettings>("/budget/settings")
      : (draft?.value ?? initial());
    persist({ value, step: "balance", editing });
  };
  const reset = async () => {
    await queue.current;
    await writeStorage(key, null);
    setDraft({ value: initial(), step: "index", editing: false });
  };
  return (
    <Ctx.Provider value={{ draft, error, set, begin, reset }}>
      {children}
    </Ctx.Provider>
  );
}
export function useBudgetDraft() {
  const value = useContext(Ctx);
  if (!value) throw new Error("BudgetDraftProvider missing");
  return value;
}
