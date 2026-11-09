import Ionicons from "@expo/vector-icons/Ionicons";
import { randomUUID } from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { levelLabel } from "@/components/LevelIcon";
import { colors, radius } from "@/theme";
import { ApiError, sessionGeneration } from "./api/client";
import {
  claimAdBonus,
  equipOutfit,
  getOutfits,
  getWallet,
  purchaseOutfit,
} from "./coinApi";
import { AdRewardCard } from "./AdRewardCard";
import { showRewardedAd } from "./adReward";
import { useSession } from "./Session";
import { ATTENDANCE_OUTFIT_ID, DEFAULT_OUTFIT_ID } from "./outfits";
import { OutfitView } from "./OutfitView";
import { PurchaseModal } from "./PurchaseModal";
import { RewardModal } from "./RewardModal";
import type { Outfit, OutfitList } from "./types";
import { ErrorNotice, Loading, money } from "./ui";
import { publishWallet, useWallet } from "./wallet";

// 레벨 코스튬은 6단계이며, 서버에 아직 없는 칸은 준비 중인 잠금 칸으로 표시한다.
const LEVEL_SLOTS = 6;

export function CustomizeScreen() {
  const [list, setList] = useState<OutfitList>();
  const [loadError, setLoadError] = useState<unknown>();
  const [error, setError] = useState<unknown>();
  const [selected, setSelected] = useState<string>();
  const [bought, setBought] = useState<Outfit | null>(null);
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();
  const { user } = useSession();
  const [adMessage, setAdMessage] = useState("");
  // 광고를 다 보고 받은 코인 안내("+15 코인을 받았어요")
  const [adEarned, setAdEarned] = useState<{
    total: number;
    bonus: number;
  } | null>(null);
  const lock = useRef(false);
  const focus = useRef(0);

  const load = useCallback(() => {
    const seq = ++focus.current;
    const generation = sessionGeneration();
    setLoadError(undefined);
    // Only the ad button needs the wallet; without it the shop still works from the outfit list.
    getWallet()
      .then((w) => publishWallet(w, generation))
      .catch(() => {});
    getOutfits()
      .then((data) => {
        if (seq !== focus.current || generation !== sessionGeneration()) return;
        setList(data);
        // 처음에는 적용 중인 코스튬을 미리보기로 보여 준다
        setSelected(
          (prev) =>
            prev ?? data.items.find((o) => o.equipped)?.id ?? DEFAULT_OUTFIT_ID,
        );
      })
      .catch((e) => {
        if (seq === focus.current && generation === sessionGeneration())
          setLoadError(e);
      });
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        ++focus.current;
      };
    }, [load]),
  );

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

  const current = list?.items.find((o) => o.id === selected);
  const levels = list?.items.filter((o) => o.unlockLevel !== null) ?? [];
  const challenges =
    list?.items.filter((o) => o.id === ATTENDANCE_OUTFIT_ID) ?? [];
  // 서버의 업데이트 순서를 각 그룹 안에서 유지한다. 구매·해금 응답을 받으면 즉시 재배치한다.
  const items = [
    ...(list?.items.filter((o) => o.owned) ?? []),
    ...(list?.items.filter((o) => !o.owned) ?? []),
  ];
  const placeholders = [
    ...Array<string>(Math.max(0, LEVEL_SLOTS - levels.length)).fill(
      "레벨 달성 시 해금",
    ),
    ...Array<string>(Math.max(0, 2 - challenges.length)).fill(
      "도전 과제 달성 시 해금",
    ),
  ];
  // The outfit list carries the balance shown here; the shared wallet follows so the home and header stay in step.
  const buy = (outfit: Outfit) =>
    run(async () => {
      const generation = sessionGeneration();
      const next = await purchaseOutfit(outfit.id);
      setList(next);
      if (wallet)
        publishWallet({ ...wallet, balance: next.balance }, generation);
      setBought(outfit);
    });
  // 기본 10코인은 구글 검증 콜백이 서버에서 지급하고, 앱은 광고가 열려 있던 시간을 보내 보너스(+5·+10)를 받는다.
  // 콜백이 몇 초 늦을 수 있어 보너스 요청이 409 AD_NOT_REWARDED면 잠시 뒤 다시 보낸다. 받으면 자동 적립 안내를 띄운다.
  const watchAd = () =>
    run(async () => {
      if (!user) return;
      setAdMessage("");
      const generation = sessionGeneration();
      const before = wallet?.ad.rewardedToday ?? 0;
      const requestId = randomUUID();
      const { result, seconds } = await showRewardedAd(user.id);
      if (result === "failed") {
        setAdMessage("광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요");
        return;
      }
      if (result === "closed") {
        setAdMessage("광고를 끝까지 봐야 코인을 받아요");
        return;
      }
      for (let i = 0; i < 8; i++) {
        try {
          const got = await claimAdBonus(requestId, seconds);
          publishWallet(got.wallet, generation);
          setList((l) => l && { ...l, balance: got.wallet.balance });
          if (generation === sessionGeneration())
            setAdEarned({ total: got.total, bonus: got.bonus });
          return;
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== "AD_NOT_REWARDED") {
            // 보너스 요청만 실패했으면 기본 보상이 들어왔는지 지갑으로 확인한다
            const w = await getWallet();
            publishWallet(w, generation);
            setList((l) => l && { ...l, balance: w.balance });
            if (w.ad.rewardedToday > before) {
              if (generation === sessionGeneration())
                setAdEarned({ total: w.ad.reward, bonus: 0 });
              return;
            }
          }
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setAdMessage(
        "코인 지급이 조금 늦어지고 있어요. 잠시 후 다시 확인해 주세요",
      );
    });
  const apply = (id: string) =>
    run(async () => {
      const generation = sessionGeneration();
      const next = await equipOutfit(id);
      if (wallet)
        publishWallet(
          { ...wallet, equippedOutfitId: next.equippedOutfitId },
          generation,
        );
      setBought(null);
      // 홈은 돌아올 때 다시 불러 새 코스튬을 보여 준다. 상점 아래 코인 내역까지 걷어 내고 홈으로 간다
      router.dismissTo("/home");
    });

  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="상점" fallback="/home" />
      <Screen>
        <ErrorNotice error={loadError} retry={load} />
        {!list && !loadError && <Loading />}
        {list && selected && (
          <>
            <AdRewardCard
              balance={list.balance}
              wallet={wallet}
              busy={busy}
              message={adMessage}
              onWatch={watchAd}
            />
            <Card style={{ alignItems: "center", gap: 12 }}>
              <OutfitView
                outfitId={selected}
                accessibilityLabel={`${current?.name ?? "캐릭터"} 미리보기`}
                style={{
                  width: "100%",
                  aspectRatio: 16 / 9,
                  borderRadius: radius.soft,
                  overflow: "hidden",
                  backgroundColor: colors.stage,
                }}
              />
              {current && (
                <Action
                  outfit={current}
                  balance={list.balance}
                  busy={busy}
                  onBuy={() => buy(current)}
                  onApply={() => apply(current.id)}
                />
              )}
            </Card>
            <ErrorNotice error={error} />
            <T size={14} weight="700" color={colors.textSub}>
              코스튬
            </T>
            <Grid
              items={items}
              selected={selected}
              onSelect={setSelected}
              placeholders={placeholders}
            />
          </>
        )}
      </Screen>
      <PurchaseModal
        outfit={bought}
        busy={busy}
        onApply={() => bought && apply(bought.id)}
        onClose={() => setBought(null)}
      />
      <RewardModal
        reward={
          adEarned && {
            id: 0,
            reason: "AD_REWARD",
            amount: adEarned.total,
            refDate: null,
            createdAt: new Date().toISOString(),
          }
        }
        title={adEarned ? `+${adEarned.total} 코인을 받았어요` : undefined}
        // 제목에 받은 코인이 있어 본문·"+N" 줄은 두지 않는다(11-08)
        plain
        onClose={() => setAdEarned(null)}
      />
    </View>
  );
}

function Action({
  outfit,
  balance,
  busy,
  onBuy,
  onApply,
}: {
  outfit: Outfit;
  balance: number;
  busy: boolean;
  onBuy: () => void;
  onApply: () => void;
}) {
  const stretch = { alignSelf: "stretch" } as const;
  if (outfit.equipped)
    return <Button label="적용 중" variant="soft" disabled style={stretch} />;
  if (outfit.owned)
    return (
      <Button
        label="적용하기"
        disabled={busy}
        onPress={onApply}
        style={stretch}
      />
    );
  if (outfit.unlockLevel !== null)
    return (
      <Button
        label={`${levelLabel(outfit.unlockLevel)} 달성 시 열림`}
        variant="soft"
        icon="lock-closed"
        disabled
        style={stretch}
      />
    );
  if (outfit.id === ATTENDANCE_OUTFIT_ID)
    return (
      <Button
        label="도전 과제 달성 시 해금"
        variant="soft"
        icon="lock-closed"
        disabled
        style={stretch}
      />
    );
  const price = outfit.price ?? 0;
  return (
    <Button
      label={`${money(price)}코인으로 구매`}
      disabled={busy || price > balance}
      onPress={onBuy}
      style={stretch}
    />
  );
}

/** 잠긴 출석 보상은 빈 자물쇠 칸, 나머지 미보유 코스튬은 그림 위에 자물쇠. 준비 중인 칸은 목록 맨 뒤. */
function Grid({
  items,
  selected,
  onSelect,
  placeholders,
}: {
  items: Outfit[];
  selected: string;
  onSelect: (id: string) => void;
  placeholders: string[];
}) {
  return (
    <View style={grid.wrap}>
      {items.map((o) => {
        const on = o.id === selected;
        const hideLocked = o.id === ATTENDANCE_OUTFIT_ID;
        const label =
          o.unlockLevel !== null
            ? "레벨 달성 시 해금"
            : hideLocked
              ? "도전 과제 달성 시 해금"
              : o.equipped
                ? "적용 중"
                : o.owned
                  ? "보유 중"
                  : `🪙 ${money(o.price ?? 0)}`;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={o.name}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(o.id)}
            style={[grid.cell, on && grid.on]}
          >
            <View style={grid.thumbBox}>
              {hideLocked && !o.owned ? (
                <View style={[grid.thumb, grid.center]}>
                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color={colors.textMuted}
                  />
                </View>
              ) : (
                <OutfitView outfitId={o.id} play={false} style={grid.thumb} />
              )}
              {!o.owned && !hideLocked && (
                <View style={[StyleSheet.absoluteFill, grid.shade]}>
                  <Ionicons name="lock-closed" size={18} color="#fff" />
                </View>
              )}
            </View>
            <T size={12} color={colors.textMuted}>
              {label}
            </T>
          </Pressable>
        );
      })}
      {placeholders.map((caption, i) => (
        <View
          key={`empty-${i}`}
          accessible
          accessibilityLabel={`준비 중인 코스튬, ${caption}`}
          style={grid.cell}
        >
          <View style={[grid.thumb, grid.center]}>
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
          </View>
          {/* 이름 칸 높이를 맞춰 옆 칸과 줄이 어긋나지 않게 한다 */}
          <T size={12} color={colors.textMuted}>
            {caption}
          </T>
        </View>
      ))}
    </View>
  );
}

const grid = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: {
    width: "31%",
    padding: 10,
    gap: 6,
    alignItems: "center",
    borderRadius: radius.soft,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  on: {
    backgroundColor: colors.brandSoft,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  thumbBox: { width: "100%" },
  thumb: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.soft,
    overflow: "hidden",
    backgroundColor: colors.stage,
  },
  shade: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.soft,
    backgroundColor: "rgba(16, 24, 40, 0.32)",
  },
  center: { alignItems: "center", justifyContent: "center" },
});
