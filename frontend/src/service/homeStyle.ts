import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "./storage";
// A per-device display preference, so it lives in local storage rather than on the server.
export type HomeStyle = "classic" | "character";
const KEY = "flexable.service.homeStyle";
let current: HomeStyle | null = null;
const listeners = new Set<(style: HomeStyle) => void>();
export function useHomeStyle() {
  const [style, setStyle] = useState<HomeStyle>(current ?? "classic");
  useEffect(() => {
    listeners.add(setStyle);
    if (current === null)
      readStorage(KEY)
        .then((saved) => {
          current = saved === "character" ? "character" : "classic";
          listeners.forEach((l) => l(current!));
        })
        .catch(() => {});
    return () => {
      listeners.delete(setStyle);
    };
  }, []);
  const change = (next: HomeStyle) => {
    current = next;
    listeners.forEach((l) => l(next));
    writeStorage(KEY, next).catch(() => {});
  };
  return [style, change] as const;
}
