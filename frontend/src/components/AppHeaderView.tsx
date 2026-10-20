import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { T } from "./ui";
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/brand/logo.png")}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    />
  );
}
export function AppHeaderView({ homeHref }: { homeHref: Href }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable
          style={styles.brand}
          onPress={() => router.navigate(homeHref)}
          accessibilityRole="link"
          accessibilityLabel="텅장관리 홈"
        >
          <Logo />
          <T size={18} weight="800">
            텅장관리
          </T>
          <T
            size={12}
            weight="700"
            color={colors.brand}
            style={{ marginTop: 2 }}
          >
            flex-able
          </T>
        </Pressable>
      </View>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>["name"];

/** 하단 아이콘 탭바 — 글자 대신 아이콘만 보이고, 라벨은 스크린리더용으로 남긴다 */
export function BottomTabBar({
  tabs,
  pathname,
}: {
  tabs: {
    href: Href;
    label: string;
    icon: IconName;
    activeIcon: IconName;
    match: (p: string) => boolean;
  }[];
  pathname: string;
}) {
  return (
    <View style={styles.bottom} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.match(pathname);
        return (
          <Pressable
            key={t.label}
            style={styles.bottomTab}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => router.navigate(t.href)}
          >
            <Ionicons
              name={on ? t.activeIcon : t.icon}
              size={26}
              color={on ? colors.brand : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  top: {
    height: 56,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  bottom: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
});
