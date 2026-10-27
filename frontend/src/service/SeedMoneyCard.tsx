import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Button, RadioMark, T } from "@/components/ui";
import { colors, floating, radius } from "@/theme";
import { styles as heroStyles } from "@/components/HomeStyles";
import { api } from "./api/client";
import { ErrorNotice, MoneyField, money } from "./ui";
import type { SeedChoice, SeedMoney } from "./types";
/**
 * 시드머니 합계와, 수입일 전날부터 뜨는 반영 창. 반영하기 전까지는 홈에 올 때마다 다시 뜬다
 * (다음 수입일 전날이 되면 서버가 지난 주기를 넘긴다). 반영한 돈은 생활비 잔액에서 빠지므로 onChanged로 홈과 시드머니를 다시 읽는다.
 * seed는 홈이 GET /budget/seed-money로 읽어 넘긴다(서버가 이 기능 전이면 홈이 카드를 그리지 않는다).
 */
export function SeedMoneyCard({
  seed,
  onChanged,
  style,
}: {
  seed: SeedMoney;
  onChanged: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [later, setLater] = useState<string | null>(null);
  const pending = seed.pending;
  return (
    <>
      {/* Same blue panel as the today card it sits beside. */}
      <View style={[heroStyles.hero, style]}>
        <T size={15} weight="700" color={colors.onBrand}>
          시드머니
        </T>
        <View style={styles.amountRow}>
          <T
            size={38}
            weight="800"
            color={colors.onBrand}
            num
            style={{ flex: 1, lineHeight: 46 }}
            accessibilityLabel={`시드머니 ${money(seed.total)}원`}
          >
            {money(seed.total)}
            <T size={22} weight="700" color={colors.onBrand}>
              {" "}
              원
            </T>
          </T>
          <View style={styles.icon}>
            <Ionicons name="wallet-outline" size={32} color={colors.onBrand} />
          </View>
        </View>
        <View style={[heroStyles.heroFoot, styles.foot]}>
          <T size={12} color={colors.onBrandSub} num>
            모아둔 돈 {money(seed.base)}원 + 반영한 돈 {money(seed.saved)}원 ·
            매달 {money(seed.monthlyGoal)}원 저축
          </T>
        </View>
      </View>
      {pending && later !== pending.cycleEnd && (
        <ReflectModal
          // A new cycle starts with a fresh choice.
          key={pending.cycleEnd}
          pending={pending}
          onLater={() => setLater(pending.cycleEnd)}
          onDone={onChanged}
        />
      )}
    </>
  );
}
type Pending = NonNullable<SeedMoney["pending"]>;
/**
 * 가운데 모달. 바깥을 눌러도 닫히지 않고 [나중에]로만 닫는다(Android 뒤로 가기도 나중에와 같다).
 * 금액은 서버가 정한 값을 그대로 보여 준다. 직접 입력만 사용자가 금액을 넣는다.
 */
function ReflectModal({
  pending,
  onLater,
  onDone,
}: {
  pending: Pending;
  onLater: () => void;
  onDone: () => void;
}) {
  const [choice, setChoice] = useState<SeedChoice>("GOAL");
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [, month, day] = pending.payday.split("-").map(Number);
  const confirm = async () => {
    if (busy) return;
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
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const options: [SeedChoice, string, string | null, string | null][] = [
    ["GOAL", "매달 저축할 돈", `${money(pending.goalAmount)}원`, null],
    [
      "ALL",
      "실제로 모은 돈 전부",
      `${money(pending.allAmount)}원`,
      "매달 저축할 돈 + 이번 달 남은 생활비",
    ],
    ["MANUAL", "직접 입력", null, "옮길 금액을 내가 정해요"],
  ];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater}>
      <KeyboardAvoidingView
        style={styles.dim}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.dialog, floating]} accessibilityViewIsModal>
          <ScrollView
            contentContainerStyle={{ gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 6 }}>
              <T size={18} weight="700" accessibilityRole="header">
                이번 달 모은 돈을 시드머니에 반영할까요?
              </T>
              <T size={14} color={colors.textSub} style={{ lineHeight: 21 }}>
                {month}월 {day}일 수입일 전날까지의 기록 기준이에요. 반영한 돈은
                생활비 잔액에서 빠져요
              </T>
            </View>
            <View style={styles.options} accessibilityRole="radiogroup">
              {options.map(([key, label, value, caption], i) => {
                const on = choice === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityLabel={value ? `${label} ${value}` : label}
                    accessibilityState={{ checked: on, disabled: busy }}
                    aria-checked={on}
                    disabled={busy}
                    onPress={() => setChoice(key)}
                    style={[
                      styles.option,
                      i > 0 && styles.optionLine,
                      on && { backgroundColor: colors.brandSoft },
                    ]}
                  >
                    <RadioMark on={on} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T size={16} weight={on ? "700" : "500"}>
                        {label}
                      </T>
                      {caption && (
                        <T size={13} color={colors.textMuted}>
                          {caption}
                        </T>
                      )}
                    </View>
                    {value && (
                      <T size={16} weight="700" num>
                        {value}
                      </T>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {choice === "MANUAL" && (
              <MoneyField
                label="반영할 금액 (원)"
                value={amount}
                onChange={setAmount}
              />
            )}
            <ErrorNotice error={error} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                label="나중에"
                variant="soft"
                disabled={busy}
                style={{ flex: 1 }}
                onPress={onLater}
              />
              <Button
                label={busy ? "반영하는 중…" : "반영하기"}
                disabled={busy}
                style={{ flex: 1 }}
                onPress={confirm}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.soft,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  // The caption may wrap to two lines, so the footer sits at the bottom instead of a fixed gap.
  foot: { marginTop: "auto" },
  dim: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(16,26,51,0.45)",
  },
  dialog: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "92%",
    alignSelf: "center",
    backgroundColor: colors.card,
    borderRadius: radius.dialog,
    padding: 22,
  },
  options: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.soft,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionLine: { borderTopWidth: 1, borderTopColor: colors.line },
});
