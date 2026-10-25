import { Stack } from "expo-router";
import { useEntryReminder, useEntryReminderTap } from "@/service/entryReminder";
import { useSeedReminderTap } from "@/service/seedReminder";
import { Guard } from "@/service/ui";
export default function Layout() {
  useSeedReminderTap();
  useEntryReminder();
  useEntryReminderTap();
  return (
    <Guard>
      <Stack screenOptions={{ headerShown: false }} />
    </Guard>
  );
}
export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";
