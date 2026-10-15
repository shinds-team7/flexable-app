import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, ConfirmModal, Segment, T } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { goBack } from "@/components/SubHeader";
import { colors } from "@/theme";
import { api } from "./api/client";
import { CategorySheet } from "./CategorySheet";
import { DateTimeField } from "./DateTimeField";
import { useSession } from "./Session";
import {
  CategoryIcon,
  digits,
  ErrorNotice,
  Field,
  Loading,
  money,
  Page,
  toSeoulInput,
  useResource,
  validTime,
} from "./ui";
import type { Category, Kind, Transaction } from "./types";
export function TransactionForm({
  id,
  initialType,
}: {
  id?: string;
  initialType?: Kind;
}) {
  const loaded = useResource<Transaction>(id ? `/transactions/${id}` : null);
  if (id && loaded.loading && !loaded.data) return <Loading />;
  if (id && loaded.error)
    return (
      <Page title="거래 상세">
        <ErrorNotice error={loaded.error} retry={loaded.retry} />
      </Page>
    );
  return (
    <Form key={id ?? "new"} existing={loaded.data} initialType={initialType} />
  );
}
function Form({
  existing,
  initialType,
}: {
  existing?: Transaction;
  initialType?: Kind;
}) {
  const session = useSession();
  const toast = useToast();
  const [type, setType] = useState<Kind>(
    existing?.type ?? initialType ?? "EXPENSE",
  );
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState<number | null>(
    existing?.categoryId ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [memo, setMemo] = useState(existing?.memo ?? "");
  // Keep seconds for the default "now": minute truncation can put a new transaction before balanceAt.
  const [occurredAt, setOccurredAt] = useState(
    () => existing?.occurredAt ?? new Date().toISOString(),
  );
  const [time, setTime] = useState(() => toSeoulInput(occurredAt));
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<unknown>();
  const [errorAction, setErrorAction] = useState<"save" | "delete">("save");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const key = useRef<string | null>(null);
  const pending = useRef<unknown>(null);
  const [uncertain, setUncertain] = useState(false);
  const categories = useResource<Category[]>(`/categories?type=${type}`);
  const [added, setAdded] = useState<Category[]>([]);
  const list = [
    ...(categories.data ?? []),
    ...added.filter(
      (c) => c.type === type && !categories.data?.some((x) => x.id === c.id),
    ),
  ];
  // Unlock only on failure: on success the screen is popping, and re-rendering it mid-transition
  // (busy → false) is what left Android on a blank native window.
  const unlock = () => {
    lock.current = false;
    setBusy(false);
  };
  const done = (message: string) => {
    session.invalidate();
    toast(message, undefined, "top");
    goBack("/transactions");
  };
  const save = async () => {
    if (lock.current) return;
    setErrorAction("save");
    if (
      !uncertain &&
      (!Number.isInteger(Number(amount)) ||
        Number(amount) < 1 ||
        Number(amount) >= 1e12)
    ) {
      setError("금액은 1원 이상, 1조 미만으로 입력해 주세요");
      return;
    }
    if (
      !uncertain &&
      (!categoryId ||
        !title.trim() ||
        title.trim().length > 40 ||
        memo.length > 200 ||
        !validTime(time))
    ) {
      setError("카테고리, 내용, 날짜와 시간을 확인해 주세요");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(undefined);
    if (!key.current) key.current = randomUUID();
    const body = pending.current ?? {
      type,
      amount: Number(amount),
      categoryId,
      title: title.trim(),
      memo,
      occurredAt,
    };
    pending.current = body;
    try {
      await api(existing ? `/transactions/${existing.id}` : "/transactions", {
        method: existing ? "PATCH" : "POST",
        body,
        key: existing ? undefined : key.current,
      });
      done(existing ? "거래를 수정했어요" : "거래를 기록했어요");
    } catch (e) {
      setError(e);
      if (
        !existing &&
        e instanceof Error &&
        "code" in e &&
        (e.code === "NETWORK" || e.code === "INTERNAL_ERROR")
      )
        setUncertain(true);
      else {
        pending.current = null;
        setUncertain(false);
      }
      unlock();
    }
  };
  const remove = async () => {
    if (!existing || lock.current) return;
    setConfirm(false);
    setErrorAction("delete");
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await api(`/transactions/${existing.id}`, { method: "DELETE" });
      done("거래를 삭제했어요");
    } catch (e) {
      setError(e);
      unlock();
    }
  };
  return (
    <Page title={existing ? "거래 상세" : "거래 직접 기록"}>
      {/* Keep a real native view: toggling pointerEvents would otherwise flatten/unflatten it and
          reparent the fields while the screen pops, which crashed Android (addViewAt: already has a parent). */}
      <View
        collapsable={false}
        pointerEvents={busy || uncertain ? "none" : "auto"}
        style={{ gap: 12 }}
      >
        <Segment
          items={[
            { key: "EXPENSE", label: "지출" },
            { key: "INCOME", label: "수입" },
          ]}
          value={type}
          onChange={(next) => {
            setType(next);
            setCategoryId(null);
          }}
        />
        <Field
          editable={!busy && !uncertain}
          label="금액 (원)"
          value={amount ? money(Number(amount)) : ""}
          keyboardType="number-pad"
          onChangeText={(s) => setAmount(digits(s))}
        />
        <T weight="700">카테고리</T>
        {categories.loading && <Loading />}
        <ErrorNotice error={categories.error} retry={categories.retry} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {list.map((c) => (
            <Pressable
              key={c.id}
              disabled={busy || uncertain}
              accessibilityRole="radio"
              accessibilityLabel={c.name}
              accessibilityState={{ checked: categoryId === c.id }}
              aria-checked={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
              style={{
                width: "30%",
                padding: 12,
                gap: 6,
                alignItems: "center",
                borderRadius: 14,
                backgroundColor:
                  categoryId === c.id ? colors.brandSoft : "#fff",
                borderWidth: 1,
                borderColor: categoryId === c.id ? colors.brand : colors.line,
              }}
            >
              <CategoryIcon icon={c.icon} color={c.color} />
              <T size={13} style={{ textAlign: "center" }}>
                {c.name}
              </T>
            </Pressable>
          ))}
          <Button
            label="+ 추가"
            variant="soft"
            style={{ width: "30%" }}
            onPress={() => setSheet(true)}
          />
        </View>
        <DateTimeField
          label="거래"
          value={time}
          onChange={(value) => {
            setTime(value);
            if (validTime(value)) setOccurredAt(value + ":00+09:00");
          }}
        />
        <Button
          label="지금"
          variant="ghost"
          onPress={() => {
            const now = new Date();
            setOccurredAt(now.toISOString());
            setTime(toSeoulInput(now.toISOString()));
          }}
        />
        <Field
          editable={!busy && !uncertain}
          label="내용 (40자 이내)"
          value={title}
          onChangeText={setTitle}
          maxLength={40}
        />
        <Field
          editable={!busy && !uncertain}
          label="메모 (200자 이내, 선택)"
          value={memo}
          onChangeText={setMemo}
          maxLength={200}
          multiline
        />
      </View>
      {uncertain && (
        <T>저장 여부를 확인하지 못했어요. 같은 내용으로 다시 확인할게요</T>
      )}
      <ErrorNotice error={error} />
      <Button
        label={
          busy
            ? "처리 중…"
            : error && errorAction === "save"
              ? "다시 시도"
              : "저장"
        }
        disabled={busy}
        onPress={save}
      />
      {existing && (
        <Button
          label={
            error && errorAction === "delete"
              ? "거래 삭제 다시 시도"
              : "거래 삭제"
          }
          variant="ghost"
          disabled={busy}
          onPress={() => setConfirm(true)}
        />
      )}
      <CategorySheet
        visible={sheet}
        onClose={() => setSheet(false)}
        type={type}
        onCreated={(c) => {
          setAdded((x) => [...x, c]);
          setCategoryId(c.id);
        }}
      />
      <ConfirmModal
        visible={confirm}
        title="거래를 삭제할까요?"
        message="삭제한 거래는 되돌릴 수 없어요. 예산에도 바로 반영돼요"
        confirmLabel="삭제"
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </Page>
  );
}
