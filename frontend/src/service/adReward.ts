// iOS와 웹은 광고 SDK를 포함하지 않는다. Android는 adReward.android.ts를 사용한다.
export const adsSupported = false;
export type AdResult = "earned" | "closed" | "failed";
export type AdOutcome = { result: AdResult; seconds: number };
export async function showRewardedAd(_userId: number): Promise<AdOutcome> {
  return { result: "failed", seconds: 0 };
}
