"""코스튬 영상을 앱 규격으로 맞춘다(docs/coin-plan.md "영상 파일 넣기").

H.264 · 소리 없음 · 1280x720 · 가장자리를 무대 색 #EEF2FA로 서서히 녹임, 그리고 첫 장면 JPG를 만든다.
받은 영상의 배경이 무대 색과 달라도 경계가 보이지 않게 하기 위한 것이다.

사용: python scripts/prepare-outfit-video.py <받은 영상.mp4> <코스튬 id> [첫 화면 이미지] [--scale 0.8]
--scale: 영상 전체를 이 비율로 줄여 가운데에 두고 나머지를 무대 색으로 채운다(캐릭터가 화면을 가득 채우는 영상용, 기본 1).
  예) python scripts/prepare-outfit-video.py ~/Downloads/cat_mine.mp4 costume-lv1 ~/Downloads/cat-mine-thumbnail.jpg
첫 화면 이미지를 주면 영상 첫 장면 대신 그 이미지를 같은 규격(1280x720, 가장자리 녹임)으로 만들어 쓴다.
결과: assets/outfits/<id>.mp4, assets/outfits/<id>.jpg
ffmpeg가 PATH에 없으면 `pip install imageio-ffmpeg`로 받은 것을 쓴다.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

W, H = 1280, 720
STAGE = (0xEE, 0xF2, 0xFA)
# 녹이는 폭(가장자리에서 안쪽으로). 위아래는 배경 조명 차이가 커서 비율상 조금 더 넓다.
FADE_X, FADE_Y = 120, 96
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "outfits")


def ffmpeg():
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("ffmpeg가 없어요. `pip install imageio-ffmpeg` 뒤 다시 실행해 주세요")
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("outfit_id")
    parser.add_argument("thumbnail", nargs="?")
    parser.add_argument("--clear-top-left", action="store_true",
                        help="좌상단 배경색 텍스트 영역(240x90px)을 지우고 40px에 걸쳐 경계를 녹임")
    parser.add_argument("--scale", type=float, default=1.0, help="0.5~1. 영상을 줄여 가운데에 두고 둘레는 무대 색")
    args = parser.parse_args()
    if not 0.5 <= args.scale <= 1.0:
        sys.exit("--scale은 0.5~1 사이로 줘요")
    src, outfit_id = os.path.expanduser(args.source), args.outfit_id
    thumbnail = os.path.expanduser(args.thumbnail) if args.thumbnail else None
    if not re.fullmatch(r"(costume-lv[1-6]|outfit-\d{2})", outfit_id):
        sys.exit("코스튬 id는 costume-lv1~6 또는 outfit-01~10 형식이에요")
    os.makedirs(OUT_DIR, exist_ok=True)
    video = os.path.join(OUT_DIR, outfit_id + ".mp4")
    poster = os.path.join(OUT_DIR, outfit_id + ".jpg")

    # 가장자리까지 거리를 0~1로 잰 뒤 smoothstep으로 부드럽게 하고, 가로·세로를 곱해 모서리도 둥글게 녹인다.
    # 줄이면 녹이는 폭도 같은 비율로 줄이고, 녹인 영상을 무대 색 캔버스 가운데에 올린다.
    w, h = round(W * args.scale / 2) * 2, round(H * args.scale / 2) * 2
    fx, fy = FADE_X * args.scale, FADE_Y * args.scale
    tx = f"clip(min(X,W-1-X)/{fx},0,1)"
    ty = f"clip(min(Y,H-1-Y)/{fy},0,1)"
    sx = f"({tx}*{tx}*(3-2*{tx}))"
    sy = f"({ty}*{ty}*(3-2*{ty}))"
    alpha = f"1-{sx}*{sy}"
    if args.clear_top_left:
        # 캐릭터와 떨어진 좌상단 텍스트만 무대 색으로 덮고, 덮은 영역 경계도 부드럽게 잇는다.
        lx, ly = "clip((X-240)/40,0,1)", "clip((Y-90)/40,0,1)"
        label = f"(1-{lx}*{lx}*(3-2*{lx}))*(1-{ly}*{ly}*(3-2*{ly}))"
        alpha = f"max({alpha},{label})"
    r, g, b = STAGE
    graph = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},scale={w}:{h},fps=30,format=rgba[v];"
        f"color=c=0x{r:02X}{g:02X}{b:02X}:s={w}x{h}:r=30,format=rgba,"
        f"geq=r={r}:g={g}:b={b}:a='255*({alpha})'[edge];"
        f"[v][edge]overlay=shortest=1,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x{r:02X}{g:02X}{b:02X},format=yuv420p"
    )
    ff = ffmpeg()
    subprocess.run(
        [ff, "-v", "error", "-y", "-i", src, "-filter_complex", graph, "-an",
         "-c:v", "libx264", "-profile:v", "main", "-preset", "slow", "-crf", "23",
         "-movflags", "+faststart", video],
        check=True,
    )
    if thumbnail:
        subprocess.run(
            [ff, "-v", "error", "-y", "-loop", "1", "-i", thumbnail, "-filter_complex", graph,
             "-frames:v", "1", "-q:v", "3", poster],
            check=True,
        )
    else:
        subprocess.run([ff, "-v", "error", "-y", "-i", video, "-frames:v", "1", "-q:v", "3", poster], check=True)
    for path in (video, poster):
        print(f"{os.path.relpath(path)}  {os.path.getsize(path) // 1024}KB")
    print(f'outfits.ts VIDEOS에 추가: "{outfit_id}": {{ video: require("../../assets/outfits/{outfit_id}.mp4"), '
          f'poster: require("../../assets/outfits/{outfit_id}.jpg") }},')


if __name__ == "__main__":
    main()
