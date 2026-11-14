import * as Updates from "expo-updates";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Share, View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { colors } from "@/theme";
import { ErrorNotice } from "./ui";
import { paymentNative, type DevCapture } from "./paymentNotifications/native";
import { maskNoticeText, maskedCaptureJson } from "./paymentNotifications/mask";

/**
 * 개발자용 알림 원문 확인을 열 수 있는 빌드인지. Play 운영 앱(production 채널)에서는 열리지 않는다.
 * 운영 개인정보처리방침의 "다른 앱·문자는 수집하지 않는다"를 지키기 위해서다(결정 2026-11-14).
 */
export function devToolsAvailable() {
  return (
    Platform.OS === "android" &&
    !!paymentNative?.devCaptures &&
    (__DEV__ ||
      Updates.channel === "preview" ||
      Updates.channel === "development")
  );
}

const FIELDS = [
  ["title", "제목 EXTRA_TITLE"],
  ["text", "본문 EXTRA_TEXT"],
  ["bigText", "펼친 본문 EXTRA_BIG_TEXT"],
  ["textLines", "여러 줄 본문 EXTRA_TEXT_LINES"],
  ["subText", "보조 문구 EXTRA_SUB_TEXT"],
] as const;

const seoulTime = (ms: number) =>
  new Date(ms + 9 * 3600000).toISOString().slice(5, 19).replace("T", " ");

export function DevNotificationsScreen() {
  const [status, setStatus] = useState<{
    enabled: boolean;
    count: number;
    allowed: boolean;
  }>();
  const [items, setItems] = useState<DevCapture[]>([]);
  const [raw, setRaw] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const native = devToolsAvailable() ? paymentNative : null;
  const load = useCallback(async () => {
    if (!native?.devStatus || !native.devCaptures) return;
    try {
      setStatus(await native.devStatus());
      setItems(await native.devCaptures());
    } catch (e) {
      setError(e);
    }
  }, [native]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const show = (text: string) => (raw ? text : maskNoticeText(text));
  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="알림 원문 확인(개발자)" fallback="/my" />
      <Screen>
        {!native ? (
          <T>이 빌드에서는 사용할 수 없어요</T>
        ) : (
          <>
            <Card style={{ gap: 10 }}>
              <T size={13}>
                켜 둔 동안 이 기기에 온 결제처럼 보이는
                알림(승인·결제·취소·이용·금액이 들어간 알림)을 보낸 앱 이름과
                함께 이 기기에만 최대 30개, 24시간 보관해요. 서버로 보내지
                않아요. 다른 카드사 알림 형식을 확인할 때만 켜고, 끝나면 꺼
                주세요(끄면 모두 지워져요)
              </T>
              {status && !status.allowed && (
                <Button
                  label="알림 접근 허용하기"
                  variant="soft"
                  disabled={busy}
                  onPress={() => act(() => native.openSettings())}
                />
              )}
              <Button
                label={
                  status?.enabled
                    ? "원문 확인 끄기(모두 삭제)"
                    : "원문 확인 켜기"
                }
                variant={status?.enabled ? "neutral" : "primary"}
                disabled={
                  busy || !status || (!status.enabled && !status.allowed)
                }
                onPress={() =>
                  act(() => native.setDevCapture!(!status?.enabled))
                }
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  label="새로고침"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => act(async () => {})}
                />
                <Button
                  label={raw ? "가린 내용 보기" : "원문 그대로 보기"}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setRaw((x) => !x)}
                />
              </View>
              <ErrorNotice error={error} />
            </Card>
            {status?.enabled && items.length === 0 && (
              <T>
                아직 모은 알림이 없어요. 카드 결제 알림이 오면 여기에 보여요
              </T>
            )}
            {items.map((item) => (
              <Card
                key={`${item.packageName}:${item.postedAt}`}
                style={{ gap: 8 }}
              >
                <T weight="700" selectable>
                  {item.packageName}
                </T>
                <T size={12} color={colors.textMuted}>
                  {seoulTime(item.postedAt)}
                  {item.summary ? " · 묶음 요약" : ""}
                  {item.ongoing ? " · 상시" : ""}
                </T>
                {FIELDS.filter(([key]) => item[key]).map(([key, label]) => (
                  <View key={key} style={{ gap: 2 }}>
                    <T size={12} color={colors.textMuted}>
                      {label}
                    </T>
                    {/* 줄바꿈·공백을 그대로 보이게 JSON 문자열로 보여 준다 */}
                    <T size={13} selectable>
                      {JSON.stringify(show(item[key]))}
                    </T>
                  </View>
                ))}
                <Button
                  label="가려서 공유"
                  variant="soft"
                  onPress={() =>
                    void Share.share({ message: maskedCaptureJson(item) })
                  }
                />
              </Card>
            ))}
            {items.length > 0 && (
              <T size={12} color={colors.textMuted}>
                공유 전에 이름·카드번호가 가려졌는지 꼭 확인해 주세요
              </T>
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
