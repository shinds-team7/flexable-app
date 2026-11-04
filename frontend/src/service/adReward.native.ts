// 보상형 광고(Android·iOS 앱). 보상은 광고를 끝까지 보면 구글이 서버로 보내는 검증 콜백(SSV)이 지급한다.
// 앱은 user_id만 실어 보내고, 다 본 뒤에는 지갑을 다시 읽어 지급 결과를 확인한다(docs/coin-plan.md "광고 보상").
import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

export const adsSupported = true;
export type AdResult = "earned" | "closed" | "failed";

// 실제 광고 단위 ID는 빌드 때 EXPO_PUBLIC_ADMOB_REWARDED_ID로 넣는다. 없으면 구글 테스트 광고다.
const UNIT = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || TestIds.REWARDED;

let started: Promise<unknown> | null = null;

export async function showRewardedAd(userId: number): Promise<AdResult> {
  started ??= mobileAds().initialize();
  try {
    await started;
  } catch {
    return "failed";
  }
  return new Promise<AdResult>((resolve) => {
    const ad = RewardedAd.createForAdRequest(UNIT, {
      serverSideVerificationOptions: { userId: String(userId) },
    });
    let earned = false;
    const off: (() => void)[] = [];
    const done = (r: AdResult) => {
      off.forEach((f) => f());
      resolve(r);
    };
    off.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => done("failed"));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () =>
        done(earned ? "earned" : "closed"),
      ),
      ad.addAdEventListener(AdEventType.ERROR, () => done("failed")),
    );
    ad.load();
  });
}
