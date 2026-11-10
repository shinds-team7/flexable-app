// 웹에는 기기 알림이 없다.
export async function clearBudgetNotification() {}
export function useBudgetNotification() {}
export function useBudgetNotificationStatus() { return "unavailable" as const; }
export async function requestBudgetNotificationPermission() { return false; }
