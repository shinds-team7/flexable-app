import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { colors } from "@/theme";
import { sessionGeneration } from "./api/client";
import {
  completeOAuth,
  OAUTH_FAILED,
  oauthErrorText,
} from "./oauth";
import { useSession } from "./Session";
import type { User } from "./types";
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
/** /oauth/callback?code=… or ?error=… — the server sends the browser (or the app link) here. */
export function OAuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const code = one(params.code);
  const error = one(params.error);
  const session = useSession();
  const focused = useIsFocused();
  const [result, setResult] = useState<{
    code: string;
    user?: User;
    message?: string;
  }>();
  const ready = session.ready;
  useEffect(() => {
    // An error callback leaves the saved verifier alone: the next start overwrites it, and a late
    // error from an older attempt must not delete the verifier of the attempt now in progress.
    if (!code) return;
    // Wait for the saved session to be restored: restoring also replaces the API session, which
    // would otherwise look like "someone else logged in meanwhile" below.
    if (!ready) return;
    let alive = true;
    const generation = sessionGeneration();
    // A late answer must not replace the account if this screen was left, or if a login or logout
    // happened in the meantime.
    const stillWanted = () => alive && sessionGeneration() === generation;
    completeOAuth(code, session.accept, stillWanted).then(
      (user) =>
        alive &&
        setResult(user ? { code, user } : { code, message: OAUTH_FAILED }),
      (e) => alive && setResult({ code, message: oauthErrorText(e) }),
    );
    return () => {
      alive = false;
    };
    // session.accept is recreated on every render; it only matters once the answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, error, ready]);
  const current = code && result?.code === code ? result : undefined;
  const user = current?.user;
  // On a phone the same link can open this screen twice; only the one in front moves on.
  useEffect(() => {
    if (focused && user)
      router.replace(user.onboarded ? "/" : "/onboarding");
  }, [focused, user]);
  const message = code
    ? current?.message
    : error
      ? oauthErrorText(error)
      : OAUTH_FAILED;
  if (!message)
    return (
      <View style={{ padding: 30, alignItems: "center", gap: 12 }}>
        <ActivityIndicator color={colors.brand} />
        <T>로그인하는 중이에요</T>
      </View>
    );
  return (
    <Screen>
      <View style={{ paddingTop: 70, gap: 16 }}>
        <Card style={{ gap: 14, alignItems: "center" }}>
          <Ionicons name="alert-circle" size={36} color={colors.danger} />
          <T
            size={17}
            weight="700"
            style={{ textAlign: "center", lineHeight: 25 }}
            accessibilityRole="alert"
          >
            {message}
          </T>
        </Card>
        <Button label="처음으로" onPress={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
