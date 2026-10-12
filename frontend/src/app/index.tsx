import { Redirect, router } from "expo-router";
import { Image, Platform, View } from "react-native";
import { Button, Screen, T } from "@/components/ui";
import { useSession } from "@/service/Session";
import { ErrorNotice, Loading } from "@/service/ui";
import { colors } from "@/theme";
export default function Start() {
  const s = useSession();
  if (!s.ready) return <Loading />;
  if (s.error) return <ErrorNotice error={s.error} retry={s.retry} />;
  if (s.user)
    return <Redirect href={s.user.onboarded ? "/home" : "/onboarding"} />;
  return (
    <Screen>
      <View
        style={{ padding: 12, paddingTop: 70, gap: 20, alignItems: "center" }}
      >
        <Image
          source={require("../../assets/brand/logo.png")}
          style={{ width: 64, height: 64 }}
        />
        <T size={28} weight="800" style={{ textAlign: "center" }}>
          오늘 쓸 수 있는 돈만{"\n"}보여주는 가계부
        </T>
        <T
          color={colors.textMuted}
          style={{ textAlign: "center", lineHeight: 23 }}
        >
          직접 기록으로 바로 시작해요.{"\n"}입력한 잔액과 기록을 바탕으로
          계산해요.
        </T>
        <View style={{ alignSelf: "stretch", gap: 12, marginTop: 30 }}>
          <Button
            label="이메일로 시작하기"
            onPress={() => router.push("/auth/signup")}
          />
          <Button
            label="이미 계정이 있어요"
            variant="soft"
            onPress={() => router.push("/auth/login")}
          />
          <Button
            label="개인정보처리방침"
            variant="ghost"
            onPress={() => router.push("/privacy")}
          />
          {Platform.OS === "web" &&
            process.env.EXPO_PUBLIC_ENABLE_DEMO !== "false" && (
              <Button
                label="시연 보기"
                variant="ghost"
                onPress={() => router.push("/demo")}
              />
            )}
        </View>
      </View>
    </Screen>
  );
}
