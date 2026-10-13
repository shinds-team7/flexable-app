import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type ErrorBoundaryProps } from "expo-router";
import { View } from "react-native";
import { Button, T } from "@/components/ui";
import { colors } from "@/theme";
// Render errors used to close the release app. Show the message instead so testers can report it.
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        gap: 14,
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      <Ionicons name="alert-circle" size={40} color={colors.danger} />
      <T size={20} weight="800">
        화면을 그리다 문제가 생겼어요
      </T>
      <T color={colors.textSub}>아래 내용을 캡처해서 알려 주시면 고칠게요</T>
      <View
        style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 12 }}
      >
        <T size={12} selectable>
          {error.name}: {error.message}
        </T>
      </View>
      <Button label="다시 시도" onPress={retry} />
      <Button
        label="홈으로"
        variant="ghost"
        onPress={() => {
          router.replace("/");
          retry();
        }}
      />
    </View>
  );
}
