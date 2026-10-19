import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { T } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { EmailButton, GoogleButton, KakaoButton } from "@/service/OAuthButtons";
import {
  OAUTH_UNAVAILABLE,
  startErrorText,
  startOAuth,
  type OAuthProvider,
} from "@/service/oauth";
import { useSession } from "@/service/Session";
import { ErrorNotice, Loading } from "@/service/ui";
import { colors } from "@/theme";

const DEMO_URL = "https://flexable-web-delta.vercel.app/m";
export default function Start() {
  const s = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const lock = useRef(false);
  // Web: coming back from the login page with the browser's back button can restore this page as it was left.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const reset = () => {
      lock.current = false;
      setBusy(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  if (!s.ready) return <Loading />;
  if (s.error) return <ErrorNotice error={s.error} retry={s.retry} />;
  if (s.user)
    return <Redirect href={s.user.onboarded ? "/home" : "/onboarding"} />;
  const social = async (provider: OAuthProvider) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(provider);
    // In the app this waits until the login browser closes, so the buttons stay locked meanwhile.
    let failure: unknown = null;
    const result = await startOAuth(provider).catch((e: unknown) => {
      failure = e;
      return null;
    });
    // Web: the page is moving to the login page; pageshow resets this if the user comes back.
    if (result?.type === "leaving") return;
    // Release before any navigation (docs/bug-transaction-edit-blank-screen.md rule 2).
    lock.current = false;
    setBusy(null);
    if (!result) toast(startErrorText(failure));
    else if (result.type === "unavailable") toast(OAUTH_UNAVAILABLE);
    else if (result.type === "redirect")
      router.push({ pathname: "/oauth/callback", params: result.params });
  };
  // 시연은 웹사이트 저장소(shinds-team7/flexable-web)의 /m 으로 옮겼다. 웹에서만 링크를 보여 준다.
  const demo = Platform.OS === "web";
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
    >
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
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 30 }}>
          <KakaoButton
            busy={busy === "kakao"}
            disabled={busy !== null}
            onPress={() => social("kakao")}
          />
          <GoogleButton
            busy={busy === "google"}
            disabled={busy !== null}
            onPress={() => social("google")}
          />
          <EmailButton
            disabled={busy !== null}
            onPress={() => router.push("/auth/login")}
          />
          <T
            size={12}
            color={colors.textMuted}
            style={{ textAlign: "center", lineHeight: 18, marginTop: 6 }}
          >
            계속하면 이용약관과 개인정보처리방침에 동의하는 것으로 봐요.{"\n"}만
            14세 이상만 이용할 수 있어요.
          </T>
        </View>
      </View>
      <View style={{ flex: 1, minHeight: 24 }} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <FooterLink label="이용약관" onPress={() => router.push("/terms")} />
        <Dot />
        <FooterLink
          label="개인정보처리방침"
          onPress={() => router.push("/privacy")}
        />
        {demo && (
          <>
            <Dot />
            <FooterLink
              label="시연 보기"
              onPress={() => Linking.openURL(DEMO_URL)}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 8,
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <T size={13} color={colors.textMuted}>
        {label}
      </T>
    </Pressable>
  );
}
function Dot() {
  return (
    <T size={13} color={colors.textFaint} aria-hidden>
      ·
    </T>
  );
}
