import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppHeaderView, BottomTabBar } from "@/components/AppHeaderView";
import { T } from "@/components/ui";
import { colors } from "@/theme";
import { useHomeStyle } from "./homeStyle";
import { money } from "./ui";
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
/** Shows the coin balance and opens the shop, where collecting and costumes live; the dot says coins are waiting there. */
function ShopButton() {
  const wallet = useWallet();
  const waiting = (wallet?.passive.collectable ?? 0) > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="상점"
      accessibilityHint={`코인 ${money(wallet?.balance ?? 0)}개`}
      onPress={() => router.push("/customize")}
      hitSlop={6}
      style={({ pressed }) => [styles.shop, pressed && { opacity: 0.6 }]}
    >
      <T size={16} weight="800" num>
        🪙 {money(wallet?.balance ?? 0)}
      </T>
      {waiting && <View style={styles.dot} />}
    </Pressable>
  );
}
export function ServiceTabBar() {
  const pathname = usePathname();
  return <BottomTabBar tabs={tabs} pathname={pathname} />;
}
const styles = StyleSheet.create({
  // The negative margin lines the icon up with the logo row's padding while keeping a 44pt target.
  shop: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 8,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: colors.danger,
  },
});
