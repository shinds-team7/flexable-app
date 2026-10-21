import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Button, Card, ConfirmModal, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { useToast } from "@/components/Toast";
import { colors } from "@/theme";
import { api, sessionGeneration } from "./api/client";
import { ErrorNotice, Loading, parseTime, useResource } from "./ui";

type LinkCode = { code: string; expiresAt: string };
type WebLink = { id: number; createdAt: string };

function linkedAt(value: string) {
  return parseTime(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
    hour12: false,
  });
}

export function WebLinksScreen() {
  const links = useResource<WebLink[]>("/me/web-links");
  const toast = useToast();
  const [code, setCode] = useState<LinkCode>();
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [selected, setSelected] = useState<WebLink | null>(null);
  const [confirmCode, setConfirmCode] = useState(false);
  const lock = useRef(false);
  const focus = useRef(0);
  useFocusEffect(
    useCallback(() => {
      ++focus.current;
      return () => {
        ++focus.current;
        // The one-time code stays only on this screen, never in persistent storage.
        setCode(undefined);
        setSelected(null);
        setConfirmCode(false);
      };
    }, []),
  );
  useEffect(() => {
    if (!code) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [code]);

  const remaining = code
    ? Math.max(0, Math.ceil((parseTime(code.expiresAt).getTime() - now) / 1000))
    : 0;
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    const started = focus.current;
    const generation = sessionGeneration();
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      if (started === focus.current && generation === sessionGeneration())
        setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const issueCode = () => {
    setConfirmCode(false);
    void run(async () => {
      const started = focus.current;
      const generation = sessionGeneration();
      // Even if the response is lost, the server may have invalidated the old code.
      setCode(undefined);
      const issued = await api<LinkCode>("/me/web-link-codes", {
        method: "POST",
      });
      if (started !== focus.current || generation !== sessionGeneration())
        return;
      setNow(Date.now());
      setCode(issued);
    });
  };
  const unlink = () => {
    if (!selected) return;
    const id = selected.id;
    setSelected(null);
    void run(async () => {
      await api(`/me/web-links/${id}`, { method: "DELETE" });
      links.retry();
      toast("웹사이트 연동을 해제했어요");
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="웹사이트 연동" fallback="/my" />
      <View style={{ flex: 1 }}>
        <WebLinksContent
          code={code}
          remaining={remaining}
          busy={busy}
          error={error}
          links={links}
          onIssue={() =>
            code && remaining > 0 ? setConfirmCode(true) : issueCode()
          }
          onSelect={setSelected}
        />
      </View>
      <ConfirmModal
        visible={confirmCode}
        title="새 코드를 받을까요?"
        message="이전에 받은 코드는 더 이상 사용할 수 없어요"
        confirmLabel="새 코드 받기"
        onCancel={() => setConfirmCode(false)}
        onConfirm={issueCode}
      />
      <ConfirmModal
        visible={!!selected}
        title="웹사이트 연동을 해제할까요?"
        message="해제하면 웹사이트에서 이 앱 계정의 회원 정보와 시드머니를 새로 불러올 수 없어요. 앱에 입력한 기록은 그대로 남아요"
        confirmLabel="연동 해제"
        onCancel={() => setSelected(null)}
        onConfirm={unlink}
      />
    </View>
  );
}

function WebLinksContent({
  code,
  remaining,
  busy,
  error,
  links,
  onIssue,
  onSelect,
}: {
  code?: LinkCode;
  remaining: number;
  busy: boolean;
  error: unknown;
  links: ReturnType<typeof useResource<WebLink[]>>;
  onIssue: () => void;
  onSelect: (link: WebLink) => void;
}) {
  return (
    <Screen>
      <Card style={{ gap: 12 }}>
        <T size={20} weight="800">
          앱과 웹사이트 연결하기
        </T>
        <T color={colors.textSub} style={{ lineHeight: 22 }}>
          웹사이트에서 로그인한 뒤 [앱 연동하기]에 아래 코드를 입력해 주세요.
          연동하면 앱 계정의 이메일·로그인 방법과 확정된 시드머니를 웹사이트에서
          불러올 수 있어요
        </T>
        <T size={13} color={colors.textMuted}>
          코드는 10분 동안 한 번만 사용할 수 있어요. 본인이 로그인한
          웹사이트에만 입력해 주세요
        </T>
        {code && remaining > 0 && (
          <View
            style={{
              padding: 20,
              gap: 8,
              backgroundColor: colors.brandSoft,
              borderRadius: 16,
            }}
          >
            <T
              size={28}
              weight="800"
              num
              selectable
              style={{ textAlign: "center" }}
            >
              {code.code.slice(0, 4)}-{code.code.slice(4)}
            </T>
            <T size={13} num style={{ textAlign: "center" }}>
              {Math.floor(remaining / 60)}분{" "}
              {String(remaining % 60).padStart(2, "0")}초 남았어요
            </T>
          </View>
        )}
        {code && remaining === 0 && (
          <T color={colors.textMuted}>
            코드가 만료됐어요. 새 코드를 받아 주세요
          </T>
        )}
        <Button
          label={
            busy ? "처리 중이에요" : code ? "새 코드 받기" : "웹 연동 코드 받기"
          }
          disabled={busy}
          onPress={onIssue}
        />
      </Card>
      <ErrorNotice error={error} />
      <Card style={{ gap: 12 }}>
        <T size={18} weight="700">
          연동된 웹사이트
        </T>
        <T size={13} color={colors.textMuted}>
          웹사이트에서 코드 입력을 마쳤다면 새로고침해 주세요
        </T>
        <Button
          label="연동 목록 새로고침"
          variant="soft"
          disabled={busy || links.loading}
          onPress={links.retry}
        />
        <ErrorNotice error={links.error} retry={links.retry} />
        {links.loading ? (
          <Loading />
        ) : !links.error && links.data?.length === 0 ? (
          <T color={colors.textMuted}>연동된 웹사이트가 없어요</T>
        ) : null}
        {!links.loading &&
          links.data?.map((link) => (
            <View
              key={link.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.line,
                paddingTop: 12,
                gap: 6,
              }}
            >
              <T weight="600">웹사이트 연동 #{link.id}</T>
              <T size={13} color={colors.textMuted}>
                연동일: {linkedAt(link.createdAt)} (한국 시간)
              </T>
              <Button
                label={`연동 #${link.id} 해제`}
                variant="ghost"
                disabled={busy || !!links.error}
                onPress={() => onSelect(link)}
              />
            </View>
          ))}
      </Card>
    </Screen>
  );
}
