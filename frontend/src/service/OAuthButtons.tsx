// 시작 화면의 로그인 버튼. 카카오는 카카오 로그인 디자인 가이드, Google은 Google 로그인 브랜딩 가이드의
// 색·심볼을 따르고, 높이·모서리는 앱의 기본 Button과 같게 맞춘다.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { T } from "@/components/ui";
import { colors, pressTransition, radius } from "@/theme";

type Props = { onPress: () => void; disabled?: boolean; busy?: boolean };

function BrandButton({
  label,
  mark,
  background,
  border,
  foreground,
  onPress,
  disabled,
  busy,
}: Props & {
  label: string;
  mark: ReactNode;
  background: string;
  border: string;
  foreground: string;
}) {
  const off = !!disabled || !!busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      aria-disabled={off}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressTransition,
        { backgroundColor: background, borderColor: border },
        pressed && styles.pressed,
        disabled && !busy && styles.dimmed,
      ]}
    >
      <View style={styles.mark}>
        {busy ? <ActivityIndicator size="small" color={foreground} /> : mark}
      </View>
      <T size={16} weight="600" color={foreground} style={styles.label}>
        {label}
      </T>
    </Pressable>
  );
}

/** 카카오 말풍선 심볼 (검정) */
function KakaoSymbol() {
  return (
    <Svg width={20} height={20} viewBox="0 0 18 18">
      <Path
        fill="#000000"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 .6C4.029.6 0 3.713 0 7.553c0 2.388 1.558 4.493 3.932 5.745l-.999 3.648c-.088.322.28.579.563.392l4.377-2.888c.37.036.745.055 1.127.055 4.97 0 9-3.113 9-6.952C18 3.713 13.97.6 9 .6Z"
      />
    </Svg>
  );
}

/** Google 공식 4색 G 로고 */
function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export function KakaoButton(props: Props) {
  return (
    <BrandButton
      {...props}
      label="카카오로 시작하기"
      mark={<KakaoSymbol />}
      background="#FEE500"
      border="#FEE500"
      foreground="rgba(0,0,0,0.85)"
    />
  );
}

export function GoogleButton(props: Props) {
  return (
    <BrandButton
      {...props}
      label="Google 계정으로 계속하기"
      mark={<GoogleMark />}
      background="#FFFFFF"
      border="#747775"
      foreground="#1F1F1F"
    />
  );
}

export function EmailButton(props: Props) {
  return (
    <BrandButton
      {...props}
      label="이메일로 시작하기"
      mark={<Ionicons name="mail-outline" size={20} color={colors.brandDark} />}
      background={colors.brandSoft}
      border={colors.brandSoft}
      foreground={colors.brandDark}
    />
  );
}

const styles = StyleSheet.create({
  // Same height and corner as the app's Button; the mark sits on the left and the label stays centered.
  button: {
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    position: "absolute",
    left: 18,
    top: 0,
    bottom: 0,
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center" },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  dimmed: { opacity: 0.55 },
});
