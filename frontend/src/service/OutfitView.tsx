/**
 * 코스튬 캐릭터 한 칸. play면 2초 영상을 소리 없이 반복하고, 아니면 첫 장면 정지 그림만 그린다.
 * 영상은 화면당 하나만 재생한다(docs/coin-plan.md "영상 파일 넣기"). 목록 칸·모달은 play={false}.
 */
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useState } from "react";
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";

import { useReducedMotion } from "@/components/ui";
import { outfitSource, outfitVideo } from "./outfits";

type Props = {
  outfitId: string | null;
  play?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function OutfitView({ outfitId, play = true, style, accessibilityLabel }: Props) {
  const reduced = useReducedMotion();
  const video = play && !reduced ? outfitVideo(outfitId) : null;
  const poster = outfitSource(outfitId);
  const a11y = { accessible: true, accessibilityRole: "image" as const, accessibilityLabel };
  if (video === null)
    return (
      <View style={style} {...a11y}>
        <Image source={poster} style={StyleSheet.absoluteFill} contentFit="contain" />
      </View>
    );
  // 코스튬이 바뀌면 플레이어를 새로 만든다.
  return <LoopVideo key={outfitId ?? ""} video={video} poster={poster} style={style} a11y={a11y} />;
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
  });
  // 다른 탭·화면으로 가면 멈춰 배터리를 아낀다.
  useFocusEffect(
    useCallback(() => {
      player.play();
      return () => player.pause();
    }, [player]),
  );
  return (
    <View style={style} {...a11y}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        playsInline
        onFirstFrameRender={() => setShown(true)}
      />
      {/* 플레이어가 준비되는 동안 빈 화면 대신 첫 장면을 보여 준다. */}
      {!shown && <Image source={poster} style={StyleSheet.absoluteFill} contentFit="contain" />}
    </View>
  );
}
