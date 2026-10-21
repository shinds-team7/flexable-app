"""코스튬 영상을 앱 규격으로 맞춘다(docs/coin-plan.md "영상 파일 넣기").

H.264 · 소리 없음 · 1280x720 · 가장자리를 무대 색 #EEF2FA로 서서히 녹임, 그리고 첫 장면 JPG를 만든다.
받은 영상의 배경이 무대 색과 달라도 경계가 보이지 않게 하기 위한 것이다.

사용: python scripts/prepare-outfit-video.py <받은 영상.mp4> <코스튬 id> [첫 화면 이미지]
  예) python scripts/prepare-outfit-video.py ~/Downloads/cat_mine.mp4 costume-lv1 ~/Downloads/cat-mine-thumbnail.jpg
첫 화면 이미지를 주면 영상 첫 장면 대신 그 이미지를 같은 규격(1280x720, 가장자리 녹임)으로 만들어 쓴다.
결과: assets/outfits/<id>.mp4, assets/outfits/<id>.jpg
ffmpeg가 PATH에 없으면 `pip install imageio-ffmpeg`로 받은 것을 쓴다.
"""
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
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    src, outfit_id = os.path.expanduser(sys.argv[1]), sys.argv[2]
    thumbnail = os.path.expanduser(sys.argv[3]) if len(sys.argv) == 4 else None
    if not re.fullmatch(r"(costume-lv[1-5]|outfit-\d{2})", outfit_id):
        sys.exit("코스튬 id는 costume-lv1~5 또는 outfit-01~10 형식이에요")
    os.makedirs(OUT_DIR, exist_ok=True)
    video = os.path.join(OUT_DIR, outfit_id + ".mp4")
    poster = os.path.join(OUT_DIR, outfit_id + ".jpg")

    # 가장자리까지 거리를 0~1로 잰 뒤 smoothstep으로 부드럽게 하고, 가로·세로를 곱해 모서리도 둥글게 녹인다.
    tx = f"clip(min(X,W-1-X)/{FADE_X},0,1)"
    ty = f"clip(min(Y,H-1-Y)/{FADE_Y},0,1)"
    sx = f"({tx}*{tx}*(3-2*{tx}))"
    sy = f"({ty}*{ty}*(3-2*{ty}))"
    r, g, b = STAGE
    graph = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,format=rgba[v];"
        f"color=c=0x{r:02X}{g:02X}{b:02X}:s={W}x{H}:r=30,format=rgba,"
        f"geq=r={r}:g={g}:b={b}:a='255*(1-{sx}*{sy})'[edge];"
        "[v][edge]overlay=shortest=1,format=yuv420p"
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
