import { Stack } from "expo-router";
import { Guard } from "@/service/ui";
export default function Layout() {
  return (
    <Guard>
      <Stack screenOptions={{ headerShown: false }} />
    </Guard>
  );
}
