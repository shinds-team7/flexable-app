import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api, sessionGeneration } from "./api/client";
import { entryReminderTimes } from "./entryReminderTimes";
import { recordReminders } from "./inboxStore";
import { ensureChannel, notificationsAllowed } from "./localNotifications";
import { useEntryReminderSetting } from "./reminderSetting";
import { ENTRY_REMINDER } from "./reminderTexts";
import { useSession } from "./Session";
import type { Transaction } from "./types";
import { parseTime } from "./ui";

// 거래 기록이 24시간 없으면 기록을 권하는 알림. 기기 안에서만 예약하고 서버로 보내는 정보는 없다.
const PREFIX = "entry-reminder-";
const CHANNEL = "entry-reminder";
// 미리 예약하는 개수. 앱을 열지 않은 채 이만큼 지나면 더 보내지 않는다.
const COUNT = 7;
// 예약과 취소가 섞이지 않게 차례로 처리한다.
let queue = Promise.resolve();
function serial(task: () => Promise<void>) {
  queue = queue.then(task).catch(() => {});
  return queue;
}
async function cancelAll() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
export function cancelEntryReminder() {
  return serial(async () => {
    await cancelAll();
    await recordReminders("entry", []);
  });
}
/** 마지막 기록부터 24시간마다(밤이면 9시로 미뤄) 앞으로 COUNT번을 다시 예약한다. */
function scheduleEntryReminder(last: Date, generation: number) {
  return serial(async () => {
    // 그사이 로그아웃·다른 계정 로그인이 있었으면 그 세션의 예약을 건드리지 않는다.
    if (generation !== sessionGeneration()) return;
    if (!(await notificationsAllowed())) return;
    await ensureChannel(CHANNEL, "기록 알림");
    await cancelAll();
    const times = entryReminderTimes(last, new Date(), COUNT);
    for (const [i, at] of times.entries())
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${i}`,
        content: ENTRY_REMINDER,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: CHANNEL,
        },
      });
    // 알림함에 남기도록 예약 시각을 기록한다.
    await recordReminders("entry", times);
  });
}
function seoulDay(offset: number) {
  return new Date(Date.now() + 9 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
}
/**
 * 가장 최근에 기록된 거래의 시각(고정지출 자동 기록 포함). 없으면 가입 시각.
 * 목록은 거래 날짜로 찾으므로 앞뒤 30일 안의 거래만 본다.
 */
async function lastEntry(signup: string) {
  const { items } = await api<{ items: Transaction[] }>(
    `/transactions?from=${seoulDay(-30)}&to=${seoulDay(30)}`,
  );
  const times = [signup, ...items.map((t) => t.createdAt)]
    .map((x) => parseTime(x).getTime())
    .filter((x) => !Number.isNaN(x));
  return new Date(times.length ? Math.max(...times) : Date.now());
}
/**
 * 앱을 열 때, 앱으로 돌아올 때, 거래 저장 등으로 화면 데이터를 다시 읽을 때 다시 예약한다.
 * 로그아웃 때의 취소는 세션이 한다.
 */
export function useEntryReminder() {
  const { user, revision } = useSession();
  const [on] = useEntryReminderSetting();
  const [resumed, resume] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") resume((x) => x + 1);
    });
    return () => sub.remove();
  }, []);
  const userId = user?.id;
  const onboarded = user?.onboarded;
  const signup = user?.createdAt;
  useEffect(() => {
    if (!userId || !signup) return;
    if (!on || !onboarded) {
      cancelEntryReminder();
      return;
    }
    const generation = sessionGeneration();
    // 예약이 실패해도 기록은 그대로 할 수 있으므로 조용히 넘긴다.
    lastEntry(signup)
      .then((last) => scheduleEntryReminder(last, generation))
      .catch(() => {});
  }, [userId, onboarded, signup, on, revision, resumed]);
}
// 같은 알림 응답으로 화면이 다시 열릴 때 또 이동하지 않도록 처리한 응답을 기억한다.
const handled = new Set<string>();
/** 알림을 누르면 거래 기록 화면으로 간다. */
export function useEntryReminderTap() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const request = response?.notification.request;
    if (!request?.identifier.startsWith(PREFIX)) return;
    const key = `${request.identifier}:${response?.notification.date}`;
    if (handled.has(key)) return;
    handled.add(key);
    router.navigate("/transactions/new");
  }, [response]);
}
