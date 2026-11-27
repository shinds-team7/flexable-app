import { Platform } from "react-native";
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={Platform.OS !== "ios"}>
          <Stack.Screen name="payment-notifications" />
          <Stack.Screen name="dev-notifications" />
          <Stack.Screen name="transactions/import" />
        </Stack.Protected>
      </Stack>
    </Guard>
  );
}
export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";
