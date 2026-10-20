import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Sheet, T } from "@/components/ui";
import { colors, radius } from "@/theme";
import { api } from "./api/client";
import { ErrorNotice, MoneyField, money, useResource } from "./ui";
import type { SeedChoice, SeedMoney } from "./types";
/**
 * 시드머니 합계와, 수입일 전날부터 뜨는 반영 창. 반영하기 전까지는 홈에 올 때마다 다시 뜬다
 * (다음 수입일 전날이 되면 서버가 지난 주기를 넘긴다). 반영한 돈은 생활비 잔액에서 빠지므로 onChanged로 홈을 다시 읽는다.
 */
export function SeedMoneyCard({ onChanged }: { onChanged: () => void }) {
  const result = useResource<SeedMoney>("/budget/seed-money");
  const [later, setLater] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const seed = result.data;
  // 서버가 이 기능 전이면(404) 아무것도 보이지 않는다.
  if (!seed) return null;
  const pending = seed.pending;
  const confirm = async (choice: SeedChoice) => {
    if (!pending || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await api("/budget/seed-money/entries", {
        method: "POST",
        body: {
          cycleEnd: pending.cycleEnd,
          choice,
          ...(choice === "MANUAL" ? { amount } : {}),
        },
      });
      setManual(false);
      result.retry();
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const [, month, day] = pending?.payday.split("-").map(Number) ?? [];
  return (
    <>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={styles.icon}>
          <Ionicons name="wallet-outline" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={14} color={colors.textSub}>
            시드머니
          </T>
          <T size={20} weight="800" num>
            {money(seed.total)}원
          </T>
          <T size={13} color={colors.textMuted} num>
            모아둔 돈 {money(seed.base)}원 + 반영한 돈 {money(seed.saved)}원 ·
            매달 {money(seed.monthlyGoal)}원 저축
          </T>
        </View>
      </Card>
      <Sheet
        visible={!!pending && later !== pending.cycleEnd}
        onClose={() => setLater(pending?.cycleEnd ?? null)}
        title="이번 달 모은 돈을 시드머니에 반영할까요?"
      >
        {pending && (
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <T size={13} color={colors.textMuted}>
              {month}월 {day}일 수입일 전날까지의 기록 기준이에요. 반영한 돈은
              생활비 잔액에서 빠져요
            </T>
            <Button
              label={`매달 저축할 돈 ${money(pending.goalAmount)}원`}
              disabled={busy}
              onPress={() => confirm("GOAL")}
            />
            <Button
              label={`실제로 모은 돈 전부 ${money(pending.allAmount)}원`}
              variant="soft"
              disabled={busy}
              onPress={() => confirm("ALL")}
            />
            <T size={12} color={colors.textMuted}>
              매달 저축할 돈 + 이번 달 남은 생활비
            </T>
            {manual ? (
              <>
                <MoneyField
                  label="반영할 금액 (원)"
                  value={amount}
                  onChange={setAmount}
                />
                <Button
                  label="이 금액으로 반영"
                  variant="soft"
                  disabled={busy}
                  onPress={() => confirm("MANUAL")}
                />
              </>
            ) : (
              <Button
                label="직접 입력"
                variant="ghost"
                disabled={busy}
                onPress={() => setManual(true)}
              />
            )}
            <ErrorNotice error={error} />
            <Button
              label="나중에"
              variant="ghost"
              disabled={busy}
              onPress={() => setLater(pending.cycleEnd)}
            />
          </ScrollView>
        )}
      </Sheet>
    </>
  );
}
const styles = StyleSheet.create({
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
