import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button, T } from "@/components/ui";
import { api, ApiError } from "./api/client";
import { useSession } from "./Session";
import { ErrorNotice, Field, Page } from "./ui";
import type { AuthResponse } from "./types";
import { SUPPORT_EMAIL } from "./config";
export function AuthScreen({ signup = false }: { signup?: boolean }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [recover, setRecover] = useState(false);
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
        autoCapitalize="none"
        autoComplete={signup ? "new-password" : "current-password"}
      />
      <Button
        label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        variant="ghost"
        onPress={() => setVisible((x) => !x)}
      />
      {fields.password && <ErrorNotice error={fields.password} />}
      {signup && (
        <>
          <T size={13}>8~64자, 영문·숫자를 포함해 주세요</T>
          <Field
            ref={confirmRef}
            label="비밀번호 확인"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!visible}
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
                onPress={() => change(!checked)}
                style={{ flex: 1, paddingVertical: 16 }}
              >
                <T>
                  {checked ? "☑" : "☐"} (필수) {label} 동의
                </T>
              </Pressable>
              <Button
                label="보기"
                variant="ghost"
                onPress={() => router.push("/privacy")}
              />
            </View>
          ))}
        </>
      )}
      <ErrorNotice error={error} />
      <Button
        label={
          busy
            ? "확인 중…"
            : error
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
          <Button
            label="비밀번호를 잊었어요"
            variant="ghost"
            onPress={() => setRecover(true)}
          />
          {recover && (
            <T>비밀번호 재설정은 준비 중이에요. 문의: {SUPPORT_EMAIL}</T>
          )}
          <Button
            label="회원가입"
            variant="ghost"
            onPress={() => router.push("/auth/signup")}
          />
        </>
      )}
    </Page>
  );
}
