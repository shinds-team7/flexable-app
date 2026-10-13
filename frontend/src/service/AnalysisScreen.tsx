import { useState } from "react";
import { View } from "react-native";
import { Donut } from "@/components/Donut";
import { Card, Screen, Segment, T } from "@/components/ui";
import {
  CategoryIcon,
  ErrorNotice,
  Loading,
  money,
  seoulDate,
  useResource,
} from "./ui";
import type { Analysis, Today } from "./types";
import { colors } from "@/theme";
export function AnalysisScreen() {
  const [period, setPeriod] = useState("week");
  const today = useResource<Today>("/budget/today");
  const date = today.data?.date ?? seoulDate();
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - day * 86400000)
    .toISOString()
    .slice(0, 10);
  const sunday = new Date(d.getTime() + (6 - day) * 86400000)
    .toISOString()
    .slice(0, 10);
  // "전체" covers the last 366 days, the longest range the API accepts.
  const from =
    period === "week"
      ? monday
      : period === "month"
        ? date.slice(0, 8) + "01"
        : new Date(d.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const to = period === "week" ? sunday : date;
  const result = useResource<Analysis>(
    from ? `/analysis/summary?from=${from}&to=${to}` : null,
  );
  const s = result.data;
  return (
    <Screen>
      <Segment
        items={[
          { key: "week", label: "이번 주" },
          { key: "month", label: "이번 달" },
          { key: "all", label: "전체" },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <ErrorNotice error={today.error} retry={today.retry} />
      <ErrorNotice error={result.error} retry={result.retry} />
      {result.loading && <Loading />}
      {s && !result.loading && (
        <>
          <Card style={{ alignItems: "center", gap: 12 }}>
            <T style={{ alignSelf: "flex-start" }}>
              {s.from} ~ {s.to}
            </T>
            <T size={20} weight="800" style={{ alignSelf: "flex-start" }}>
              기록한 지출 {s.expenseCount}건
            </T>
            <Donut
              total={s.expenseTotal}
              segments={s.byCategory.map((c) => ({
                value: c.amount,
                color: c.color,
                label:
                  c.ratio >= 0.06 ? `${Math.round(c.ratio * 100)}%` : undefined,
              }))}
            >
              <T size={13}>사용 금액</T>
              <T size={22} weight="800">
                {money(s.expenseTotal)}원
              </T>
            </Donut>
            <View
              style={{
                alignSelf: "stretch",
                backgroundColor: colors.bg,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <T>수입 {money(s.incomeTotal)}원</T>
            </View>
          </Card>
          <Card>
            <T size={17} weight="700">
              카테고리별 사용 현황
            </T>
            {s.byCategory.length === 0 && (
              <T style={{ paddingVertical: 24 }}>기록한 지출이 없어요</T>
            )}
            <View
              style={{
                flexDirection: "row",
                height: 12,
                borderRadius: 6,
                overflow: "hidden",
                gap: 2,
                marginTop: 14,
              }}
            >
              {s.byCategory.map((c) => (
                <View
                  key={c.categoryId}
                  style={{ flex: c.amount, backgroundColor: c.color }}
                />
              ))}
            </View>
            <View style={{ gap: 18, marginTop: 20 }}>
              {s.byCategory.map((c) => (
                <View
                  key={c.categoryId}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <T weight="600">
                        {c.name} <T size={12}>{c.count}건</T>
                      </T>
                      <T weight="700">{money(c.amount)}원</T>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          height: 6,
                          backgroundColor: colors.bg,
                          borderRadius: 3,
                        }}
                      >
                        <View
                          style={{
                            height: 6,
                            width: `${c.ratio * 100}%`,
                            backgroundColor: c.color,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                      <T size={12} color={colors.textMuted}>
                        {money(c.amount)} / {money(s.expenseTotal)}
                      </T>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
