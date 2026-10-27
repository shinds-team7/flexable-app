import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppHeaderView, BottomTabBar } from "@/components/AppHeaderView";
import { colors, pressTransition } from "@/theme";
import { useInbox } from "./inbox";
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
// Tabs live in the bottom icon bar for every home style; the header keeps the logo row and the inbox bell.
// The shop is reached from the coin history, opened by the coin chip on the character home.
export function ServiceHeader() {
  return <AppHeaderView homeHref="/home" right={<InboxButton />} />;
}
/** 알림함으로 간다. 안 읽은 알림이 있으면 점을 찍는다 */
function InboxButton() {
  const { unread } = useInbox();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? "알림함, 새 알림 있음" : "알림함"}
      onPress={() => router.push("/notifications")}
      hitSlop={6}
      style={styles.bell}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.text} />
      {unread && <View style={styles.dot} />}
    </Pressable>
  );
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
  bell: {
    width: 48,
    height: 48,
    marginRight: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  // Same unread dot as the shop button in the coin history.
  dot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: colors.danger,
  },
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
