import * as Notifications from "expo-notifications";

// 기기 안에서 예약하는 알림(시드머니·기록)의 공통 설정. 서버로 보내는 정보는 없다.
// 앱이 열려 있을 때 알림이 와도 배너로 보여 준다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
let asking: Promise<boolean> | null = null;
/** 권한은 처음 한 번만 묻는다. 두 알림이 동시에 예약해도 한 번만 묻도록 묻는 중인 요청을 같이 쓴다. */
export function notificationsAllowed() {
  asking ??= (async () => {
    let { status } = await Notifications.getPermissionsAsync();
    if (status === "undetermined")
      ({ status } = await Notifications.requestPermissionsAsync());
    return status === "granted";
  })().finally(() => {
    asking = null;
  });
  return asking;
}
/** 진동 권한은 막아 두었으므로(app.json blockedPermissions) 채널도 진동 없이 만든다. */
export function ensureChannel(id: string, name: string) {
  return Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
  });
}
