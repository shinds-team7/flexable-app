import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppHeaderView, BottomTabBar } from "@/components/AppHeaderView";
import { colors, pressTransition } from "@/theme";
import { useHomeStyle } from "./homeStyle";
import { useWallet } from "./wallet";
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
// Tabs live in the bottom icon bar for every home style; the header keeps the logo row,
// plus the shop button on the character home where the costume is shown.
export function ServiceHeader() {
  const pathname = usePathname();
  const [style] = useHomeStyle();
  return (
    <AppHeaderView
      homeHref="/home"
      right={
        pathname === "/home" && style === "character" ? (
          <ShopButton />
        ) : undefined
      }
    />
  );
}
/** Coins, collecting and costumes all live in the shop; the dot says coins are waiting there. The balance itself shows on the character stage. */
function ShopButton() {
  const wallet = useWallet();
  const waiting = (wallet?.passive.collectable ?? 0) > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="상점"
      onPress={() => router.push("/customize")}
      hitSlop={6}
      style={({ pressed }) => [styles.shop, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="shirt-outline" size={24} color={colors.text} />
      {waiting && <View style={styles.dot} />}
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
  // The negative margin lines the icon up with the logo row's padding while keeping a 44pt target.
  shop: {
    width: 44,
    height: 44,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
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
  dot: {
    position: "absolute",
    top: 8,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: colors.danger,
  },
});
