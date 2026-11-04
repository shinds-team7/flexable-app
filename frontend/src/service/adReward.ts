// 보상형 광고(웹). 광고 SDK는 Android 앱에서만 쓰므로 웹에서는 광고를 보여 주지 않는다. 앱은 adReward.native.ts.
export const adsSupported = false;
export type AdResult = "earned" | "closed" | "failed";
export async function showRewardedAd(_userId: number): Promise<AdResult> {
  return "failed";
}
