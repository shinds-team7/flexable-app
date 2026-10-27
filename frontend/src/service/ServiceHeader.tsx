import Ionicons from "@expo/vector-icons/Ionicons";
import { usePathname } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { AppHeaderView, BottomTabBar } from "@/components/AppHeaderView";
import { colors, pressTransition } from "@/theme";
import { AddTransactionSheet } from "./AddTransactionSheet";
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
/** Sits between 내역 and 분석 on every tab, so recording is one tap from anywhere. It opens the choice of image upload or manual entry. */
function RecordButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="거래 추가"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.record,
          pressTransition,
          pressed && styles.recordPressed,
        ]}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
      <AddTransactionSheet visible={open} onClose={() => setOpen(false)} />
    </>
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
