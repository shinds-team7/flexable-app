import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { T, useRollingNumber } from "./ui";
import { colors } from "@/theme";
import { DOW, won } from "@/utils/format";
import { styles } from "./HomeStyles";
export type HeroSummary = {
  todayAvailable: number;
  daysLeft: number;
};
export function TodayHeroView({
  today,
  summary: s,
  onDetails,
  footerCaption,
}: {
  today: Date;
  summary: HeroSummary;
  onDetails: () => void;
  footerCaption: string;
}) {
  const over = s.todayAvailable < 0;
  const empty = s.todayAvailable <= 0;
  // Translucent white drops below 4.5:1 on the red panel, so small text goes solid white there.
  const sub = empty ? colors.onBrand : colors.onBrandSub;
  const shown = useRollingNumber(Math.max(0, s.todayAvailable));
  return (
    <View style={[styles.hero, empty && styles.heroEmpty]}>
      <View style={styles.heroTop}>
        <T size={15} weight="700" color={colors.onBrand}>
          오늘 쓸 수 있는 돈
        </T>
        <T size={13} weight="500" color={sub}>
          {today.getMonth() + 1}월 {today.getDate()}일 {DOW[today.getDay()]}요일
        </T>
      </View>

      <T
        size={38}
        weight="800"
        color={colors.onBrand}
        num
        style={{ marginTop: 6, lineHeight: 46 }}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`오늘 쓸 수 있는 돈 ${won(Math.max(0, s.todayAvailable))}원`}
      >
        {won(shown)}
        <T size={22} weight="700" color={colors.onBrand}>
          {" "}
          원
        </T>
      </T>

      {over && (
        <T size={13} weight="600" color={colors.onBrand} style={{ marginTop: 2 }} num>
          오늘 {won(-s.todayAvailable)}원 넘게 썼어요. 남은 {s.daysLeft - 1}일에
          나눠서 반영할게요
        </T>
      )}

      <Pressable
        style={({ pressed }) => [styles.heroFoot, pressed && { opacity: 0.7 }]}
        onPress={onDetails}
        accessibilityRole="button"
        accessibilityLabel="계산 근거 보기"
      >
        <T
          size={12}
          color={sub}
          numberOfLines={1}
          style={{ flex: 1 }}
          num
        >
          {footerCaption}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <T size={12} weight="700" color={colors.onBrand}>
            계산 근거
          </T>
          <Ionicons name="chevron-forward" size={14} color={colors.onBrand} />
        </View>
      </Pressable>
    </View>
  );
}
