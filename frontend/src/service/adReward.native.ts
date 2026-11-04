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

// 개발 중(__DEV__)에는 구글 테스트 광고만 쓴다. 실제 광고를 개발 중에 반복해서 보면 AdMob이 무효 트래픽으로 제재할 수 있다.
// 배포 빌드는 "광고 시청 코인 획득" 광고 단위(AdMob 콘솔). 광고 단위 ID는 앱에 그대로 들어가는 공개 값이다.
const REWARDED_UNIT = "ca-app-pub-3401841469269585/7434171761";
const UNIT = __DEV__ ? TestIds.REWARDED : REWARDED_UNIT;

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
      // 개인정보처리방침 11장: 맞춤형 광고에는 쓰지 않도록 요청한다
      requestNonPersonalizedAdsOnly: true,
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
