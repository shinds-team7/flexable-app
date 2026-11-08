import { Stack } from "expo-router";
import { useBudgetNotification } from "@/service/budgetNotification";
import { useEntryReminder, useEntryReminderTap } from "@/service/entryReminder";
import { useInboxOwner } from "@/service/inbox";
import { useSeedReminderTap } from "@/service/seedReminder";
import { Guard } from "@/service/ui";
import { useAutomaticPaymentImport } from "@/service/paymentNotifications/usePaymentImport";
export default function Layout() {
  useInboxOwner();
  useAutomaticPaymentImport();
  useSeedReminderTap();
  useEntryReminder();
  useBudgetNotification();
  useEntryReminderTap();
  return (
    <Guard>
      <Stack screenOptions={{ headerShown: false }} />
    </Guard>
  );
}
export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";
