import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "./storage";
// Whether to schedule the payday-eve seed money reminder. A per-device choice like the home style,
// because the reminder itself is scheduled on the device. On unless the user turned it off.
const KEY = "flexable.service.seedReminder";
let current: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();
export function useSeedReminderSetting() {
  const [on, setOn] = useState(current ?? true);
  useEffect(() => {
    listeners.add(setOn);
    if (current === null)
      readStorage(KEY)
        .then((saved) => {
          current = saved !== "off";
          listeners.forEach((l) => l(current!));
        })
        .catch(() => {});
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  const change = (next: boolean) => {
    current = next;
    listeners.forEach((l) => l(next));
    writeStorage(KEY, next ? "on" : "off").catch(() => {});
  };
  return [on, change] as const;
}
