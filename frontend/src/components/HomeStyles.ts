import { StyleSheet } from "react-native";
import { colors, radius } from "@/theme";

export const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: 22,
    paddingBottom: 14,
  },
  // Nothing left to spend today: the whole panel turns red, and the navy accents darken instead.
  heroEmpty: { backgroundColor: colors.danger },
  heroTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  heroFoot: {
    marginTop: 14,
    paddingTop: 12,
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
