import { useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { Button, Card, T } from "@/components/ui";
import { colors } from "@/theme";
import { won } from "@/utils/format";
import { api, sessionGeneration } from "./api/client";
import { occurredAtFor } from "./occurredAt";
import { useSession } from "./Session";
import { errorText, whenText, type Proposal } from "./chatbot/model";

export function IncomeActionCard({ action, disabled, onSaved }: {
  action: Proposal;
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const session = useSession();
  const [key] = useState(() => Crypto.randomUUID());
  const [status, setStatus] = useState<"ready" | "saving" | "done" | "cancelled">("ready");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const tx = action.incomeTransaction;
  const settings = action.incomeSettings;
  const save = async () => {
    if (lock.current || status !== "ready") return;
    lock.current = true;
    setStatus("saving");
    setError("");
    const generation = sessionGeneration();
    try {
      if (action.type === "INCOME_SETTINGS" && settings) {
        await api("/budget/settings/income", { method: "PATCH", body: settings });
      } else if (action.type === "INCOME_TRANSACTION" && tx) {
        if (tx.operation === "CREATE") {
          await api("/transactions", { method: "POST", key, body: {
            type: "INCOME", title: tx.title, amount: tx.amount, categoryId: tx.categoryId,
            occurredAt: occurredAtFor(tx.date, undefined, new Date()),
          } });
        } else {
          // Recheck the type; never convert an expense or replace untouched fields/memo.
          const current = await api<{ type: string; occurredAt: string }>(`/transactions/${tx.transactionId}`);
          if (current.type !== "INCOME") throw new Error("수입 기록이 바뀌었어요. 다시 요청해 주세요.");
          const body = {
            ...(tx.changes.includes("AMOUNT") ? { amount: tx.amount } : {}),
            ...(tx.changes.includes("TITLE") ? { title: tx.title } : {}),
            ...(tx.changes.includes("CATEGORY") ? { categoryId: tx.categoryId } : {}),
            ...(tx.changes.includes("DATE") ? { occurredAt: occurredAtFor(tx.date, current.occurredAt, new Date()) } : {}),
          };
          await api(`/transactions/${tx.transactionId}`, { method: "PATCH", body });
        }
      } else throw new Error("수입 제안을 다시 요청해 주세요.");
      if (generation !== sessionGeneration()) return;
      session.invalidate();
      setStatus("done");
      onSaved?.();
    } catch (e) {
      if (generation !== sessionGeneration()) return;
      setError(errorText(e));
      setStatus("ready");
    } finally { lock.current = false; }
  };
  return <Card style={{ gap: 10 }}>
    <T weight="800">{settings ? "월 수입 설정" : tx?.operation === "UPDATE" ? "수입 기록 수정" : "수입 기록 등록"}</T>
    {settings ? <>
      <T>월 수입액 {won(settings.expectedIncomeAmount)}원 → {won(settings.incomeAmount)}원</T>
      <T>수입일 매달 {settings.expectedPayday}일 → {settings.payday}일</T>
    </> : tx ? <>
      <T>{whenText(tx.date)} · {tx.title}</T>
      <T>{tx.category} · {won(tx.amount)}원</T>
    </> : null}
    {error ? <T color={colors.danger}>{error}</T> : null}
    {status === "done" || status === "cancelled" ? <T color={colors.textMuted}>{status === "done" ? "반영했어요" : "취소했어요"}</T> :
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button label={status === "saving" ? "반영 중" : "반영"} disabled={disabled || status === "saving"} onPress={() => void save()} /></View>
        <View style={{ flex: 1 }}><Button label="취소" variant="neutral" disabled={disabled || status === "saving"} onPress={() => setStatus("cancelled")} /></View>
      </View>}
  </Card>;
}
