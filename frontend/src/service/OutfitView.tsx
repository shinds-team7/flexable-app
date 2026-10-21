/**
 * 코스튬 캐릭터 한 칸. play면 2초 영상을 소리 없이 반복하고, 아니면 첫 장면 정지 그림만 그린다.
 * 영상은 화면당 하나만 재생한다(docs/coin-plan.md "영상 파일 넣기"). 목록 칸·모달은 play={false}.
 */
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useReducedMotion } from "@/components/ui";
import { outfitSource, outfitVideo } from "./outfits";

// 웹 expo-video는 <video>.play()의 Promise를 받지 않는다. 재생 직후 화면을 떠나 pause가 먼저 오면
// 브라우저가 그 play를 AbortError로 끝내고 처리되지 않은 오류로 남는다. 동작에는 영향이 없어 이 경우만 무시한다.
if (Platform.OS === "web" && typeof window !== "undefined")
  window.addEventListener("unhandledrejection", (e) => {
    if (
      e.reason?.name === "AbortError" &&
      /play\(\) request was interrupted/.test(String(e.reason?.message))
    )
      e.preventDefault();
  });

type Props = {
  outfitId: string | null;
  play?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function OutfitView({
  outfitId,
  play = true,
  style,
  accessibilityLabel,
}: Props) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const video = play && focused && !reduced ? outfitVideo(outfitId) : null;
  const poster = outfitSource(outfitId);
  const a11y = {
    accessible: true,
    accessibilityRole: "image" as const,
    accessibilityLabel,
  };
  if (video === null)
    return (
      <View style={style} {...a11y}>
        <Image
          source={poster}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      </View>
    );
  // 코스튬이 바뀌면 플레이어를 새로 만든다.
  return (
    <LoopVideo
      key={outfitId ?? ""}
      video={video}
      poster={poster}
      style={style}
      a11y={a11y}
    />
  );
}

function LoopVideo({
  video,
  poster,
  style,
  a11y,
}: {
  video: number;
  poster: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  a11y: object;
}) {
  const [shown, setShown] = useState(false);
  const player = useVideoPlayer(video, (p) => {
    p.loop = true;
    p.muted = true;
    // 사용자가 듣던 음악을 멈추지 않는다.
    p.audioMixingMode = "mixWithOthers";
    p.play();
  });
  // 화면 이탈·코스튬 변경 시 useVideoPlayer가 플레이어를 해제한다.
  // 별도 cleanup에서 pause하면 이미 해제된 네이티브 객체를 호출할 수 있다.
  return (
    <View style={style} {...a11y}>
      <VideoView
        player={player}
        style={styles.fill}
        contentFit="contain"
        nativeControls={false}
        playsInline
        onFirstFrameRender={() => setShown(true)}
      />
      {/* 플레이어가 준비되는 동안 빈 화면 대신 첫 장면을 보여 준다. */}
      {!shown && (
        <Image
          source={poster}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 웹 VideoView는 <video>라 top/left/right/bottom만으로는 늘어나지 않고 원본 크기(1280×720)로 그려진다.
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
});
