import { requireOptionalNativeModule } from "expo-modules-core";

export type PaymentNotice = {
  id: string;
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
