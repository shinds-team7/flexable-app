import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, View } from "react-native";
import { T } from "@/components/ui";
import { colors, radius } from "@/theme";
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
/** "2026. 10. 20. (화) 오후 12:40" */
export function dateTimeText(value: string) {
  const date = toDate(value);
  const h = date.getHours();
  const noon = h < 12 ? "오전" : "오후";
  return `${value.slice(0, 10).replace(/-/g, ". ")}. (${DOW[date.getDay()]}) ${noon} ${h % 12 || 12}:${pad(date.getMinutes())}`;
}
// One field for both: the date picker opens first, then the time wheel for the picked day.
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
  const pickTime = (day: Date) =>
    DateTimePickerAndroid.open({
      value: day,
      mode: "time",
      is24Hour: false,
      // The spinner lets people drag the hour and minute wheels.
      display: "spinner",
      onChange: (event, picked) => {
        if (event.type === "set" && picked) onChange(toValue(picked));
      },
    });
  const pickDate = () =>
    DateTimePickerAndroid.open({
      value: date,
      mode: "date",
      display: "calendar",
      onChange: (event, picked) => {
        if (event.type !== "set" || !picked) return;
        onChange(toValue(picked));
        pickTime(picked);
      },
    });
  if (Platform.OS !== "android")
    return (
      <View style={{ gap: 8 }}>
        <T size={14} weight="700" color={colors.textSub}>
          {label}
        </T>
        <DateTimePicker
          value={date}
          mode="datetime"
          locale="ko-KR"
          onChange={(_, picked) => picked && onChange(toValue(picked))}
        />
      </View>
    );
  const text = dateTimeText(value);
  return (
    <View style={{ gap: 8 }}>
      <T size={14} weight="700" color={colors.textSub}>
        {label}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${text}, 바꾸기`}
        onPress={pickDate}
        style={{
          minHeight: 52,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.borderInput,
          borderRadius: radius.soft,
          backgroundColor: colors.card,
        }}
      >
        <T style={{ flex: 1 }} num>
          {text}
        </T>
        <Ionicons name="calendar-outline" size={20} color={colors.textSub} />
      </Pressable>
    </View>
  );
}
