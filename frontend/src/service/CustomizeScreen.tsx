import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { colors, radius } from "@/theme";
import { sessionGeneration } from "./api/client";
import { equipOutfit, getOutfits, purchaseOutfit } from "./coinApi";
import { DEFAULT_OUTFIT_ID, hasAnimation, outfitSource } from "./outfits";
import { PurchaseModal } from "./PurchaseModal";
import type { Outfit, OutfitList } from "./types";
import { ErrorNotice, Loading, money } from "./ui";

export function CustomizeScreen() {
  const [list, setList] = useState<OutfitList>();
  const [loadError, setLoadError] = useState<unknown>();
  const [error, setError] = useState<unknown>();
  const [selected, setSelected] = useState<string>();
  const [bought, setBought] = useState<Outfit | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const focus = useRef(0);

  const load = useCallback(() => {
    const seq = ++focus.current;
    const generation = sessionGeneration();
    setLoadError(undefined);
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
  const buy = (outfit: Outfit) =>
    run(async () => {
      const next = await purchaseOutfit(outfit.id);
      setList(next);
      setBought(outfit);
    });
  const apply = (id: string) =>
    run(async () => {
      await equipOutfit(id);
      setBought(null);
      // 홈은 돌아올 때 다시 불러 새 코스튬을 보여 준다
      router.replace("/home");
    });

  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="꾸미기" fallback="/my" />
      <Screen>
        <ErrorNotice error={loadError} retry={load} />
        {!list && !loadError && <Loading />}
        {list && selected && (
          <>
            <Card style={{ alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: "100%",
                  maxWidth: 260,
                  aspectRatio: 1,
                  borderRadius: radius.soft,
                  backgroundColor: colors.stage,
                }}
              >
                <Image
                  source={outfitSource(selected)}
                  contentFit="contain"
                  style={{ width: "100%", height: "100%" }}
                  accessibilityLabel={`${current?.name ?? "캐릭터"} 미리보기`}
                />
              </View>
              <T size={17} weight="700">
                {current?.name}
              </T>
              <T size={14} num color={colors.textSub}>
                앱에서만 쓰는 코인 {money(list.balance)}개
              </T>
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
            />
            <T size={14} weight="700" color={colors.textSub}>
              상점
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
  const short = price - balance;
  return (
    <View style={[stretch, { gap: 6 }]}>
      <Button
        label={`${money(price)}코인으로 구매`}
        disabled={busy || short > 0}
        onPress={onBuy}
      />
      {short > 0 && (
        <T size={13} color={colors.textMuted} style={{ textAlign: "center" }}>
          코인이 {money(short)}개 모자라요
        </T>
      )}
    </View>
  );
}

function Grid({
  items,
  selected,
  onSelect,
}: {
  items: Outfit[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {items.map((o) => {
        const on = o.id === selected;
        const locked = !o.owned && o.unlockLevel !== null;
        const caption = o.equipped
          ? "적용 중"
          : o.owned
            ? "보유"
            : o.unlockLevel !== null
              ? `Lv.${o.unlockLevel}`
              : `${money(o.price ?? 0)}코인`;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={o.name}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(o.id)}
            style={{
              width: "31%",
              flexGrow: 1,
              padding: 10,
              gap: 6,
              alignItems: "center",
              borderRadius: radius.soft,
              backgroundColor: on ? colors.brandSoft : colors.card,
              borderWidth: on ? 2 : 1,
              borderColor: on ? colors.brand : colors.line,
            }}
          >
            <View style={{ opacity: locked ? 0.4 : 1 }}>
              <Image
                source={outfitSource(o.id)}
                contentFit="contain"
                style={{ width: 72, height: 72 }}
              />
            </View>
            {locked && (
              <Ionicons
                name="lock-closed"
                size={16}
                color={colors.textSub}
                style={{ position: "absolute", top: 8, right: 8 }}
              />
            )}
            <T size={13} weight="600" numberOfLines={1}>
              {o.name}
            </T>
            <T size={12} color={colors.textMuted}>
              {caption}
              {o.unlockLevel === null && !hasAnimation(o.id)
                ? " · 준비 중"
                : ""}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
