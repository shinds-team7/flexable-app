import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, Image, Modal, StyleSheet, Text, View } from "react-native";
import { useLaunchUpdateSettled } from "./LaunchUpdate";
import { markSplashHidden } from "./splashVisibility";

/** 네이티브 스플래시가 먼저 사라져도 앱이 그린 시작 화면은 1초 이상 유지한다. */
export function LaunchSplash({
  appReady,
  onMinimumShown,
}: {
  appReady: boolean;
  onMinimumShown: () => void;
}) {
  const updateSettled = useLaunchUpdateSettled();
  const [visible, setVisible] = useState(true);
  const [shown, setShown] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [minimumShown, setMinimumShown] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!shown || !imageReady || !active || minimumShown) return;
    // 모달과 이미지가 준비되기 전에 시간을 세면 실제 그림은 잠깐만 보일 수 있다.
    SplashScreen.hideAsync().catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setMinimumShown(true), 1000);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [shown, imageReady, active, minimumShown]);

  useEffect(() => {
    if (minimumShown && updateSettled) onMinimumShown();
  }, [minimumShown, updateSettled, onMinimumShown]);

  useEffect(() => {
    if (!visible) markSplashHidden();
  }, [visible]);

  if (visible && minimumShown && updateSettled && appReady) setVisible(false);

  if (!visible) return null;
  return (
    <Modal
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="fullScreen"
      onShow={() => setShown(true)}
      onRequestClose={() => {}}
    >
      <View
        style={styles.screen}
        accessibilityLabel="텅장관리 시작 화면"
        testID="launch-splash"
      >
        <StatusBar style="light" />
        {imageFailed ? (
          <Text style={styles.fallback}>텅장관리</Text>
        ) : (
          <Image
            source={require("../../assets/splash-icon.png")}
            style={styles.logo}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={() => setImageReady(true)}
            onError={() => {
              setImageFailed(true);
              setImageReady(true);
            }}
          />
        )}
        <Image
          source={require("../../assets/splash-branding.png")}
          style={styles.branding}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0046FF",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: { width: 200, height: 200 },
  branding: { position: "absolute", bottom: 24, width: 200, height: 80 },
  fallback: { color: "#fff", fontSize: 26, fontWeight: "700" },
});
