import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { BudgetDraftProvider } from "@/service/BudgetDraft";
import { SessionProvider } from "@/service/Session";
import { colors } from "@/theme";

/** 공통 틀(안전영역·폰 프레임·토스트)만 둔다. 시연 Mock 상태는 demo/_layout에서만 주입한다. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.outer}>
        <SafeAreaView style={styles.phone} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          {/* demo/: 시연(Mock) / 그 외: 실제 서비스 */}
          <ToastProvider>
            <SessionProvider>
              <BudgetDraftProvider>
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
