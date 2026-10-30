import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { BudgetDraftProvider } from "@/service/BudgetDraft";
import { ForceUpdate } from "@/service/ForceUpdate";
import {
  useFetchUpdateOnResume,
  useLaunchUpdateSettled,
} from "@/service/LaunchUpdate";
import { SessionProvider, useSession } from "@/service/Session";
import { colors } from "@/theme";
import { useAppFonts } from "@/service/AppFonts";

export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";

/** 스플래시는 앱 시작 후 최소 1초, 세션 확인·새 원격 업데이트 확인(최대 3초)이 더 오래 걸리면 끝날 때까지 띄운다. */
const SPLASH_MIN_MS = 1000;
const startedAt = Date.now();
SplashScreen.preventAutoHideAsync().catch(() => {});

function SplashGate({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useSession();
  const updateSettled = useLaunchUpdateSettled();
  useEffect(() => {
    if (!ready || !updateSettled || !fontsReady) return;
    const t = setTimeout(
      () => SplashScreen.hideAsync().catch(() => {}),
      Math.max(0, startedAt + SPLASH_MIN_MS - Date.now()),
    );
    return () => clearTimeout(t);
  }, [ready, updateSettled, fontsReady]);
  return null;
}

/** 공통 틀(안전영역·폰 프레임·토스트)과 세션을 둔다. */
export default function RootLayout() {
  useFetchUpdateOnResume();
  const [fontsReady, fontError] = useAppFonts();
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") NavigationBar.setHidden(true);
    });
    return () => sub.remove();
  }, []);
  if (fontError) throw fontError;
  // 세션 복원 중 화면 이동이 일어나기 전에 네비게이터가 함께 마운트되게 한다.
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <View style={styles.outer}>
        <SafeAreaView style={styles.phone} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          {Platform.OS === "android" && <NavigationBar hidden />}
          <ToastProvider>
            <SessionProvider>
              <SplashGate fontsReady={fontsReady} />
              <BudgetDraftProvider>
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
