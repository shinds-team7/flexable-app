import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button, T } from "@/components/ui";
import { colors } from "@/theme";
import { api, ApiError } from "./api/client";
import { useSession } from "./Session";
import { ErrorNotice, Field, Page } from "./ui";
import type { AuthResponse } from "./types";
import { GoogleButton, KakaoButton } from "./OAuthButtons";
import { useSocialLogin } from "./useSocialLogin";
import { SUPPORT_EMAIL } from "./config";
export function AuthScreen({ signup = false }: { signup?: boolean }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [recover, setRecover] = useState(false);
  const social = useSocialLogin();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 8 &&
    password.length <= 64 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    confirm === password &&
    terms &&
    privacy;
  const submit = async () => {
    if (lock.current) return;
    setFields({});
    if (!email.trim()) {
      setFields({ email: "이메일을 입력해 주세요" });
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setFields({ password: "비밀번호를 입력해 주세요" });
      passwordRef.current?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const auth = await api<AuthResponse>(
        `/auth/${signup ? "signup" : "login"}`,
        {
          method: "POST",
          token: null,
          body: {
            email: email.trim(),
            password,
            ...(signup ? { agreeTerms: terms, agreePrivacy: privacy } : {}),
          },
        },
      );
      await session.accept(auth);
      router.replace(auth.user.onboarded ? "/" : "/onboarding");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError) {
        setFields(e.fields);
        if (e.fields.email) emailRef.current?.focus();
        else if (e.fields.password) passwordRef.current?.focus();
        else if (e.fields.confirm) confirmRef.current?.focus();
        if (!signup && e.code === "INVALID_CREDENTIALS") {
          setPassword("");
          passwordRef.current?.focus();
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  // 카카오·Google이 붙은 계정은 비밀번호가 맞아도 서버가 그 방법으로 돌려보낸다.
  const socialProvider =
    error instanceof ApiError &&
    error.code === "SOCIAL_ACCOUNT" &&
    (error.provider === "kakao" || error.provider === "google")
      ? error.provider
      : null;
  const SocialButton = socialProvider === "kakao" ? KakaoButton : GoogleButton;
  return (
    <Page title={signup ? "회원가입" : "로그인"}>
      <Field
        ref={emailRef}
        label="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {fields.email && <ErrorNotice error={fields.email} />}
      <Field
        ref={passwordRef}
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!visible}
        right={<Eye visible={visible} onPress={() => setVisible((x) => !x)} />}
        autoCapitalize="none"
        autoComplete={signup ? "new-password" : "current-password"}
      />
      {fields.password && <ErrorNotice error={fields.password} />}
      {signup && (
        <>
          <T size={13}>8~64자, 영문·숫자를 포함해 주세요</T>
          <T size={13}>만 14세 이상만 가입할 수 있어요</T>
          <Field
            ref={confirmRef}
            label="비밀번호 확인"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!confirmVisible}
            right={
              <Eye
                visible={confirmVisible}
                onPress={() => setConfirmVisible((x) => !x)}
              />
            }
          />
          {confirm && confirm !== password && <T>비밀번호가 서로 달라요</T>}
          {(
            [
              ["서비스 이용약관", terms, setTerms],
              ["개인정보 수집·이용", privacy, setPrivacy],
            ] as const
          ).map(([label, checked, change]) => (
            <View
              key={label}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`필수 ${label} 동의`}
                accessibilityState={{ checked }}
                aria-checked={checked}
                onPress={() => change(!checked)}
                style={{ flex: 1, paddingVertical: 16 }}
              >
                <T>
                  {checked ? "☑" : "☐"} (필수) {label} 동의
                </T>
              </Pressable>
              <Button
                label={`${label} 보기`}
                variant="ghost"
                onPress={() =>
                  router.push(
                    label === "서비스 이용약관" ? "/terms" : "/privacy",
                  )
                }
              />
            </View>
          ))}
        </>
      )}
      <ErrorNotice error={error} />
      {socialProvider && (
        <SocialButton
          busy={social.busy === socialProvider}
          disabled={social.busy !== null}
          onPress={() => social.start(socialProvider)}
        />
      )}
      <Button
        label={
          busy
            ? "확인 중…"
            : error && !socialProvider
              ? "다시 시도"
              : signup
                ? "가입하기"
                : "로그인"
        }
        disabled={busy || (signup && !valid)}
        onPress={submit}
      />
      {!signup && (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: -4,
            }}
          >
            <TextLink label="비밀번호 찾기" onPress={() => setRecover(true)} />
            {/* replace: 가입 후 뒤로 가기에 이 로그인 화면이 남지 않게 한다(시작 → 가입과 같은 쌓임) */}
            <TextLink
              label="회원가입"
              onPress={() => router.replace("/auth/signup")}
            />
          </View>
          {recover && (
            <T>비밀번호 재설정은 준비 중이에요. 문의: {SUPPORT_EMAIL}</T>
          )}
        </>
      )}
    </Page>
  );
}
/** 작은 글씨 텍스트 버튼 (터치 영역은 44px 이상) */
function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 4,
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <T size={14} weight="600" color={colors.textSub}>
        {label}
      </T>
    </Pressable>
  );
}
function Eye({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} />
    </Pressable>
  );
}
