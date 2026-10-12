import { router } from "expo-router";
import { useRef, useState } from "react";
import { Linking } from "react-native";
import { Button, ConfirmModal, T } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, errorText } from "./api/client";
import { SUPPORT_EMAIL } from "./config";
import { useSession } from "./Session";
import { ErrorNotice, Field, Page } from "./ui";
import type { AuthResponse } from "./types";
export function DeleteAccountScreen({
  publicPage = false,
}: {
  publicPage?: boolean;
}) {
  const session = useSession();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [complete, setComplete] = useState(false);
  const remove = async () => {
    if (lock.current) return;
    setConfirm(false);
    lock.current = true;
    setBusy(true);
    setError(undefined);
    let deleted = false;
    try {
      const auth = publicPage
        ? await api<AuthResponse>("/auth/login", {
            method: "POST",
            token: null,
            body: { email: email.trim(), password },
          })
        : null;
      await api("/me", {
        method: "DELETE",
        ...(auth ? { token: auth.accessToken } : {}),
        body: { password },
      });
      deleted = true;
      await session.clear();
      setPassword("");
      if (publicPage) setComplete(true);
      else {
        router.replace("/");
        toast("계정과 모든 기록을 삭제했어요");
      }
    } catch (e) {
      if (deleted) {
        setComplete(true);
        toast("계정과 모든 기록을 삭제했어요");
      } else setError(errorText(e, !publicPage));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Page title="계정 삭제">
      {complete ? (
        <>
          <T size={22} weight="800">
            계정과 모든 기록을 삭제했어요
          </T>
          <Button label="시작 화면으로" onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          <T size={22} weight="800">
            텅장관리 계정을 삭제할까요?
          </T>
          <T>
            이메일, 예산 설정, 잔액, 수입일, 고정지출, 보호 금액, 거래와
            카테고리가 즉시 영구 삭제돼요. 삭제 후에는 되돌릴 수 없어요.
          </T>
          {publicPage ? (
            <Field
              label="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          ) : (
            <T>{session.user?.email}</T>
          )}
          <Field
            label="삭제 확인용 비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <ErrorNotice error={error} />
          <Button
            label={busy ? "삭제 중…" : "계정 삭제"}
            disabled={busy || !password || (publicPage && !email.trim())}
            onPress={() => setConfirm(true)}
          />
          <T>
            로그인할 수 없다면 지원 이메일로 삭제를 요청해 주세요. 본인 확인 후
            안내해 드려요.
          </T>
          <Button
            label={SUPPORT_EMAIL}
            variant="ghost"
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("텅장관리 계정 삭제 요청")}`,
              ).catch(() =>
                setError(
                  `메일 앱을 열 수 없어요. ${SUPPORT_EMAIL}로 문의해 주세요`,
                ),
              )
            }
          />
          <ConfirmModal
            visible={confirm}
            title="정말 삭제할까요?"
            message="계정과 모든 기록이 즉시 삭제되며 복구할 수 없어요"
            confirmLabel="영구 삭제"
            onCancel={() => setConfirm(false)}
            onConfirm={remove}
          />
        </>
      )}
    </Page>
  );
}
