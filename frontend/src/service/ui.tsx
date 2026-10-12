import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, useFocusEffect } from "expo-router";
import {
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { colors, font } from "@/theme";
import { useSession } from "./Session";
import { api, errorText } from "./api/client";
export const money = (n: number) => n.toLocaleString("ko-KR");
export const digits = (s: string) =>
  s
    .replace(/[^0-9]/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 12);
export function Field({
  label,
  ...props
}: TextInputProps & { label: string; ref?: Ref<TextInput> }) {
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight="600">
        {label}
      </T>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        style={[
          {
            fontFamily: font,
            fontSize: 16,
            minHeight: 50,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 14,
            backgroundColor: "#fff",
            color: colors.text,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field
      label={label}
      keyboardType="number-pad"
      value={money(value)}
      onChangeText={(s) => onChange(Number(digits(s)))}
    />
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <Card style={{ backgroundColor: colors.dangerSoft, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <T color={colors.danger} style={{ flex: 1 }} accessibilityRole="alert">
          {typeof error === "string" ? error : errorText(error)}
        </T>
      </View>
      {retry && <Button label="다시 시도" variant="soft" onPress={retry} />}
    </Card>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 30, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color={colors.brand} />
      <T>불러오는 중이에요</T>
    </View>
  );
}
export function Guard({
  children,
  budget = false,
}: {
  children: ReactNode;
  budget?: boolean;
}) {
  const s = useSession();
  if (!s.ready) return <Loading />;
  if (s.error) return <ErrorNotice error={s.error} retry={s.retry} />;
  if (!s.user) return <Redirect href="/" />;
  if (budget && !s.user.onboarded) return <Redirect href="/onboarding" />;
  return <>{children}</>;
}
export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SubHeader title={title} fallback="/" />
      <Screen>{children}</Screen>
    </KeyboardAvoidingView>
  );
}
export function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  const name = (
    icon in Ionicons.glyphMap ? icon : "pricetag"
  ) as ComponentProps<typeof Ionicons>["name"];
  return <Ionicons name={name} color={color} size={22} />;
}
export function useResource<T>(path: string | null) {
  const { revision, user } = useSession();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [nonce, bump] = useState(0);
  const current = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const requestIdentity = `${user?.id}:${revision}:${nonce}:${path}`;
      const seq = ++current.current;
      const controller = new AbortController();
      setLoading(true);
      setError(undefined);
      if (!path) {
        setLoading(false);
        return;
      }
      api<T>(path, { signal: controller.signal })
        .then((value) => {
          if (seq === current.current && requestIdentity) setData(value);
        })
        .catch((e) => {
          if (seq === current.current) setError(e);
        })
        .finally(() => {
          if (seq === current.current) setLoading(false);
        });
      return () => {
        ++current.current;
        controller.abort();
      };
    }, [path, revision, nonce, user?.id]),
  );
  return { data, error, loading, retry: () => bump((x) => x + 1) };
}
export function seoulDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
export function seoulTime() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16);
}
export function validTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const d = new Date(value + ":00+09:00");
  return (
    !Number.isNaN(d.getTime()) &&
    new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 16) === value
  );
}
