import { Stack, usePathname } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { BudgetDraftProvider } from "@/service/BudgetDraft";
import { ForceUpdate } from "@/service/ForceUpdate";
import { useFetchUpdateOnResume } from "@/service/LaunchUpdate";
import { LaunchSplash } from "@/service/LaunchSplash";
import { SessionProvider, useSession } from "@/service/Session";
import { colors } from "@/theme";
import { useAppFonts } from "@/service/AppFonts";
import { installErrorReporting, setErrorScreen } from "@/service/errorReport";

export { CrashScreen as ErrorBoundary } from "@/service/CrashScreen";

// 자동 숨김 방지는 index.js에서 Router와 화면 모듈보다 먼저 등록한다.
installErrorReporting();

/** 오류 기록에 남길 지금 화면 경로를 알린다 */
function ErrorScreenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    setErrorScreen(pathname);
  }, [pathname]);
  return null;
}

function SessionReady({ onReady }: { onReady: (ready: boolean) => void }) {
  const { ready } = useSession();
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);
  return null;
}

/** 공통 틀(안전영역·폰 프레임·토스트)과 세션을 둔다. */
export default function RootLayout() {
  useFetchUpdateOnResume();
  const [fontsReady, fontError] = useAppFonts();
  const [minimumShown, setMinimumShown] = useState(Platform.OS === "web");
  const [sessionReady, setSessionReady] = useState(false);
  const finishMinimum = useCallback(() => setMinimumShown(true), []);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") NavigationBar.setHidden(true);
    });
    return () => sub.remove();
  }, []);
  if (fontError) throw fontError;
  // 시작 화면 1초가 끝나기 전에는 홈의 보상·출석 모달이 그 위로 열리지 않게 한다.
  // 세션과 네비게이터는 함께 마운트해 복원 중 화면 이동도 안전하게 처리한다.
  return (
    <SafeAreaProvider>
      <View style={styles.outer}>
        <SafeAreaView style={styles.phone} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          {Platform.OS === "android" && <NavigationBar hidden />}
          {fontsReady && minimumShown && (
            <ToastProvider>
              <SessionProvider>
                <SessionReady onReady={setSessionReady} />
                <ErrorScreenTracker />
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
          )}
        </SafeAreaView>
        {Platform.OS !== "web" && (
          <LaunchSplash
            appReady={!!fontsReady && sessionReady}
            onMinimumShown={finishMinimum}
          />
        )}
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
