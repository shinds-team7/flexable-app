import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Button,
  Card,
  ConfirmModal,
  Screen,
  Segment,
  T,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { colors } from "@/theme";
import { api } from "./api/client";
import { APP_VERSION, SUPPORT_EMAIL } from "./config";
import { useHomeStyle } from "./homeStyle";
import { useSession } from "./Session";
import { ErrorNotice } from "./ui";
export function MyScreen() {
  const session = useSession();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [homeStyle, setHomeStyle] = useHomeStyle();
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
      <Card>
        <T size={20} weight="800">
          내 계정
        </T>
        <T style={{ marginTop: 8 }}>{session.user?.email}</T>
      </Card>
      <Card style={{ gap: 10 }}>
        <T weight="700">홈 화면</T>
        <Segment
          items={[
            { key: "character", label: "캐릭터 홈" },
            { key: "classic", label: "기본 홈" },
          ]}
          value={homeStyle}
          onChange={setHomeStyle}
        />
        <T size={12} color={colors.textMuted}>
          예산을 지킨 날이 쌓일수록 캐릭터가 올라가요. 기본 홈은 캐릭터 없이
          보여줘요
        </T>
      </Card>
      <Card style={{ gap: 4 }}>
        <Button
          label="예산 설정 수정"
          variant="ghost"
          onPress={() => router.push("/onboarding")}
        />
        <Button
          label="카테고리 관리"
          variant="ghost"
          onPress={() => router.push("/categories")}
        />
        <Button
          label="고객지원"
          variant="ghost"
          onPress={() => router.push("/support")}
        />
        <Button
          label="서비스 이용약관"
          variant="ghost"
          onPress={() => router.push("/terms")}
        />
        <Button
          label="개인정보처리방침"
          variant="ghost"
          onPress={() => router.push("/privacy")}
        />
      </Card>
      <Card style={{ gap: 8 }}>
        <T>앱 버전 {APP_VERSION}</T>
        <T size={13}>문의: {SUPPORT_EMAIL}</T>
      </Card>
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
