import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, View } from "react-native";
import { T } from "@/components/ui";
import { colors } from "@/theme";
// value is "YYYY-MM-DDTHH:mm" in Seoul time. The pickers use device time, which is Seoul for our users.
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
function toDate(value: string) {
  const [y, mo, d, h, mi] = value.split(/[-T:]/).map(Number);
  return new Date(y, mo - 1, d, h, mi);
}
function toValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const date = toDate(value);
  const open = (mode: "date" | "time") =>
    DateTimePickerAndroid.open({
      value: date,
      mode,
      is24Hour: true,
      // The spinner lets people drag the hour and minute wheels.
      display: mode === "time" ? "spinner" : "calendar",
      onChange: (event, picked) => {
        if (event.type === "set" && picked) onChange(toValue(picked));
      },
    });
  if (Platform.OS !== "android")
    return (
      <View style={{ gap: 7 }}>
        <T size={13} weight="600">
          {label} 날짜와 시간
        </T>
        <DateTimePicker
          value={date}
          mode="datetime"
          locale="ko-KR"
          onChange={(_, picked) => picked && onChange(toValue(picked))}
        />
      </View>
    );
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {(
        [
          [
            "date",
            `${label} 날짜`,
            `${value.slice(0, 10).replace(/-/g, ".")} (${DOW[date.getDay()]})`,
            "calendar-outline",
          ],
          ["time", `${label} 시간`, value.slice(11, 16), "time-outline"],
        ] as const
      ).map(([mode, title, text, icon]) => (
        <View key={mode} style={{ flex: mode === "date" ? 3 : 2, gap: 7 }}>
          <T size={13} weight="600">
            {title}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title} ${text}, 바꾸기`}
            onPress={() => open(mode)}
            style={{
              minHeight: 50,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 14,
              backgroundColor: "#fff",
            }}
          >
            <Ionicons name={icon} size={18} color={colors.textMuted} />
            <T>{text}</T>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
