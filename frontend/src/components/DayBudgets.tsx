import { StyleSheet, View } from "react-native";
import { Card, T } from "./ui";
import { colors, radius } from "@/theme";
import { won } from "@/utils/format";
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
/** 32,400 → "3.2만". 칸이 좁아 만 원 단위로 줄이고, 금액 규칙대로 내림한다 */
function short(n: number) {
  return n >= 10000 ? `${Math.floor(n / 1000) / 10}만` : won(n);
}
/**
 * 요일별 생활비 배분. 지금은 하루 예산을 모든 요일에 똑같이 나눈 '기본 배분'만 있다.
 * 오늘은 신한 블루, 지난 요일은 회색, 남은 요일은 연한 블루로 칠한다.
 */
export function DayBudgets({
  date,
  dailyBudget,
}: {
  /** 오늘 날짜 "YYYY-MM-DD"(서울) */
  date: string;
  dailyBudget: number;
}) {
  // getDay() is 0 for Sunday; the row starts on Monday.
  const today = (new Date(date + "T12:00:00").getDay() + 6) % 7;
  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.head}>
        <T size={16} weight="700" accessibilityRole="header">
          요일별 생활비 배분
        </T>
        <View style={styles.chip}>
          <T size={12} weight="700" color={colors.textSub}>
            기본 배분
          </T>
        </View>
      </View>
      <View style={styles.row}>
        {DAYS.map((d, i) => {
          const on = i === today;
          const past = i < today;
          const ink = on
            ? colors.brand
            : past
              ? colors.textMuted
              : colors.textSub;
          return (
            <View
              key={d}
              style={styles.day}
              accessible
              accessibilityLabel={`${d}요일 ${won(dailyBudget)}원${on ? ", 오늘" : ""}`}
            >
              <T size={13} weight={on ? "800" : "500"} color={ink}>
                {d}
              </T>
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: on
                      ? colors.brand
                      : past
                        ? colors.sunken
                        : colors.brandSoft,
                  },
                ]}
              />
              <T size={12} weight={on ? "800" : "500"} color={ink} num>
                {short(dailyBudget)}
              </T>
            </View>
          );
        })}
      </View>
      <T size={13} color={colors.textMuted} num>
        하루 {won(dailyBudget)}원씩 똑같이 나눠 계산해요
      </T>
    </Card>
  );
}
const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.sunken,
  },
  row: { flexDirection: "row", gap: 6 },
  day: { flex: 1, alignItems: "center", gap: 6 },
  bar: { alignSelf: "stretch", height: 64, borderRadius: radius.sm },
});
