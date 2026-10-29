import type { PaymentNative } from "./native";
export const paymentNative: PaymentNative | null = null;
export async function clearPaymentNotifications() {}
export async function mutatePaymentCollection<T>(
  task: () => Promise<T>,
  current = () => true,
): Promise<T> {
  if (!current()) throw new Error("계정이 변경됐어요");
  return task();
}
