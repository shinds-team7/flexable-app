import { requireOptionalNativeModule } from "expo-modules-core";

export type PaymentNotice = {
  id: string;
  /** 알림을 보낸 앱. 2.1.0 이전에 쌓인 항목에는 없고 신한 SOL페이로 본다 */
  packageName?: string;
  title: string;
  body: string;
  postedAt: number;
  prepared: string;
};
export type CollectionStatus = {
  enabled: boolean;
  allowed: boolean;
  connected: boolean;
  pending: number;
  dropped: number;
};
export type PaymentNative = {
  addListener(event: "onChange", listener: () => void): { remove(): void };
  status(owner: string): Promise<CollectionStatus>;
  configure(owner: string, enabled: boolean): Promise<void>;
  openSettings(): Promise<void>;
  pending(owner: string): Promise<PaymentNotice[]>;
  prepare(owner: string, id: string, body: string): Promise<string>;
  acknowledge(owner: string, id: string): Promise<void>;
  clear(): Promise<void>;
  // 아래는 2.1.0 네이티브부터 있다. 옛 빌드에서는 없으므로 부르기 전에 확인한다.
  /** 신한 SOL페이 외에 자동 기록할 카드 앱 패키지(검증한 파서가 있는 것만) */
  setSources?(packages: string[]): Promise<void>;
  devStatus?(): Promise<{ enabled: boolean; count: number; allowed: boolean }>;
  setDevCapture?(enabled: boolean): Promise<void>;
  devCaptures?(): Promise<DevCapture[]>;
};
/** 개발자용 알림 원문 확인에서 기기에 남긴 알림 한 건(Android Notification extras 그대로) */
export type DevCapture = {
  packageName: string;
  postedAt: number;
  title: string;
  text: string;
  bigText: string;
  textLines: string;
  subText: string;
  summary: boolean;
  ongoing: boolean;
};
export const paymentNative = requireOptionalNativeModule<PaymentNative>(
  "PaymentNotifications",
);
let mutations: Promise<unknown> = Promise.resolve();
/** Keep consent changes, request preparation and logout cleanup in native order. */
export function mutatePaymentCollection<T>(
  task: () => Promise<T>,
  current = () => true,
): Promise<T> {
  const run = mutations
    .catch(() => {})
    .then(() => {
      if (!current()) throw new Error("계정이 변경됐어요. 다시 확인해 주세요");
      return task();
    });
  mutations = run;
  return run;
}
export async function clearPaymentNotifications() {
  await mutatePaymentCollection(async () => {
    await paymentNative?.clear();
  });
}
