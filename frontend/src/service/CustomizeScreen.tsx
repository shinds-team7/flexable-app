import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { colors, radius } from "@/theme";
import { sessionGeneration } from "./api/client";
import {
  collectCoins,
  equipOutfit,
  getOutfits,
  getWallet,
  purchaseOutfit,
} from "./coinApi";
import { DEFAULT_OUTFIT_ID } from "./outfits";
import { OutfitView } from "./OutfitView";
import { PurchaseModal } from "./PurchaseModal";
import type { CoinWallet, Outfit, OutfitList } from "./types";
import { ErrorNotice, Loading, money } from "./ui";
import { publishWallet, useWallet } from "./wallet";

export function CustomizeScreen() {
  const [list, setList] = useState<OutfitList>();
  const [loadError, setLoadError] = useState<unknown>();
  const [error, setError] = useState<unknown>();
  const [selected, setSelected] = useState<string>();
  const [bought, setBought] = useState<Outfit | null>(null);
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();
  const lock = useRef(false);
  const focus = useRef(0);

  const load = useCallback(() => {
    const seq = ++focus.current;
    const generation = sessionGeneration();
    setLoadError(undefined);
    // Only the collect button needs the wallet; without it the shop still works from the outfit list.
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
  const collect = () =>
    run(async () => {
      const generation = sessionGeneration();
      const r = await collectCoins();
      publishWallet(r.wallet, generation);
      setList((l) => l && { ...l, balance: r.wallet.balance });
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
      // 홈은 돌아올 때 다시 불러 새 코스튬을 보여 준다
      router.replace("/home");
    });

  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="상점" fallback="/home" />
      <Screen>
        <ErrorNotice error={loadError} retry={load} />
        {!list && !loadError && <Loading />}
        {list && selected && (
          <>
            <CoinCard
              balance={list.balance}
              wallet={wallet}
              busy={busy}
              onCollect={collect}
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
              레벨 코스튬
            </T>
            <Grid
              items={list.items.filter((o) => o.unlockLevel !== null)}
              selected={selected}
              onSelect={setSelected}
              empty={3}
            />
            <T size={14} weight="700" color={colors.textSub}>
              코인 코스튬
            </T>
            {list.items.some((o) => o.unlockLevel === null) ? (
              <Grid
                items={list.items.filter((o) => o.unlockLevel === null)}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <Card>
                <T color={colors.textMuted}>곧 새 코스튬이 나와요</T>
              </Card>
            )}
          </>
        )}
      </Screen>
      <PurchaseModal
        outfit={bought}
        busy={busy}
        onApply={() => bought && apply(bought.id)}
        onClose={() => setBought(null)}
      />
    </View>
  );
}

/** 잔액과 [모으기]. 지갑을 못 받았으면(코인 API가 없는 서버) 잔액만 보인다 */
function CoinCard({
  balance,
  wallet,
  busy,
  onCollect,
}: {
  balance: number;
  wallet: CoinWallet | null;
  busy: boolean;
  onCollect: () => void;
}) {
  const ready = wallet?.passive.collectable ?? 0;
  const hint = wallet && ready <= 0 ? collectHint(wallet) : "";
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <View accessible accessibilityLabel={`코인 ${balance}개`}>
          <T size={24} weight="800" num>
            🪙 {money(balance)}
          </T>
        </View>
        {hint !== "" && (
          <T size={12} color={colors.textMuted}>
            {hint}
          </T>
        )}
      </View>
      {wallet && (
        <Button
          label={ready > 0 ? `모으기 +${ready}` : "모으기"}
          disabled={busy || ready <= 0}
          onPress={onCollect}
          style={{ minHeight: 44, paddingVertical: 8, paddingHorizontal: 18 }}
        />
      )}
    </Card>
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
        label={`Lv.${outfit.unlockLevel} 달성 시 열림`}
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

/** 가지지 않은 코스튬(잠긴 레벨·안 산 상품)은 그림을 어둡게 덮고 자물쇠를 띄운다. empty 는 뒤에 붙일 준비 중 칸 수 */
function Grid({
  items,
  selected,
  onSelect,
  empty = 0,
}: {
  items: Outfit[];
  selected: string;
  onSelect: (id: string) => void;
  empty?: number;
}) {
  return (
    <View style={grid.wrap}>
      {items.map((o) => {
        const on = o.id === selected;
        const caption =
          o.unlockLevel === null
            ? `🪙 ${money(o.price ?? 0)}`
            : o.equipped
              ? "적용 중"
              : o.owned
                ? "보유"
                : `Lv.${o.unlockLevel}`;
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
              <OutfitView outfitId={o.id} play={false} style={grid.thumb} />
              {!o.owned && (
                <View style={[StyleSheet.absoluteFill, grid.shade]}>
                  <Ionicons name="lock-closed" size={18} color="#fff" />
                </View>
              )}
            </View>
            <T size={12} color={colors.textMuted}>
              {caption}
            </T>
          </Pressable>
        );
      })}
      {Array.from({ length: empty }, (_, i) => (
        <View
          key={`empty-${i}`}
          accessible
          accessibilityLabel="준비 중인 코스튬"
          style={grid.cell}
        >
          <View style={[grid.thumb, grid.center]}>
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
          </View>
          {/* 이름 칸 높이를 맞춰 옆 칸과 줄이 어긋나지 않게 한다 */}
          <T size={12} aria-hidden>
            {"\u00A0"}
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

function collectHint(w: CoinWallet): string {
  const { collectedToday, dailyLimit, nextAt } = w.passive;
  if (collectedToday >= dailyLimit) return "오늘 코인을 모두 모았어요";
  if (!nextAt) return "";
  const at = new Date(nextAt).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  });
  return `다음 코인은 ${at}에 쌓여요`;
}
