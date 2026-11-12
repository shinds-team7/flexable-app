import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Card, Screen, Segment, T } from "@/components/ui";
import { MonthCalendar } from "@/components/MonthCalendar";
import {
  CategoryIcon,
  ErrorNotice,
  Loading,
  money,
  seoulDate,
  toSeoulInput,
  usePreviousWhileLoading,
  useResource,
} from "./ui";
import type { ScheduledExpense, Transaction } from "./types";
import { dayAmounts, historyGroups } from "./historyRows";
import { colors } from "@/theme";
import { useServerExtensions } from "./serverExtensions";
// 서버가 거래의 카테고리를 찾지 못하면 category가 null로 온다(docs/contracts/app-api.yaml Transaction).
const NO_CATEGORY = {
  name: "카테고리 없음",
  icon: "pricetag",
  color: colors.textMuted,
};
const categoryOf = (t: { category: Transaction["category"] }) =>
  t.category ?? NO_CATEGORY;
const txDate = (t: Transaction) => toSeoulInput(t.occurredAt).slice(0, 10);
const FILTERS = ["ALL", "EXPENSE", "INCOME"] as const;
type Filter = (typeof FILTERS)[number];
export function TransactionsScreen() {
  const extensions = useServerExtensions();
  const [offset, setOffset] = useState(0);
  // 다른 달을 보다가 다른 화면에 다녀오면 다시 이번 달 달력을 보여 준다
  useFocusEffect(
    useCallback(() => {
      setOffset(0);
    }, []),
  );
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pagerWidth, setPagerWidth] = useState(0);
  const pager = useRef<ScrollView>(null);
  const mouseStart = useRef<number | null>(null);
  const chooseFilter = (value: Filter) => {
    setFilter(value);
    pager.current?.scrollTo({ x: FILTERS.indexOf(value) * pagerWidth, animated: true });
  };
  const [y, m] = seoulDate().split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1 + offset, 1));
  const from = month.toISOString().slice(0, 10);
  const to = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  const { data, error, loading, retry } = useResource<{ items: Transaction[] }>(
    `/transactions?from=${from}&to=${to}`,
  );
  const { displayData } = usePreviousWhileLoading(data, loading);
  const items = displayData?.items ?? [];
  // 예정 지출(음성·AI 메이트·달력에서 등록)은 같은 달 것을 따로 받아 달력과 목록에 "예정"으로 함께 보여 준다.
  // 예정 API가 없는 구버전 서버에서는 부르지 않고, 실패해도 실제 거래 내역은 그대로 보인다.
  const planned = useResource<{ items: ScheduledExpense[] }>(
    extensions.available ? `/scheduled-expenses?from=${from}&to=${to}` : null,
  );
  const { displayData: plannedData } = usePreviousWhileLoading(
    planned.data,
    planned.loading,
  );
  const plans =
    extensions.available && !planned.error ? (plannedData?.items ?? []) : [];
  const total = (type: string) =>
    items.filter((x) => x.type === type).reduce((a, x) => a + x.amount, 0);
  // 달력은 아래 목록 필터와 상관없이 그달의 지출·수입·예정을 모두 날짜별로 보여준다. 위 지출 합계에는 예정을 넣지 않는다.
  const daily = dayAmounts(items, plans, txDate);
  return (
    <Screen>
      <Card style={{ paddingTop: 8, gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <MonthStep step={-1} onPress={() => setOffset((x) => x - 1)} />
          <T weight="800">
            {month.getUTCFullYear()}년 {month.getUTCMonth() + 1}월
          </T>
          <MonthStep step={1} onPress={() => setOffset((x) => x + 1)} />
        </View>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.bg,
            borderRadius: 16,
            paddingVertical: 14,
          }}
        >
          {["EXPENSE", "INCOME"].map((type) => (
            <View key={type} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <T size={12}>{type === "EXPENSE" ? "지출" : "수입"}</T>
              <T
                size={18}
                weight="800"
                color={type === "INCOME" ? colors.brand : colors.text}
              >
                {money(total(type))}원
              </T>
            </View>
          ))}
        </View>
        <MonthCalendar
          year={month.getUTCFullYear()}
          month={month.getUTCMonth() + 1}
          today={seoulDate()}
          totals={daily}
          allowFuture={extensions.available}
          onSelect={(date) =>
            router.push({
              pathname:
                // 오늘·지난 날짜는 그 날짜가 채워진 거래 직접 기록으로 바로 간다
                date > seoulDate()
                  ? "/scheduled-expenses"
                  : "/transactions/new",
              params: { date },
            })
          }
        />
      </Card>
      <Segment
        animated
        items={[
          { key: "ALL", label: "전체" },
          { key: "EXPENSE", label: "지출" },
          { key: "INCOME", label: "수입" },
        ]}
        value={filter}
        onChange={chooseFilter}
      />
      <ErrorNotice error={error} retry={retry} />
      {loading && !displayData && <Loading />}
      {displayData && !error && (
        <View onLayout={(event) => setPagerWidth(event.nativeEvent.layout.width)}>
          {pagerWidth > 0 && (
            <ScrollView
              ref={pager}
              accessibilityLabel="거래 종류별 목록"
              horizontal
              pagingEnabled
              snapToInterval={pagerWidth}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
                if (FILTERS[index] && FILTERS[index] !== filter) setFilter(FILTERS[index]);
              }}
              onPointerDown={Platform.OS === "web" ? (event) => {
                if (event.nativeEvent.pointerType === "mouse") mouseStart.current = event.nativeEvent.pageX;
              } : undefined}
              onPointerUp={Platform.OS === "web" ? (event) => {
                const start = mouseStart.current;
                mouseStart.current = null;
                if (start === null) return;
                const direction = start - event.nativeEvent.pageX;
                if (Math.abs(direction) < 48) return;
                const next = FILTERS[FILTERS.indexOf(filter) + (direction > 0 ? 1 : -1)];
                if (next) chooseFilter(next);
              } : undefined}
              onPointerCancel={() => { mouseStart.current = null; }}
              style={Platform.OS === "web" ? ({ scrollSnapType: "x mandatory" } as object) : undefined}
            >
              {FILTERS.map((type) => (
                <View
                  key={type}
                  testID={`transaction-page-${type}`}
                  aria-hidden={filter !== type}
                  importantForAccessibility={filter === type ? "auto" : "no-hide-descendants"}
                  style={{ width: pagerWidth, ...(Platform.OS === "web" ? { scrollSnapAlign: "start" } as object : {}) }}
                >
                  <TransactionList items={items} plans={plans} filter={type} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </Screen>
  );
}

function TransactionList({
  items,
  plans,
  filter,
}: {
  items: Transaction[];
  plans: ScheduledExpense[];
  filter: Filter;
}) {
  const groups = historyGroups(items, plans, filter, txDate);
  return (
    <Card style={{ paddingVertical: 8 }}>
      {groups.length === 0 && (
        <T style={{ paddingVertical: 24, textAlign: "center" }}>
          거래내역이 없어요
        </T>
      )}
      {groups.map(([date, list], i) => (
        <View
          key={date}
          style={
            i > 0 && {
              borderTopWidth: 1,
              borderTopColor: colors.line,
              marginTop: 6,
            }
          }
        >
          <T
            size={13}
            weight="700"
            style={{ paddingTop: 14, paddingBottom: 6 }}
          >
            {date === seoulDate() ? "오늘" : date}
          </T>
          {list.map((row) =>
            row.kind === "planned" ? (
              <PlannedRow key={`planned-${row.item.id}`} plan={row.item} />
            ) : (
              <TxRow key={row.item.id} t={row.item} />
            ),
          )}
        </View>
      ))}
    </Card>
  );
}

function TxRow({ t }: { t: Transaction }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${money(t.amount)}원, 상세 보기`}
      onPress={() => router.push(`/transactions/${t.id}`)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: categoryOf(t).color + "1F",
        }}
      >
        <CategoryIcon icon={categoryOf(t).icon} color={categoryOf(t).color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T weight="600" numberOfLines={1}>
          {t.title}
        </T>
        <T size={12} color={colors.textMuted}>
          {categoryOf(t).name}
        </T>
      </View>
      <T weight="700" color={t.type === "INCOME" ? colors.brand : colors.text}>
        {t.type === "INCOME" ? "+" : "-"}
        {money(t.amount)}원
      </T>
    </Pressable>
  );
}

/** 예정 지출 한 줄. 실제 거래와 구분되게 "예정" 표시를 붙이고, 누르면 그 날짜의 예정 지출 화면으로 간다 */
function PlannedRow({ plan }: { plan: ScheduledExpense }) {
  const category = categoryOf(plan);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`예정, ${plan.title}, ${money(plan.amount)}원, 예정 지출 보기`}
      onPress={() =>
        router.push({
          pathname: "/scheduled-expenses",
          params: { date: plan.date },
        })
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: category.color + "1F",
        }}
      >
        <CategoryIcon icon={category.icon} color={category.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              backgroundColor: colors.warnSoft,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 1,
            }}
          >
            <T size={11} weight="700" color={colors.warn}>
              예정
            </T>
          </View>
          <T weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {plan.title}
          </T>
        </View>
        <T size={12} color={colors.textMuted}>
          {category.name}
        </T>
      </View>
      <T weight="700" color={colors.textMuted}>
        -{money(plan.amount)}원
      </T>
    </Pressable>
  );
}
function MonthStep({ step, onPress }: { step: -1 | 1; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={step < 0 ? "이전 달" : "다음 달"}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={step < 0 ? "chevron-back" : "chevron-forward"}
        size={22}
        color={colors.brandDark}
      />
    </Pressable>
  );
}
