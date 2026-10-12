import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { Button, Card, T } from "@/components/ui";
import { useBudgetDraft } from "./BudgetDraft";
import { api } from "./api/client";
import { useSession } from "./Session";
import {
  DateTimeField,
  ErrorNotice,
  Field,
  Guard,
  Loading,
  MoneyField,
  money,
  seoulTime,
  validTime,
  useResource,
} from "./ui";
import type { Today } from "./types";
import { colors } from "@/theme";
const steps = [
  "index",
  "balance",
  "income",
  "fixed",
  "card",
  "protect",
  "done",
] as const;
type Step = (typeof steps)[number];
const path = (step: string) =>
  step === "index"
    ? ("/onboarding" as const)
    : (`/onboarding/${step}` as "/onboarding/balance");
export function OnboardingScreen({ step }: { step: Step }) {
  return (
    <Guard>
      <Content step={step} />
    </Guard>
  );
}
function Content({ step }: { step: Step }) {
  const state = useBudgetDraft();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const saved = useRef(false);
  const [error, setError] = useState<unknown>();
  const [clock, setClock] = useState<string>();
  if (!state.draft)
    return state.error ? <ErrorNotice error={state.error} /> : <Loading />;
  const { value: v, editing } = state.draft;
  const set = state.set;
  const idx = steps.indexOf(step);
  const next = async () => {
    if (lock.current) return;
    setError(undefined);
    if (step === "index") {
      lock.current = true;
      setBusy(true);
      try {
        if (state.draft?.editing && state.draft.step !== "index") {
          router.push(path(state.draft.step));
        } else if (session.user?.onboarded) {
          await state.begin(true);
          router.push("/onboarding/balance");
        } else if (state.draft?.step && state.draft.step !== "index")
          router.push(path(state.draft.step));
        else {
          await state.begin(false);
          router.push("/onboarding/balance");
        }
      } catch (e) {
        setError(e);
      } finally {
        lock.current = false;
        setBusy(false);
      }
      return;
    }
    if (step === "balance" && clock !== undefined && !validTime(clock)) {
      setError("기준 날짜와 시간을 다시 확인해 주세요");
      return;
    }
    const amount =
      step === "balance"
        ? v.balance
        : step === "income"
          ? v.incomeAmount
          : step === "card"
            ? v.cardUnpaid
            : undefined;
    if (
      amount !== undefined &&
      (!Number.isSafeInteger(amount) || amount < 0 || amount >= 1e12)
    ) {
      setError("금액은 0원 이상, 1조 미만으로 입력해 주세요");
      return;
    }
    if (
      step === "income" &&
      (!Number.isInteger(v.payday) || v.payday < 1 || v.payday > 31)
    ) {
      setError("수입일은 1~31일로 입력해 주세요");
      return;
    }
    if (
      step === "fixed" &&
      v.fixedExpenses.some(
        (x) =>
          !x.name.trim() ||
          x.amount < 1 ||
          x.amount >= 1e12 ||
          !Number.isInteger(x.day) ||
          x.day < 1 ||
          x.day > 31,
      )
    ) {
      setError("고정지출의 이름, 금액, 날짜를 확인해 주세요");
      return;
    }
    if (
      step === "protect" &&
      v.protectedItems.some(
        (x) => !x.name.trim() || x.amount < 1 || x.amount >= 1e12,
      )
    ) {
      setError("보호할 항목의 이름과 금액을 확인해 주세요");
      return;
    }
    if (step === "protect") {
      lock.current = true;
      setBusy(true);
      try {
        if (!saved.current) {
          await api("/budget/settings", { method: "PUT", body: v });
          saved.current = true;
        }
        await session.refreshUser();
        session.invalidate();
        await state.reset();
        router.replace("/onboarding/done");
      } catch (e) {
        setError(e);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    } else {
      const dest = steps[idx + 1];
      set(v, dest);
      router.push(path(dest));
    }
  };
  if (step === "done") return <Done />;
  const title = {
    index: session.user?.onboarded
      ? "예산을 다시 맞춰요"
      : "오늘 쓸 수 있는 돈을 알아볼까요?",
    balance: "지금 통장에 얼마 있나요?",
    income: "다음 수입은 언제 들어오나요?",
    fixed: "매달 꼭 나가는 돈이 있나요?",
    card: "아직 내지 않은 카드값이 있나요?",
    protect: "쓰지 않고 지킬 돈이 있나요?",
  }[step];
  const subtitle = {
    index:
      "입력한 정보로 오늘 쓸 수 있는 돈을 계산해요. 실제 은행 잔액과 다를 수 있어요",
    balance: "은행 앱에서 확인한 금액을 그대로 입력하면 돼요",
    income: "예정 수입액은 지금 잔액에 더하지 않아요",
    fixed: "없으면 다음으로 넘어가도 돼요",
    card: "이미 사용했지만 아직 결제되지 않은 금액을 적어 주세요",
    protect: "비상금이나 저축처럼 따로 남겨둘 돈이에요",
  }[step];
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <OnboardingFrame
        step={idx + 1}
        total={7}
        title={title}
        subtitle={subtitle}
        backFallback={editing ? "/my" : "/"}
        cta={
          busy
            ? "저장 중…"
            : step === "index"
              ? state.draft.step !== "index"
                ? "이어서 설정하기"
                : "시작하기"
              : step === "protect"
                ? "완료"
                : "다음"
        }
        disabled={busy}
        onNext={next}
      >
        {step === "balance" && (
          <>
            <MoneyField
              label="현재 잔액 (원)"
              value={v.balance}
              onChange={(balance) => set({ ...v, balance })}
            />
            <DateTimeField
              label="잔액 기준"
              value={
                clock ??
                new Date(new Date(v.balanceAt).getTime() + 9 * 3600000)
                  .toISOString()
                  .slice(0, 16)
              }
              onChange={(s) => {
                setClock(s);
                if (validTime(s)) set({ ...v, balanceAt: s + ":00+09:00" });
              }}
            />
            <Button
              label="지금으로 맞추기"
              variant="soft"
              onPress={() => {
                const t = seoulTime();
                setClock(t);
                set({ ...v, balanceAt: t + ":00+09:00" });
              }}
            />
            <T size={13}>
              기준 시각 이전 거래는 잔액에 이미 반영된 것으로 봐요
            </T>
            {v.balance === 0 && (
              <T color={colors.warn}>
                잔액이 0원이면 오늘 쓸 수 있는 돈도 0원이에요
              </T>
            )}
          </>
        )}
        {step === "income" && (
          <>
            <Field
              label="매달 수입일 (1~31)"
              keyboardType="number-pad"
              value={String(v.payday || "")}
              onChangeText={(s) =>
                set({
                  ...v,
                  payday: Number(s.replace(/[^0-9]/g, "").slice(0, 2)),
                })
              }
            />
            <Button
              label="매달 말일"
              variant="soft"
              onPress={() => set({ ...v, payday: 31 })}
            />
            {v.payday === 31 && <T>매달 말일에 맞춰 계산해요</T>}
            <MoneyField
              label="예정 수입액 (원)"
              value={v.incomeAmount}
              onChange={(incomeAmount) => set({ ...v, incomeAmount })}
            />
          </>
        )}
        {step === "fixed" && (
          <>
            {v.fixedExpenses.map((x, i) => (
              <Card key={i} style={{ gap: 12 }}>
                <Field
                  label={`고정지출 ${i + 1} 이름`}
                  maxLength={40}
                  value={x.name}
                  onChangeText={(name) =>
                    set({
                      ...v,
                      fixedExpenses: v.fixedExpenses.map((a, j) =>
                        j === i ? { ...a, name } : a,
                      ),
                    })
                  }
                />
                <MoneyField
                  label={`고정지출 ${i + 1} 금액 (원)`}
                  value={x.amount}
                  onChange={(amount) =>
                    set({
                      ...v,
                      fixedExpenses: v.fixedExpenses.map((a, j) =>
                        j === i ? { ...a, amount } : a,
                      ),
                    })
                  }
                />
                <Field
                  label={`고정지출 ${i + 1} 날짜 (31 = 말일)`}
                  keyboardType="number-pad"
                  value={String(x.day || "")}
                  onChangeText={(s) =>
                    set({
                      ...v,
                      fixedExpenses: v.fixedExpenses.map((a, j) =>
                        j === i
                          ? {
                              ...a,
                              day: Number(s.replace(/[^0-9]/g, "").slice(0, 2)),
                            }
                          : a,
                      ),
                    })
                  }
                />
                <Button
                  label="항목 지우기"
                  variant="ghost"
                  onPress={() =>
                    set({
                      ...v,
                      fixedExpenses: v.fixedExpenses.filter((_, j) => j !== i),
                    })
                  }
                />
              </Card>
            ))}
            <Button
              label="+ 고정지출 추가"
              variant="soft"
              disabled={v.fixedExpenses.length >= 30}
              onPress={() =>
                set({
                  ...v,
                  fixedExpenses: [
                    ...v.fixedExpenses,
                    { name: "", amount: 0, day: 1 },
                  ],
                })
              }
            />
          </>
        )}
        {step === "card" && (
          <MoneyField
            label="카드 미결제액 (원)"
            value={v.cardUnpaid}
            onChange={(cardUnpaid) => set({ ...v, cardUnpaid })}
          />
        )}
        {step === "protect" && (
          <>
            {v.protectedItems.map((x, i) => (
              <Card key={i} style={{ gap: 12 }}>
                <Field
                  label={`보호 항목 ${i + 1} 이름`}
                  maxLength={40}
                  value={x.name}
                  onChangeText={(name) =>
                    set({
                      ...v,
                      protectedItems: v.protectedItems.map((a, j) =>
                        j === i ? { ...a, name } : a,
                      ),
                    })
                  }
                />
                <MoneyField
                  label={`보호 항목 ${i + 1} 금액 (원)`}
                  value={x.amount}
                  onChange={(amount) =>
                    set({
                      ...v,
                      protectedItems: v.protectedItems.map((a, j) =>
                        j === i ? { ...a, amount } : a,
                      ),
                    })
                  }
                />
                <Button
                  label="항목 지우기"
                  variant="ghost"
                  onPress={() =>
                    set({
                      ...v,
                      protectedItems: v.protectedItems.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                />
              </Card>
            ))}
            <Button
              label="+ 보호할 돈 추가"
              variant="soft"
              disabled={v.protectedItems.length >= 30}
              onPress={() =>
                set({
                  ...v,
                  protectedItems: [
                    ...v.protectedItems,
                    { name: "", amount: 0 },
                  ],
                })
              }
            />
          </>
        )}
        <ErrorNotice error={error ?? state.error} />
      </OnboardingFrame>
    </KeyboardAvoidingView>
  );
}
function Done() {
  const { data, error, loading, retry } = useResource<Today>("/budget/today");
  return (
    <OnboardingFrame
      step={7}
      total={7}
      title="오늘의 예산을 준비했어요"
      subtitle="입력한 잔액·기록 기준 추정"
      backFallback="/"
      cta="홈으로"
      onNext={() => router.replace("/")}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} retry={retry} />
      ) : (
        data && (
          <Card style={{ gap: 12 }}>
            <T>오늘 쓸 수 있는 돈</T>
            <T size={32} weight="800">
              {money(data.todayAvailable)}원
            </T>
            {data.shortage > 0 && (
              <T color={colors.danger}>
                다음 수입일까지 {money(data.shortage)}원이 부족해요
              </T>
            )}
            <T>다음 수입일까지 {data.daysLeft}일 남았어요</T>
          </Card>
        )
      )}
    </OnboardingFrame>
  );
}
