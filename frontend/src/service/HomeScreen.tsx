import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Sheet, T } from "@/components/ui";
import {
  CharacterStage,
  pointsStatus,
  type PaceStatus,
} from "@/components/CharacterStage";
import { OutfitView } from "./OutfitView";
import { RewardModal } from "./RewardModal";
import { sessionGeneration } from "./api/client";
import { ackRewards, checkIn } from "./coinApi";
import { TodayHeroView } from "@/components/TodayHeroView";
import { colors } from "@/theme";
import { useHomeStyle } from "./homeStyle";
import { SeedMoneyCard } from "./SeedMoneyCard";
import { DayBudgets } from "@/components/DayBudgets";
import { SwipePager } from "@/components/SwipePager";
import { useSeedReminderSetting } from "./reminderSetting";
import { cancelSeedReminder, scheduleSeedReminder } from "./seedReminder";
import { ErrorNotice, Loading, money, useResource } from "./ui";
import type { CoinReward, SeedMoney, Today } from "./types";
import { publishWallet, useWallet } from "./wallet";
export function HomeScreen() {
  const result = useResource<Today>("/budget/today");
  // Seed money is the hero's second page, swiped in from the right.
  const seed = useResource<SeedMoney>("/budget/seed-money");
  const [basis, setBasis] = useState(false);
  const [style] = useHomeStyle();
  const [remind] = useSeedReminderSetting();
  const wallet = useWallet();
  const [rewards, setRewards] = useState<CoinReward[]>([]);
  const checking = useRef(false);
  const characterHome = style === "character";
  // Opening or returning to the home runs check-in; the header shop button reads the wallet it returns.
  const runCheckIn = useCallback(() => {
    if (!characterHome || checking.current) return;
    checking.current = true;
    const generation = sessionGeneration();
    checkIn()
      .then((r) => {
        publishWallet(r.wallet, generation);
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
  const s = result.data;
  const status = s && statusOf(s);
  const nextPayday = s?.nextPayday;
  useEffect(() => {
    // 알림 예약이 실패해도 반영 창은 홈에서 뜨므로 조용히 넘긴다.
    if (!remind) cancelSeedReminder().catch(() => {});
    else if (nextPayday) scheduleSeedReminder(nextPayday).catch(() => {});
  }, [nextPayday, remind]);
  const hero = s && (
    <SwipePager>
      <TodayHeroView
        today={new Date(s.date + "T12:00:00")}
        summary={{
          todayAvailable: s.todayAvailable,
          daysLeft: s.daysLeft,
        }}
        footerCaption={`마지막 확인 ${result.confirmedAt?.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) ?? ""}`}
        onDetails={() => setBasis(true)}
      />
      {seed.data && (
        <SeedMoneyCard
          seed={seed.data}
          style={{ flex: 1 }}
          onChanged={() => {
            seed.retry();
            result.retry();
          }}
        />
      )}
    </SwipePager>
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
                coin={<CoinChip balance={wallet?.balance ?? 0} />}
                gauge={status}
              >
                {hero}
              </CharacterStage>
            ) : (
              hero
            )}
            <View style={styles.pair}>
              <Card style={[styles.half, s.weekAvailable < 0 && styles.navy]}>
                <T size={13} color={s.weekAvailable < 0 ? colors.onBrand : colors.textSub}>
                  이번 주 쓸 수 있는 돈
                </T>
                <T size={20} weight="800" num color={s.weekAvailable < 0 ? colors.onBrand : colors.text}>
                  {money(s.weekAvailable)}원
                </T>
                <T size={12} color={s.weekAvailable < 0 ? colors.onBrandSub : colors.textMuted} num>
                  남은 {s.weekDaysLeft}일 · 이번 주 쓴 돈 {money(s.weekSpent)}원
                </T>
              </Card>
              <Card style={[styles.half, s.remaining < 0 && styles.navy]}>
                <T size={13} color={s.remaining < 0 ? colors.onBrand : colors.textSub}>
                  다음 수입일까지
                </T>
                <T size={20} weight="800" num color={s.remaining < 0 ? colors.onBrand : colors.text}>
                  {money(Math.max(0, s.remaining))}원
                </T>
                <T size={12} color={s.remaining < 0 ? colors.onBrandSub : colors.textMuted}>
                  남은 생활비
                </T>
              </Card>
            </View>
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
      </Screen>
      <RewardModal reward={rewards[0] ?? null} onClose={closeReward} />
    </View>
  );
}
const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 12 },
  half: { flex: 1, gap: 4, padding: 16 },
  // A negative amount turns the card navy, like the empty today card.
  navy: { backgroundColor: colors.text },
  coinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
});
// Mirrors the server rule in docs/API.md: a kept day adds 15 points, an overspent day takes 50, within 0-200 (Lv.3 for now).
const UP = 15;
const DOWN = 50;
const MAX = 200;
function statusOf(s: Today): PaceStatus {
  const points = Math.min(MAX, Math.max(0, s.characterPoints ?? 0));
  const delta = s.characterDelta ?? 0;
  const yesterday =
    delta > 0
      ? `어제 지켜서 +${delta}점`
      : delta < 0
        ? `어제 넘어서 ${delta}점`
        : null;
  const up = Math.min(UP, MAX - points);
  const down = Math.min(DOWN, points);
  const today =
    s.todaySpent <= s.dailyBudget
      ? up > 0
        ? `오늘 지키면 내일 +${up}점`
        : "오늘도 지키면 최고 단계 유지"
      : down > 0
        ? `오늘 예산을 넘어서 내일 -${down}점`
        : "오늘 예산을 넘었어요";
  return pointsStatus(points, yesterday ? `${yesterday} · ${today}` : today);
}
/** Coin balance floating over the character video; it opens the coin history, where the shop button sits. */
function CoinChip({ balance }: { balance: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`보유 코인 ${money(balance)}개, 코인 내역 보기`}
      onPress={() => router.push("/coins/history")}
      hitSlop={8}
      style={styles.coinChip}
    >
      <T size={14} weight="800" num>
        🪙 {money(balance)}
      </T>
    </Pressable>
  );
}
