import { View } from "react-native";
import { T } from "@/components/ui";
import { colors, font } from "@/theme";
// The native picker has no web build. Browser date/time inputs give the same calendar and wheel.
const style = {
  fontFamily: font,
  fontSize: 16,
  minHeight: 50,
  padding: "0 14px",
  border: `1px solid ${colors.line}`,
  borderRadius: 14,
  backgroundColor: "#fff",
  color: colors.text,
  boxSizing: "border-box" as const,
  width: "100%",
};
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [date, time] = value.split("T");
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 3, gap: 7 }}>
        <T size={13} weight="600">
          {label} 날짜
        </T>
        <input
          type="date"
          aria-label={`${label} 날짜`}
          value={date}
          onChange={(e) =>
            e.target.value && onChange(`${e.target.value}T${time}`)
          }
          style={style}
        />
      </View>
      <View style={{ flex: 2, gap: 7 }}>
        <T size={13} weight="600">
          {label} 시간
        </T>
        <input
          type="time"
          aria-label={`${label} 시간`}
          value={time}
          onChange={(e) =>
            e.target.value && onChange(`${date}T${e.target.value}`)
          }
          style={style}
        />
      </View>
    </View>
  );
}
