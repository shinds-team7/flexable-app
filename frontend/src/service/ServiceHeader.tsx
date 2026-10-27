import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { AppHeaderView, BottomTabBar } from "@/components/AppHeaderView";
import { colors, pressTransition } from "@/theme";
const tabs = [
  {
    href: "/home" as const,
    label: "홈",
    icon: "home-outline" as const,
    activeIcon: "home" as const,
    match: (p: string) => p === "/home",
  },
  {
    href: "/transactions" as const,
    label: "내역",
    icon: "receipt-outline" as const,
    activeIcon: "receipt" as const,
    match: (p: string) => p === "/transactions",
  },
  {
    href: "/analysis" as const,
    label: "분석",
    icon: "stats-chart-outline" as const,
    activeIcon: "stats-chart" as const,
    match: (p: string) => p === "/analysis",
  },
  {
    href: "/my" as const,
    label: "마이",
    icon: "person-outline" as const,
    activeIcon: "person" as const,
    match: (p: string) => p === "/my",
  },
];
// Tabs live in the bottom icon bar for every home style; the header keeps only the logo row.
// The shop is reached from the coin history, opened by the coin chip on the character home.
export function ServiceHeader() {
  return <AppHeaderView homeHref="/home" />;
}
export function ServiceTabBar() {
  const pathname = usePathname();
  return (
    <BottomTabBar tabs={tabs} pathname={pathname} middle={<RecordButton />} />
  );
}
/** Sits between 내역 and 분석 on every tab, so recording is one tap from anywhere. */
function RecordButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="거래 직접 기록"
      onPress={() => router.push("/transactions/new")}
      style={({ pressed }) => [
        styles.record,
        pressTransition,
        pressed && styles.recordPressed,
      ]}
    >
      <Ionicons name="add" size={30} color="#fff" />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  record: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  recordPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: colors.brandDark,
  },
});
