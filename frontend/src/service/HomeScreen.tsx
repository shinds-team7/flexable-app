import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Sheet, T } from "@/components/ui";
import {
  CharacterStage,
  pointsStatus,
  type Level,
  type PaceStatus,
} from "@/components/CharacterStage";
import { OutfitView } from "./OutfitView";
import { RewardModal } from "./RewardModal";
import { ackRewards, checkIn, collectCoins } from "./coinApi";
import { TodayHeroView } from "@/components/TodayHeroView";
import { colors, floating, pressTransition } from "@/theme";
import { useHomeStyle } from "./homeStyle";
import { SeedMoneyCard } from "./SeedMoneyCard";
import { DayBudgets } from "@/components/DayBudgets";
import { useSeedReminderSetting } from "./reminderSetting";
import { cancelSeedReminder, scheduleSeedReminder } from "./seedReminder";
import { ErrorNotice, Loading, money, useResource } from "./ui";
import type { CoinReward, CoinWallet, Today } from "./types";
export function HomeScreen() {
  const result = useResource<Today>("/budget/today");
  const [basis, setBasis] = useState(false);
  const [style] = useHomeStyle();
  const [remind] = useSeedReminderSetting();
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [rewards, setRewards] = useState<CoinReward[]>([]);
  const [collecting, setCollecting] = useState(false);
  const checking = useRef(false);
  const characterHome = style === "character";
  // Opening or returning to the home runs check-in; an older server without the endpoint just hides the coin row.
  const runCheckIn = useCallback(() => {
    if (!characterHome || checking.current) return;
    checking.current = true;
    checkIn()
      .then((r) => {
        setWallet(r.wallet);
        if (r.rewards.length) setRewards((q) => [...q, ...r.rewards.filter((x) => !q.some((y) => y.id === x.id))]);
      })
      .catch(() => {})
      .finally(() => {
        checking.current = false;
      });
  }, [characterHome]);
  useFocusEffect(runCheckIn);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runCheckIn();
    });
    return () => sub.remove();
  }, [runCheckIn]);
  const closeReward = () => {
    const [first] = rewards;
    if (!first) return;
    setRewards((q) => q.slice(1));
    ackRewards([first.id]).catch(() => {});
  };
  const collect = () => {
    setCollecting(true);
    collectCoins()
      .then((r) => setWallet(r.wallet))
      .catch(() => {})
      .finally(() => setCollecting(false));
  };
  const s = result.data;
  const status = s && statusOf(s);
  const nextPayday = s?.nextPayday;
  useEffect(() => {
    // 알림 예약이 실패해도 반영 창은 홈에서 뜨므로 조용히 넘긴다.
    if (!remind) cancelSeedReminder().catch(() => {});
    else if (nextPayday) scheduleSeedReminder(nextPayday).catch(() => {});
  }, [nextPayday, remind]);
  const hero = s && (
    <TodayHeroView
      today={new Date(s.date + "T12:00:00")}
      summary={{
        todayAvailable: s.todayAvailable,
        daysLeft: s.daysLeft,
      }}
      footerCaption={`마지막 확인 ${result.confirmedAt?.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) ?? ""}`}
      onDetails={() => setBasis(true)}
    />
  );
  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {result.loading && !s && <Loading />}
        <ErrorNotice error={result.error} retry={result.retry} />
        {s && status && (
          <>
            {style === "character" ? (
              <CharacterStage
                level={status.level}
                character={
                  <OutfitView
                    outfitId={wallet?.equippedOutfitId ?? null}
                    style={{ flex: 1 }}
                    accessibilityLabel={`Lv.${status.level} 캐릭터`}
                  />
                }
                coin={
                  wallet
                    ? {
                        balance: wallet.balance,
                        collectable: wallet.passive.collectable,
                        hint: collectHint(wallet),
                        busy: collecting,
                        onCollect: collect,
                        onCustomize: () => router.push("/customize"),
                      }
                    : undefined
                }
                gauge={status}
                message={messageOf(s, status.level)}
              >
                {hero}
              </CharacterStage>
            ) : (
              hero
            )}
            <Card style={{ gap: 4 }}>
              <T size={14} color={colors.textSub}>
                이번 주 쓸 수 있는 돈
              </T>
              <T size={24} weight="800" num>
                {money(s.weekAvailable)}원
              </T>
              <T size={13} color={colors.textMuted} num>
                남은 {s.weekDaysLeft}일 · 이번 주 쓴 돈 {money(s.weekSpent)}원
              </T>
              <View style={styles.divider} />
              <View style={styles.between}>
                <T size={14} color={colors.textSub}>
                  다음 수입일까지 남은 생활비
                </T>
                <T size={17} weight="700" num>
                  {money(Math.max(0, s.remaining))}원
                </T>
              </View>
            </Card>
            <SeedMoneyCard onChanged={result.retry} />
            <DayBudgets date={s.date} dailyBudget={s.dailyBudget} />
            {!s.hasTransactions && (
              <Card style={{ gap: 4 }}>
                <T weight="700">아직 기록한 거래가 없어요</T>
                <T size={13} color={colors.textMuted}>
                  아래 + 버튼으로 첫 거래를 기록해 보세요
                </T>
              </Card>
            )}
            <Sheet
              visible={basis}
              onClose={() => setBasis(false)}
              title="오늘 예산의 계산 근거"
            >
              <ScrollView contentContainerStyle={{ gap: 12 }}>
                {[
                  ["추정 잔액", s.estimatedBalance],
                  ["남겨둘 고정지출", s.reservedFixed],
                  ["카드 미결제액", s.cardUnpaid],
                  ["매달 저축할 돈", s.protectedTotal],
                  ["오늘 쓴 돈", s.todaySpent],
                ].map(([label, n]) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <T>{label}</T>
                    <T weight="700">{money(Number(n))}원</T>
                  </View>
                ))}
                <T size={13}>
                  입력한 잔액·기록 기준 추정으로, 실제 은행 잔액과 다를 수
                  있어요
                </T>
                <Button
                  label="예산 설정 수정"
                  onPress={() => {
                    setBasis(false);
                    router.push("/onboarding");
                  }}
                />
              </ScrollView>
            </Sheet>
          </>
        )}
        {/* Keeps the last card scrollable past the floating record button. */}
        <View style={{ height: FAB_SPACE }} />
      </Screen>
      <RewardModal reward={rewards[0] ?? null} onClose={closeReward} />
      <View style={styles.fabRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="거래 직접 기록"
          onPress={() => router.push("/transactions/new")}
          style={({ pressed }) => [
            styles.fab,
            floating,
            pressTransition,
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
const FAB_SIZE = 56;
const FAB_GAP = 16;
const FAB_SPACE = FAB_SIZE + FAB_GAP;
const styles = StyleSheet.create({
  // box-none lets taps beside the button reach the cards underneath.
  fabRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: FAB_GAP,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: colors.brandDark,
  },
});
// Mirrors the server rule in docs/API.md: a kept day adds 15 points, an overspent day takes 50, within 0-400.
const UP = 15;
const DOWN = 50;
const MAX = 400;
// The level is earned over days, so warnings come from today's numbers and the rest describe progression.
const LEVEL_MESSAGES: Record<Level, string> = {
  1: "광부에서 시작! 예산을 지키면 조금씩 올라가요",
  2: "한 단계 올라왔어요. 오늘도 한도 안에서 써요",
  3: "잘 버티는 중! 꾸준히 지키면 더 올라가요",
  4: "예산을 잘 지키고 있어요. 이 정도면 플렉스 가능!",
  5: "완벽해요! 예산 관리의 왕이에요",
};
function messageOf(s: Today, level: Level): string {
  if (s.remaining < 0) return "남은 생활비가 모자라요. 예산 설정을 확인해요";
  if (s.todaySpent > s.dailyBudget)
    return "오늘 예산을 넘었어요. 내일은 한도 안에서 써요";
  return LEVEL_MESSAGES[level];
}
function statusOf(s: Today): PaceStatus {
  const points = Math.min(MAX, Math.max(0, s.characterPoints ?? 0));
  const delta = s.characterDelta ?? 0;
  const yesterday =
    delta > 0
      ? `어제 지켜서 +${delta}%`
      : delta < 0
        ? `어제 넘어서 ${delta}%`
        : null;
  const up = Math.min(UP, MAX - points);
  const down = Math.min(DOWN, points);
  const today =
    s.todaySpent <= s.dailyBudget
      ? up > 0
        ? `오늘 지키면 내일 +${up}%`
        : "오늘도 지키면 최고 단계 유지"
      : down > 0
        ? `오늘 예산을 넘어서 내일 -${down}%`
        : "오늘 예산을 넘었어요";
  return pointsStatus(points, yesterday ? `${yesterday} · ${today}` : today);
}
function collectHint(w: CoinWallet): string {
  const { collectedToday, dailyLimit, nextAt } = w.passive;
  if (collectedToday >= dailyLimit) return "오늘 코인을 모두 모았어요";
  if (!nextAt) return "";
  const at = new Date(nextAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });
  return `다음 코인은 ${at}에 쌓여요`;
}
