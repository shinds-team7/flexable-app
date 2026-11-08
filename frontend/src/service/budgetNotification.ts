import { requireOptionalNativeModule } from "expo-modules-core";
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
  ): Promise<void>;
  clear(): Promise<void>;
};
const native = requireOptionalNativeModule<Native>("BudgetNotification");

export async function clearBudgetNotification() {
  await native?.clear().catch(() => {});
}
/** 서버가 계산한 오늘 값을 그대로 넘긴다. 화면에서 다시 계산하지 않는다. */
export function publishBudgetNotification(t: Today) {
  return native?.update(
    t.date,
    t.dailyBudget,
    t.todaySpent,
    t.todayAvailable,
    t.dayBudgets,
  );
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
    if (!native || !userId) return;
    if (!on || !onboarded) {
      clearBudgetNotification();
      return;
    }
    const generation = sessionGeneration();
    // 알림이 안 떠도 앱 사용에는 지장이 없으므로 조용히 넘긴다.
    (async () => {
      if (!(await notificationsAllowed())) return;
      const today = await api<Today>("/budget/today");
      if (generation !== sessionGeneration()) return;
      await publishBudgetNotification(today);
    })().catch(() => {});
  }, [userId, onboarded, on, revision, resumed]);
}
