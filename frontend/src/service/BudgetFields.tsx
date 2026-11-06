import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Button, Card, Sheet, T } from "@/components/ui";
import { colors, radius } from "@/theme";
import { Field, MoneyField, money } from "./ui";
import type { BudgetSettings } from "./types";

type FixedItem = BudgetSettings["fixedExpenses"][number];
type ProtectedItem = BudgetSettings["protectedItems"][number];

/** 고정지출 등록 화면 맨 위의 빠른 추가 이름(#256에서 확정) */
export const FIXED_PRESETS = ["월세", "관리비", "통신비", "보험료", "구독료"];

const ITEM = 44;
const VISIBLE = 5;
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * 수입일 선택. 한 줄에 왼쪽 [매달 말일], 오른쪽 날짜 버튼. 날짜 버튼은 1~31일 휠을 연다.
 * 31은 매달 말일과 같다(policies §1: 없는 날은 말일, 휴일이면 다음 평일). 값이 없으면(0) 1일로 보인다.
 */
export function PaydayPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (day: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = value >= 1 && value <= 31 ? value : 1;
  const last = shown === 31;
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="600" color={colors.textSub}>
        매달 수입일
      </T>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="매달 말일"
          accessibilityState={{ selected: last }}
          onPress={() => onChange(31)}
          style={({ pressed }) => [
            s.choice,
            last && s.choiceOn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <T weight="700" color={last ? colors.onBrand : colors.brandDark}>
            매달 말일
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`수입일 선택, ${shown}일`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            s.choice,
            s.date,
            pressed && { opacity: 0.7 },
          ]}
        >
          <T size={17} weight="700" num>
            {shown}일
          </T>
          <Ionicons name="chevron-down" size={18} color={colors.textSub} />
        </Pressable>
      </View>
      <T size={13} color={colors.textMuted}>
        {last
          ? "매달 말일에 맞춰 계산해요"
          : "없는 날짜는 그달 말일, 주말·공휴일이면 다음 평일로 계산해요"}
      </T>
      <DaySheet
        visible={open}
        value={shown}
        onClose={() => setOpen(false)}
        onPick={(d) => {
          setOpen(false);
          onChange(d);
        }}
      />
    </View>
  );
}

function DaySheet({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: number;
  onClose: () => void;
  onPick: (day: number) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="수입일 선택">
      {/* 열 때마다 새로 마운트해 지금 값에서 시작한다 */}
      {visible && <DayPick value={value} onPick={onPick} />}
    </Sheet>
  );
}

function DayPick({
  value,
  onPick,
}: {
  value: number;
  onPick: (day: number) => void;
}) {
  const [day, setDay] = useState(value);
  return (
    <>
      <DayWheel value={day} onChange={setDay} />
      <Button
        label={`${day}일로 정하기`}
        onPress={() => onPick(day)}
        style={{ marginTop: 16 }}
      />
    </>
  );
}

/** 알람 시각 고르듯 위아래로 굴려 1~31일을 고르는 휠. 가운데 칸이 선택값이고, 칸을 눌러도 고른다 */
export function DayWheel({
  value,
  onChange,
}: {
  value: number;
  onChange: (day: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const web = Platform.OS === "web";
  const scrollTo = (d: number, animated: boolean) =>
    ref.current?.scrollTo({ y: (d - 1) * ITEM, animated });
  useEffect(() => {
    // 첫 배치가 끝난 뒤 지금 값이 가운데 오게 한다
    const t = setTimeout(() => scrollTo(value, false), 0);
    return () => {
      clearTimeout(t);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const at = (y: number) => Math.min(31, Math.max(1, Math.round(y / ITEM) + 1));
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const d = at(e.nativeEvent.contentOffset.y);
    if (d !== value) onChange(d);
  };
  // 웹은 스냅이 없어 스크롤이 멈추면 가까운 칸으로 맞춘다
  const onWebScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const d = at(y);
      scrollTo(d, true);
      if (d !== value) onChange(d);
    }, 120);
  };
  return (
    <View
      style={{ height: ITEM * VISIBLE }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="수입일"
      accessibilityValue={{ text: `${value}일` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const d =
          e.nativeEvent.actionName === "increment"
            ? Math.min(31, value + 1)
            : Math.max(1, value - 1);
        scrollTo(d, true);
        onChange(d);
      }}
    >
      <View pointerEvents="none" style={s.band} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onMomentumScrollEnd={web ? undefined : settle}
        onScrollEndDrag={web ? undefined : settle}
        onScroll={web ? onWebScroll : undefined}
        contentContainerStyle={{
          paddingVertical: (ITEM * (VISIBLE - 1)) / 2,
        }}
      >
        {DAYS.map((d) => {
          const on = d === value;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`${d}일`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                scrollTo(d, true);
                onChange(d);
              }}
              style={s.item}
            >
              <T
                size={on ? 22 : 18}
                weight={on ? "800" : "500"}
                color={on ? colors.brandDark : colors.textMuted}
                num
              >
                {d === 31 ? "31일(말일)" : `${d}일`}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function fixedValid(x: FixedItem) {
  return (
    !!x.name.trim() &&
    x.amount >= 1 &&
    x.amount < 1e12 &&
    Number.isInteger(x.day) &&
    x.day >= 1 &&
    x.day <= 31
  );
}

export function protectedValid(x: ProtectedItem) {
  return !!x.name.trim() && x.amount >= 1 && x.amount < 1e12;
}

/**
 * 펼친 항목 하나를 편집하는 상태. [취소]는 새로 추가한 항목이면 지우고, 기존 항목이면 수정 전 값으로 되돌린다.
 */
function useItemEditing<V>(items: V[], onChange: (next: V[]) => void) {
  const [open, setOpen] = useState<number | null>(null);
  const before = useRef<V | null>(null);
  return {
    open,
    add: (item: V) => {
      before.current = null;
      setOpen(items.length);
      onChange([...items, item]);
    },
    edit: (i: number) => {
      before.current = items[i];
      setOpen(i);
    },
    cancel: (i: number) => {
      const prev = before.current;
      setOpen(null);
      onChange(
        prev === null
          ? items.filter((_, j) => j !== i)
          : items.map((a, j) => (j === i ? prev : a)),
      );
    },
    close: () => setOpen(null),
    remove: (i: number) => {
      setOpen(null);
      onChange(items.filter((_, j) => j !== i));
    },
  };
}

export function FixedExpensesEditor({
  items,
  onChange,
  onError,
}: {
  items: FixedItem[];
  onChange: (next: FixedItem[]) => void;
  onError: (message?: string) => void;
}) {
  const e = useItemEditing(items, onChange);
  const full = items.length >= 30;
  return (
    <View style={{ gap: 12 }}>
      <View style={s.chips}>
        {FIXED_PRESETS.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`${name} 추가`}
            disabled={full || e.open !== null}
            onPress={() => {
              onError(undefined);
              e.add({ name, amount: 0, day: 0 });
            }}
            style={({ pressed }) => [
              s.chip,
              (full || e.open !== null) && { opacity: 0.4 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <T size={14} weight="700" color={colors.brandDark}>
              + {name}
            </T>
          </Pressable>
        ))}
      </View>
      {items.map((x, i) => {
        const update = (patch: Partial<FixedItem>) =>
          onChange(items.map((a, j) => (j === i ? { ...a, ...patch } : a)));
        return (
          <ItemCard
            key={i}
            open={e.open === i}
            summary={`${x.name} · ${money(x.amount)}원 · 매달 ${x.day === 31 ? "말일" : `${x.day}일`}`}
            onEdit={() => e.edit(i)}
            onConfirm={() => {
              if (!fixedValid(x))
                return onError("고정지출의 이름, 금액, 날짜를 확인해 주세요");
              onError(undefined);
              e.close();
            }}
            onCancel={() => {
              onError(undefined);
              e.cancel(i);
            }}
            onRemove={() => e.remove(i)}
          >
            <Field
              label="이름"
              placeholder="예: 월세"
              maxLength={40}
              value={x.name}
              onChangeText={(name) => update({ name })}
            />
            <MoneyField
              label="금액 (원)"
              placeholder="예: 700,000"
              value={x.amount}
              onChange={(amount) => update({ amount })}
            />
            <Field
              label="매달 나가는 날 (31 = 말일)"
              placeholder="예: 25"
              keyboardType="number-pad"
              value={String(x.day || "")}
              onChangeText={(t) =>
                update({ day: Number(t.replace(/[^0-9]/g, "").slice(0, 2)) })
              }
            />
          </ItemCard>
        );
      })}
      <Button
        label="+ 고정지출 추가"
        variant="soft"
        disabled={full || e.open !== null}
        onPress={() => {
          onError(undefined);
          e.add({ name: "", amount: 0, day: 0 });
        }}
      />
    </View>
  );
}

export function ProtectedItemsEditor({
  items,
  onChange,
  onError,
}: {
  items: ProtectedItem[];
  onChange: (next: ProtectedItem[]) => void;
  onError: (message?: string) => void;
}) {
  const e = useItemEditing(items, onChange);
  return (
    <View style={{ gap: 12 }}>
      {items.map((x, i) => {
        const update = (patch: Partial<ProtectedItem>) =>
          onChange(items.map((a, j) => (j === i ? { ...a, ...patch } : a)));
        return (
          <ItemCard
            key={i}
            open={e.open === i}
            summary={`${x.name} · ${money(x.amount)}원`}
            onEdit={() => e.edit(i)}
            onConfirm={() => {
              if (!protectedValid(x))
                return onError("저축 항목의 이름과 금액을 확인해 주세요");
              onError(undefined);
              e.close();
            }}
            onCancel={() => {
              onError(undefined);
              e.cancel(i);
            }}
            onRemove={() => e.remove(i)}
          >
            <Field
              label="이름"
              placeholder="예: 적금"
              maxLength={40}
              value={x.name}
              onChangeText={(name) => update({ name })}
            />
            <MoneyField
              label="금액 (원)"
              placeholder="예: 300,000"
              value={x.amount}
              onChange={(amount) => update({ amount })}
            />
          </ItemCard>
        );
      })}
      <Button
        label="+ 저축할 돈 추가"
        variant="soft"
        disabled={items.length >= 30 || e.open !== null}
        onPress={() => {
          onError(undefined);
          e.add({ name: "", amount: 0 });
        }}
      />
    </View>
  );
}

function ItemCard({
  open,
  summary,
  onEdit,
  onConfirm,
  onCancel,
  onRemove,
  children,
}: {
  open: boolean;
  summary: string;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  if (!open)
    return (
      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 12,
        }}
      >
        <T weight="600" style={{ flex: 1 }} numberOfLines={1}>
          {summary}
        </T>
        <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}>
          <T color={colors.brandDark} weight="600">
            수정
          </T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}>
          <T color={colors.textMuted} weight="600">
            삭제
          </T>
        </Pressable>
      </Card>
    );
  return (
    <Card style={{ gap: 12 }}>
      {children}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          label="취소"
          variant="ghost"
          onPress={onCancel}
          style={{ flex: 1 }}
        />
        <Button
          label="확인"
          onPress={onConfirm}
          style={{ flex: 2, backgroundColor: colors.brandDark }}
        />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  choice: {
    flex: 1,
    height: 52,
    borderRadius: radius.soft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
  },
  choiceOn: { backgroundColor: colors.brandDark },
  date: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (ITEM * (VISIBLE - 1)) / 2,
    height: ITEM,
    borderRadius: radius.soft,
    backgroundColor: colors.brandSoft,
  },
  item: { height: ITEM, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
});
