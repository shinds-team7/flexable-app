import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { UpdateBanner } from "@/components/UpdateBanner";
import { BudgetDraftProvider } from "@/service/BudgetDraft";
import { ForceUpdate } from "@/service/ForceUpdate";
import { useLaunchUpdateSettled } from "@/service/LaunchUpdate";
import { SessionProvider, useSession } from "@/service/Session";
import { colors } from "@/theme";

export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";

/** 스플래시는 앱 시작 후 최소 1초, 세션 확인·새 원격 업데이트 확인(최대 3초)이 더 오래 걸리면 끝날 때까지 띄운다. */
const SPLASH_MIN_MS = 1000;
const startedAt = Date.now();
SplashScreen.preventAutoHideAsync().catch(() => {});

function SplashGate() {
  const { ready } = useSession();
  const updateSettled = useLaunchUpdateSettled();
  useEffect(() => {
    if (!ready || !updateSettled) return;
    const t = setTimeout(
      () => SplashScreen.hideAsync().catch(() => {}),
      Math.max(0, startedAt + SPLASH_MIN_MS - Date.now()),
    );
    return () => clearTimeout(t);
  }, [ready, updateSettled]);
  return null;
}

/** 공통 틀(안전영역·폰 프레임·토스트·업데이트 배너)만 둔다. 시연 Mock 상태는 demo/_layout에서만 주입한다. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.outer}>
        <SafeAreaView style={styles.phone} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          {/* demo/: 시연(Mock) / 그 외: 실제 서비스 */}
          <ToastProvider>
            <SessionProvider>
              <SplashGate />
              <BudgetDraftProvider>
                {Platform.OS !== "web" && <UpdateBanner />}
                {Platform.OS === "android" && <ForceUpdate />}
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                  }}
                />
              </BudgetDraftProvider>
            </SessionProvider>
          </ToastProvider>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#DCE1EA" : "#fff",
    alignItems: "center",
  },
  phone: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#fff",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 0 24px rgba(16,24,40,0.08)" } as object)
      : {}),
  },
});
