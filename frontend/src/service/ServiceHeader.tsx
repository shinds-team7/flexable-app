import { usePathname } from "expo-router";
import { AppHeaderView } from "@/components/AppHeaderView";
const tabs = [
  { href: "/home" as const, label: "홈", match: (p: string) => p === "/home" },
  {
    href: "/transactions" as const,
    label: "내역",
    match: (p: string) => p === "/transactions",
  },
  {
    href: "/analysis" as const,
    label: "분석",
    match: (p: string) => p === "/analysis",
  },
  { href: "/my" as const, label: "마이", match: (p: string) => p === "/my" },
];
export function ServiceHeader() {
  const pathname = usePathname();
  return <AppHeaderView tabs={tabs} pathname={pathname} homeHref="/home" />;
}
