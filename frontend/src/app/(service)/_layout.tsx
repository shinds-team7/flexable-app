import { Stack } from "expo-router";
import { useSeedReminderTap } from "@/service/seedReminder";
import { Guard } from "@/service/ui";
export default function Layout() {
  useSeedReminderTap();
  return (
    <Guard>
      <Stack screenOptions={{ headerShown: false }} />
    </Guard>
  );
}
export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";
