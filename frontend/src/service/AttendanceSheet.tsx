import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Sheet, T } from "@/components/ui";
import { monthWeeks } from "@/components/MonthCalendar";
import { colors } from "@/theme";
import { DOW } from "@/utils/format";
import { sessionGeneration } from "./api/client";
import { attend } from "./coinApi";
import type { Attendance } from "./types";
import { ErrorNotice, Loading, useResource } from "./ui";
import { publishWallet } from "./wallet";

/**
 * 홈 캐릭터 오른쪽 위 달력 버튼으로 여는 출석 달력. 이번 달 출석한 날에 도장을 찍고, [출석하기]를 눌러야 출석한다.
 * 금액·연속 일수는 서버 값만 보여 준다(docs/coin-plan.md §1 출석).
 */
export function AttendanceSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const result = useResource<Attendance>(visible ? "/coins/attendance" : null);
  // 출석한 뒤에는 응답의 출석 현황을 보여 준다. 다시 열면 서버에서 새로 읽는다.
  const [after, setAfter] = useState<{ attendance: Attendance; rewarded: number }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const close = () => {
    setAfter(undefined);
    setError(undefined);
    onClose();
  };
  const a = after?.attendance ?? result.data;
  const check = () => {
    setBusy(true);
    setError(undefined);
    const generation = sessionGeneration();
    attend()
      .then((r) => {
        publishWallet(r.wallet, generation);
        setAfter({ attendance: r.attendance, rewarded: r.rewarded });
      })
      .catch(setError)
      .finally(() => setBusy(false));
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="출석체크"
      subtitle="하루 한 번 출석하면 5코인, 연속 7일째마다 그날은 30코인을 받아요"
    >
      {result.loading && !a && <Loading />}
      <ErrorNotice error={!a && result.error} retry={result.retry} />
      {a && (
        <View style={{ gap: 14 }}>
          <View style={styles.head}>
            <T size={16} weight="700">
              {Number(a.today.slice(5, 7))}월
            </T>
            <T size={13} weight="700" color={colors.brand}>
              {a.streak > 0 ? `연속 ${a.streak}일째` : "오늘부터 연속 출석"}
            </T>
          </View>
          <Stamps attendance={a} />
          {after && after.rewarded > 0 && (
            <T
              size={15}
              weight="700"
              color={colors.brandDark}
              style={{ textAlign: "center" }}
              accessibilityRole="alert"
            >
              🪙 {after.rewarded}코인을 받았어요
            </T>
          )}
          <ErrorNotice error={error} />
          <Button
            label={
              a.checkedToday
                ? "오늘 출석 완료"
                : `출석하기 · ${a.todayReward}코인`
            }
            onPress={check}
            disabled={a.checkedToday || busy}
          />
        </View>
      )}
    </Sheet>
  );
}

/** 이번 달 달력. 출석한 날은 파란 도장, 오늘은 테두리 */
function Stamps({ attendance }: { attendance: Attendance }) {
  const year = Number(attendance.today.slice(0, 4));
  const month = Number(attendance.today.slice(5, 7));
  const done = new Set(attendance.days);
  const prefix = attendance.today.slice(0, 8);
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        {DOW.map((d) => (
          <T
            key={d}
            size={12}
            weight="600"
            color={colors.textMuted}
            style={styles.dow}
          >
            {d}
          </T>
        ))}
      </View>
      {monthWeeks(year, month).map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((day, i) => {
            if (day === null) return <View key={i} style={styles.cell} />;
            const date = prefix + String(day).padStart(2, "0");
            const on = done.has(date);
            const today = date === attendance.today;
            return (
              <View
                key={i}
                style={styles.cell}
                accessible
                accessibilityLabel={`${month}월 ${day}일${today ? ", 오늘" : ""}${on ? ", 출석" : ""}`}
              >
                <View
                  style={[styles.stamp, on && styles.stamped, today && !on && styles.today]}
                >
                  {on ? (
                    <Ionicons name="checkmark" size={16} color={colors.onBrand} />
                  ) : (
                    <T
                      size={12}
                      weight={today ? "800" : "500"}
                      color={today ? colors.brand : colors.textSub}
                      num
                    >
                      {day}
                    </T>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: { flexDirection: "row" },
  dow: { flex: 1, textAlign: "center", paddingVertical: 4 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  stamp: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stamped: { backgroundColor: colors.brand },
  today: { borderWidth: 2, borderColor: colors.brand },
});
