import { requireOptionalNativeModule } from "expo-modules-core";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api, sessionGeneration } from "./api/client";
import { notificationsAllowed } from "./localNotifications";
import { useBudgetNotificationSetting } from "./reminderSetting";
import { useSession } from "./Session";
import type { Today } from "./types";

// 알림창에 "오늘 남은 예산"을 계속 보여 준다(Android 상시 알림). 값은 기기에만 저장하고 서버로 보내는 정보는 없다.
type Native = {
  update(
    date: string,
    budget: number,
    spent: number,
    remaining: number,
    dayBudgets: number[],
  ): Promise<boolean | void>;
  updateExpanded?(
    date: string,
    budget: number,
    spent: number,
    remaining: number,
    dayBudgets: number[],
    weekAvailable: number,
  ): Promise<boolean>;
  clear(): Promise<void>;
};
const native = requireOptionalNativeModule<Native>("BudgetNotification");
async function ensureBudgetChannel() {
  await Notifications.setNotificationChannelAsync("budget-today", {
    name: "오늘 남은 예산",
    importance: Notifications.AndroidImportance.LOW,
    enableVibrate: false,
    sound: null,
    showBadge: false,
  });
}
/** 스위치를 직접 켰을 때는 Android가 다시 물을 수 있으면 권한 창을 연다. */
export async function requestBudgetNotificationPermission() {
  if (!native) return false;
  await ensureBudgetChannel();
  return notificationsAllowed(true);
}
type Status = "off" | "checking" | "shown" | "permission" | "unavailable" | "error";
let status: Status = native ? "checking" : "unavailable";
const listeners = new Set<(value: Status) => void>();
function setStatus(value: Status) {
  status = value;
  listeners.forEach((listener) => listener(value));
}
export function useBudgetNotificationStatus() {
  const [value, setValue] = useState(status);
  useEffect(() => {
    listeners.add(setValue);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

export async function clearBudgetNotification() {
  await native?.clear().catch(() => {});
  setStatus(native ? "off" : "unavailable");
}
/** 서버가 계산한 오늘 값을 그대로 넘긴다. 화면에서 다시 계산하지 않는다. */
export function publishBudgetNotification(t: Today) {
  const values = [t.date, t.dailyBudget, t.todaySpent, t.todayAvailable, t.dayBudgets] as const;
  return native?.updateExpanded
    ? native.updateExpanded(...values, t.weekAvailable)
    : native?.update(...values);
}

/**
 * 앱을 열 때, 앱으로 돌아올 때, 거래·예산 저장 등으로 화면 데이터를 다시 읽을 때(revision) 오늘 값을 읽어 알림을 같은 ID로 갱신한다.
 * 끄거나 로그아웃하면 지운다(로그아웃은 세션이 한다).
 */
export function useBudgetNotification() {
  const { user, revision } = useSession();
  const [on] = useBudgetNotificationSetting();
  const [resumed, resume] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") resume((x) => x + 1);
    });
    return () => sub.remove();
  }, []);
  const userId = user?.id;
  const onboarded = user?.onboarded;
  useEffect(() => {
    if (!userId) return;
    if (!on || !onboarded) {
      clearBudgetNotification();
      return;
    }
    if (!native) {
      setStatus("unavailable");
      return;
    }
    const generation = sessionGeneration();
    const controller = new AbortController();
    let active = true;
    setStatus("checking");
    (async () => {
      await ensureBudgetChannel();
      if (!active) return;
      if (!(await notificationsAllowed())) {
        if (active) setStatus("permission");
        return;
      }
      if (!active) return;
      const today = await api<Today>("/budget/today", { signal: controller.signal });
      if (!active || generation !== sessionGeneration()) return;
      const shown = await publishBudgetNotification(today);
      if (!active) return;
      const channel = await Notifications.getNotificationChannelAsync("budget-today");
      if (active) setStatus(shown === false || channel?.importance === Notifications.AndroidImportance.NONE ? "permission" : "shown");
    })().catch(() => { if (active) setStatus("error"); });
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, onboarded, on, revision, resumed]);
}
