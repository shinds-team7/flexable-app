/**
 * 서버 코스튬 id(docs/API.md "코인·코스튬") → 캐릭터 영상(2초 반복 MP4)과 첫 장면 그림(PNG).
 * 파일을 넣는 방법은 docs/coin-plan.md "영상 파일 넣기". 파일이 아직 없는 id는 임시 그림이 보인다.
 * 화면은 OutfitView로 그린다. 영상이 필요 없는 곳(목록 칸 등)만 outfitSource로 정지 그림을 쓴다.
 */
import type { ImageSourcePropType } from "react-native";

export const DEFAULT_OUTFIT_ID = "costume-lv1";

// 파일이 저장소에 들어오면 id마다 영상과 첫 장면을 함께 한 줄씩 추가한다.
// require는 빌드할 때 파일이 있어야 해서 미리 적어 둘 수 없다.
const VIDEOS: Record<string, { video: number; poster: ImageSourcePropType }> = {
  // "costume-lv1": { video: require("../../assets/outfits/costume-lv1.mp4"), poster: require("../../assets/outfits/costume-lv1.png") },
};

// 임시 그림: 레벨 코스튬은 기존 레벨 PNG(동전이 가장 적은 장), 상점 상품은 Lv.1 그림.
const PLACEHOLDERS: Record<string, ImageSourcePropType> = {
  "costume-lv1": require("../../assets/characters/lv1-1.png"),
  "costume-lv2": require("../../assets/characters/lv2-1.png"),
  "costume-lv3": require("../../assets/characters/lv3-1.png"),
  "costume-lv4": require("../../assets/characters/lv4-1.png"),
  "costume-lv5": require("../../assets/characters/lv5-1.png"),
};

/** 정지 그림(첫 장면). null이면 기본 캐릭터. 모르는 id(앱보다 서버에 먼저 추가된 상품)도 임시 그림으로 보여 준다 */
export function outfitSource(id: string | null): ImageSourcePropType {
  const key = id ?? DEFAULT_OUTFIT_ID;
  return VIDEOS[key]?.poster ?? PLACEHOLDERS[key] ?? PLACEHOLDERS[DEFAULT_OUTFIT_ID];
}

/** 반복 재생할 영상. 파일이 아직 없으면 null */
export function outfitVideo(id: string | null): number | null {
  return VIDEOS[id ?? DEFAULT_OUTFIT_ID]?.video ?? null;
}

/** 진짜 영상 파일이 들어왔는지. false면 화면에 "준비 중" 표시를 붙인다 */
export function hasAnimation(id: string | null): boolean {
  return (id ?? DEFAULT_OUTFIT_ID) in VIDEOS;
}
