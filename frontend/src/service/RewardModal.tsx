import { Modal, StyleSheet, View } from "react-native";
import { Button, T } from "@/components/ui";
import { colors, floating } from "@/theme";
import type { CoinReward } from "./types";

const TITLES: Record<CoinReward["reason"], string> = {
  SIGNUP_GIFT: "업데이트 기념 200코인 선물",
  BUDGET_BONUS: "어제 예산을 지켰어요",
  REFERRAL_INVITER: "추천 코드가 사용됐어요",
};

function bodyOf(r: CoinReward): string {
  if (r.reason === "SIGNUP_GIFT") return `앱에서 쓰는 코인 ${r.amount}개를 드려요`;
  if (r.reason === "BUDGET_BONUS") return `보너스 코인 ${r.amount}개를 받았어요`;
  return `친구가 내 추천 코드를 입력해서 코인 ${r.amount}개를 받았어요`;
}

/** 받은 코인 안내. 부르는 쪽이 rewards 를 한 개씩 넘기고, 닫을 때 ack 한다 */
export function RewardModal({ reward, onClose }: { reward: CoinReward | null; onClose: () => void }) {
  return (
    <Modal visible={reward !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dim}>
        {reward && (
          <View style={[styles.dialog, floating]} accessibilityViewIsModal>
            <T size={32} style={{ textAlign: "center" }}>
              🪙
            </T>
            <T size={18} weight="700" accessibilityRole="header" style={{ textAlign: "center", marginTop: 8 }}>
              {TITLES[reward.reason]}
            </T>
            <T size={14} color={colors.textSub} style={{ textAlign: "center", marginTop: 8, lineHeight: 21 }}>
              {bodyOf(reward)}
            </T>
            <T size={22} weight="800" color={colors.brandDark} num style={{ textAlign: "center", marginTop: 12 }}>
              +{reward.amount}
            </T>
            <Button label="확인" onPress={onClose} style={{ marginTop: 20 }} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, justifyContent: "center", padding: 28, backgroundColor: "rgba(0,0,0,0.45)" },
  dialog: { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
});
