import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Screen, Segment, T } from "@/components/ui";
import {
  CategoryIcon,
  ErrorNotice,
  Loading,
  money,
  seoulDate,
  useResource,
} from "./ui";
import type { Transaction } from "./types";
import { colors } from "@/theme";
export function TransactionsScreen() {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("ALL");
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
  const items = data?.items ?? [];
  const groups = new Map<string, Transaction[]>();
  items
    .filter((t) => filter === "ALL" || t.type === filter)
    .forEach((t) => {
      const d = new Date(new Date(t.occurredAt).getTime() + 9 * 3600000)
        .toISOString()
        .slice(0, 10);
      groups.set(d, [...(groups.get(d) ?? []), t]);
    });
  const total = (type: string) =>
    items.filter((x) => x.type === type).reduce((a, x) => a + x.amount, 0);
  return (
    <Screen>
      <Card>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Button
            label="이전 달"
            variant="ghost"
            onPress={() => setOffset((x) => x - 1)}
          />
          <T weight="800">
            {month.getUTCFullYear()}년 {month.getUTCMonth() + 1}월
          </T>
          <Button
            label="다음 달"
            variant="ghost"
            onPress={() => setOffset((x) => x + 1)}
          />
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
                color={type === "INCOME" ? colors.info : colors.text}
              >
                {money(total(type))}원
              </T>
            </View>
          ))}
        </View>
      </Card>
      <Segment
        items={[
          { key: "ALL", label: "전체" },
          { key: "EXPENSE", label: "지출" },
          { key: "INCOME", label: "수입" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <ErrorNotice error={error} retry={retry} />
      {loading ? (
        <Loading />
      ) : (
        !error && (
          <Card style={{ paddingVertical: 8 }}>
            {groups.size === 0 && (
              <T style={{ paddingVertical: 24, textAlign: "center" }}>
                거래내역이 없어요
              </T>
            )}
            {[...groups].map(([date, list]) => (
              <View key={date}>
                <T
                  size={13}
                  weight="700"
                  style={{ paddingTop: 14, paddingBottom: 6 }}
                >
                  {date === seoulDate() ? "오늘" : date}
                </T>
                {list.map((t) => (
                  <Pressable
                    key={t.id}
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
                        backgroundColor: t.category.color + "1F",
                      }}
                    >
                      <CategoryIcon
                        icon={t.category.icon}
                        color={t.category.color}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <T weight="600" numberOfLines={1}>
                        {t.title}
                      </T>
                      <T size={12} color={colors.textMuted}>
                        {new Date(t.occurredAt).toLocaleTimeString("ko-KR", {
                          timeZone: "Asia/Seoul",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {t.category.name}
                      </T>
                    </View>
                    <T
                      weight="700"
                      color={t.type === "INCOME" ? colors.info : colors.text}
                    >
                      {t.type === "INCOME" ? "+" : "-"}
                      {money(t.amount)}원
                    </T>
                  </Pressable>
                ))}
              </View>
            ))}
          </Card>
        )
      )}
      <Button
        label="+ 거래 직접 기록"
        onPress={() => router.push("/transactions/new")}
      />
    </Screen>
  );
}
