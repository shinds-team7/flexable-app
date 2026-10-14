import { usePathname } from "expo-router";
import { AppHeaderView, BottomTabBar } from "@/components/AppHeaderView";
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
// The character home moves the tabs to an icon bar at the bottom; the classic home keeps them in the header.
export function ServiceHeader({ showTabs = true }: { showTabs?: boolean }) {
  const pathname = usePathname();
  return (
    <AppHeaderView
      tabs={tabs}
      pathname={pathname}
      homeHref="/home"
      showTabs={showTabs}
    />
  );
}
export function ServiceTabBar() {
  const pathname = usePathname();
  return <BottomTabBar tabs={tabs} pathname={pathname} />;
}
