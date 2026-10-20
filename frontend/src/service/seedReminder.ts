import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { useSession } from "./Session";

// 수입일 전날 시드머니 반영 알림. 기기 안에서만 예약하고 서버로 보내는 정보는 없다.
const ID = "seed-money";
const CHANNEL = "seed-money";
// 앱이 열려 있을 때 알림이 와도 배너로 보여 준다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
/** 다음 수입일 전날 20시에 알림을 하나만 예약한다(다시 부르면 바꿔 예약). 권한은 처음 한 번만 묻는다. */
export async function scheduleSeedReminder(nextPayday: string) {
  let { status } = await Notifications.getPermissionsAsync();
  if (status === "undetermined")
    ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return;
  // 진동 권한은 막아 두었으므로(app.json blockedPermissions) 채널도 진동 없이 만든다.
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "시드머니 반영 알림",
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
  });
  const [y, m, d] = nextPayday.split("-").map(Number);
  const at = new Date(y, m - 1, d - 1, 20, 0, 0);
  await Notifications.cancelScheduledNotificationAsync(ID);
  if (at.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: "내일은 수입일이에요",
      body: "이번 달 모은 돈을 시드머니에 반영해 보세요",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL,
    },
  });
}
export async function cancelSeedReminder() {
  await Notifications.cancelScheduledNotificationAsync(ID);
}
// 같은 알림 응답으로 화면이 다시 열릴 때 홈으로 또 보내지 않도록 처리한 응답을 기억한다.
const handled = new Set<string>();
/**
 * 알림을 누르면 홈으로 간다. 홈에서 반영 창이 뜬다.
 * 앱이 이미 홈에 떠 있었으면 이동만으로는 다시 읽지 않아 반영 창이 안 뜨므로, 화면 데이터를 다시 읽게 한다.
 */
export function useSeedReminderTap() {
  const response = Notifications.useLastNotificationResponse();
  const { invalidate } = useSession();
  useEffect(() => {
    const request = response?.notification.request;
    if (request?.identifier !== ID) return;
    const key = `${request.identifier}:${response?.notification.date}`;
    if (handled.has(key)) return;
    handled.add(key);
    router.navigate("/home");
    invalidate();
  }, [response, invalidate]);
}
