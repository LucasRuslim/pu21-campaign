"""
把畫面（build/*_silent.mp4）和配樂（build/music.wav）合成成品，放到 video/out/：
  pu21_feed_music.mp4    貼文 1080×1350，有配樂
  pu21_feed_silent.mp4   貼文，無聲（想在 IG 裡自己加音樂用）
  pu21_story_music.mp4   限時動態 1080×1920，有配樂
  pu21_story_silent.mp4  限時動態，無聲
  pu21_feed_cover.jpg    貼文封面（結尾卡那一格）
  pu21_story_cover.jpg   限時動態最後一格（備用）
"""
import os
import shutil
import subprocess

import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "build")
OUT = os.path.join(HERE, "..", "out")
FF = imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs(OUT, exist_ok=True)


def run(*args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)


for fmt in ("feed", "story"):
    silent = os.path.join(BUILD, f"{fmt}_silent.mp4")
    if not os.path.exists(silent):
        print("missing", silent)
        continue
    # 有配樂：影像直接複製（不重壓），聲音壓成 AAC 256k / 48 kHz
    run("-i", silent, "-i", os.path.join(BUILD, "music.wav"),
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
        "-shortest", "-movflags", "+faststart", os.path.join(OUT, f"pu21_{fmt}_music.mp4"))
    shutil.copyfile(silent, os.path.join(OUT, f"pu21_{fmt}_silent.mp4"))
    still = os.path.join(BUILD, "stills", f"{fmt}_14.50.png")
    if os.path.exists(still):
        run("-i", still, "-q:v", "2", os.path.join(OUT, f"pu21_{fmt}_cover.jpg"))
    print("done", fmt)

for f in sorted(os.listdir(OUT)):
    print(f"{f:28s} {os.path.getsize(os.path.join(OUT, f)) / 1e6:6.1f} MB")
