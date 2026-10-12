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
    .slice(0, 13);
export function Field({
  label,
  right,
  ...props
}: TextInputProps & {
  label: string;
  ref?: Ref<TextInput>;
  right?: ReactNode;
}) {
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight="600">
        {label}
      </T>
      <View style={{ position: "relative" }}>
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
            right ? { paddingRight: 52 } : undefined,
            props.style,
          ]}
        />
        {right && (
          <View
            style={{
              position: "absolute",
              right: 6,
              top: 4,
              bottom: 4,
              justifyContent: "center",
            }}
          >
            {right}
          </View>
        )}
      </View>
    </View>
  );
}
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [date = "", time = ""] = value.split("T");
  return (
    <View style={{ gap: 12 }}>
      <Field
        label={`${label} 날짜 (년-월-일)`}
        value={date}
        placeholder="예: 2026-10-13"
        onChangeText={(next) => onChange(`${next}T${time}`)}
      />
      <Field
        label={`${label} 시간 (시:분, 한국 시간)`}
        value={time}
        placeholder="예: 14:30"
        onChangeText={(next) => onChange(`${date}T${next}`)}
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
// Retain the last successful snapshot on connection failure, but never reuse it across users or date ranges.
export function useResource<T>(path: string | null) {
  const { revision, user } = useSession();
  const [nonce, bump] = useState(0);
  const userId = user?.id;
  const identity = `${userId}:${path}`;
  const [state, setState] = useState<{
    identity: string;
    data?: T;
    error?: unknown;
    loading: boolean;
    confirmedAt?: Date;
  }>({ identity, loading: true });
  const current = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const refresh = `${revision}:${nonce}`;
      const seq = ++current.current;
      const controller = new AbortController();
      setState((previous) => ({
        ...(previous.identity === identity ? previous : { identity }),
        loading: !!path,
        error: undefined,
      }));
      if (!path) return;
      api<T>(path, { signal: controller.signal })
        .then((data) => {
          if (seq === current.current && refresh)
            setState({
              identity,
              data,
              loading: false,
              confirmedAt: new Date(),
            });
        })
        .catch((error) => {
          if (seq === current.current)
            setState((previous) => ({ ...previous, error, loading: false }));
        });
      return () => {
        ++current.current;
        controller.abort();
      };
    }, [identity, path, revision, nonce]),
  );
  return {
    ...(state.identity === identity
      ? state
      : {
          loading: !!path,
          data: undefined,
          error: undefined,
          confirmedAt: undefined,
        }),
    retry: () => bump((x) => x + 1),
  };
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
