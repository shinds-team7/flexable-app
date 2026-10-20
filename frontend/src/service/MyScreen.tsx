import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  ConfirmModal,
  RadioMark,
  Row,
  Screen,
  SwitchMark,
  T,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors } from "@/theme";
import { api } from "./api/client";
import { APP_VERSION, SUPPORT_EMAIL } from "./config";
import { useHomeStyle } from "./homeStyle";
import { useSeedReminderSetting } from "./reminderSetting";
import { useSession } from "./Session";
import { ErrorNotice } from "./ui";
import { PROVIDER_NAME } from "./oauth";
import type { User } from "./types";
/** 이메일, 그리고 카카오·Google 계정이면 어느 계정으로 로그인했는지 */
export function AccountLine({ user }: { user: User }) {
  const social =
    user.provider === "kakao" || user.provider === "google"
      ? `${PROVIDER_NAME[user.provider]} 계정으로 로그인 중`
      : null;
  return (
    <>
      <T style={{ marginTop: 8 }}>{user.email ?? social}</T>
      {user.email && social && (
        <T size={13} color={colors.textMuted} style={{ marginTop: 4 }}>
          {social}
        </T>
      )}
    </>
  );
}
export function MyScreen() {
  const session = useSession();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [homeStyle, setHomeStyle] = useHomeStyle();
  // Turning it off cancels the scheduled reminder; the home screen reschedules when it is back on.
  const [remind, setRemind] = useSeedReminderSetting();
  const logout = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setConfirm(false);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      toast("이 기기에서 로그아웃했어요. 다른 기기의 상태는 확인하지 못했어요");
    } finally {
      try {
        await session.clear();
        router.replace("/");
      } catch (e) {
        setError(e);
      }
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={17} weight="700">
            내 계정
          </T>
          {session.user && <AccountLine user={session.user} />}
        </View>
      </Card>
      <Card style={styles.group}>
        <T
          size={14}
          weight="700"
          color={colors.textSub}
          style={styles.groupTitle}
        >
          홈 화면
        </T>
        <View accessibilityRole="radiogroup">
          {(
            [
              [
                "character",
                "캐릭터 홈",
                "예산을 지킨 날이 쌓이면 캐릭터가 자라요",
              ],
              ["classic", "기본 홈", "캐릭터 없이 금액만 보여 드려요"],
            ] as const
          ).map(([key, label, caption], i) => (
            <Row
              key={key}
              first={i === 0}
              label={label}
              caption={caption}
              accessibilityRole="radio"
              accessibilityState={{ checked: homeStyle === key }}
              aria-checked={homeStyle === key}
              right={<RadioMark on={homeStyle === key} />}
              onPress={() => setHomeStyle(key)}
            />
          ))}
        </View>
      </Card>
      {Platform.OS !== "web" && (
        <Card style={styles.group}>
          <Row
            first
            label="수입일 전날 알림"
            caption="시드머니를 반영할 때 알려 드려요"
            accessibilityRole="switch"
            accessibilityState={{ checked: remind }}
            aria-checked={remind}
            right={<SwitchMark on={remind} />}
            onPress={() => setRemind(!remind)}
          />
        </Card>
      )}
      <Card style={styles.group}>
        {(
          [
            ["예산 설정 바꾸기", "/onboarding"],
            ["카테고리 관리", "/categories"],
            ["고객지원", "/support"],
            ["서비스 이용약관", "/terms"],
            ["개인정보처리방침", "/privacy"],
          ] as const
        ).map(([label, href], i) => (
          <Row
            key={href}
            first={i === 0}
            label={label}
            onPress={() => router.push(href)}
          />
        ))}
      </Card>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <T size={13} color={colors.textMuted}>
          앱 버전 {APP_VERSION}
        </T>
        <T size={13} color={colors.textMuted}>
          문의: {SUPPORT_EMAIL}
        </T>
      </View>
      <ErrorNotice error={error} />
      <Button
        label="로그아웃"
        variant="soft"
        disabled={busy}
        onPress={() => setConfirm(true)}
      />
      <Button
        label="계정 삭제"
        variant="ghost"
        onPress={() => router.push("/account/delete")}
      />
      <ConfirmModal
        visible={confirm}
        title="로그아웃할까요?"
        message="로그아웃하면 다시 로그인해야 기록을 볼 수 있어요. 연결되어 있으면 다른 기기에서도 로그아웃돼요"
        confirmLabel="로그아웃"
        onCancel={() => setConfirm(false)}
        onConfirm={logout}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  group: { padding: 0, overflow: "hidden" },
  groupTitle: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
});
