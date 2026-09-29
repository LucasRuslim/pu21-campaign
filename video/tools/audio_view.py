# 配樂的頻譜圖 + 音量曲線（看不到聲音，至少看得到結構）：python3 video/tools/audio_view.py in.wav out.png
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.io import wavfile
from scipy.signal import stft
sr, x = wavfile.read(sys.argv[1]); x = x.astype(np.float32) / 32768; m = x.mean(axis=1)
f, t, Z = stft(m, fs=sr, nperseg=2048, noverlap=1536)
S = 20 * np.log10(np.abs(Z) + 1e-6)
# 對數頻率軸 30 Hz – 16 kHz
H, Wd = 360, 1500
fl = np.geomspace(30, 16000, H)
idx = np.searchsorted(f, fl).clip(0, len(f) - 1)
img = S[idx][::-1]
img = np.clip((img + 90) / 70, 0, 1)
cols = np.stack([img ** 1.5 * 255, img ** 0.8 * 200, (1 - (1 - img) ** 2) * 255], -1).astype(np.uint8)
im = Image.fromarray(cols).resize((Wd, H))
canvas = Image.new("RGB", (Wd, H + 160), (15, 15, 20)); canvas.paste(im, (0, 0))
d = ImageDraw.Draw(canvas)
dur = len(m) / sr
win = int(0.05 * sr)
rms = [np.sqrt(np.mean(m[i:i + win] ** 2)) for i in range(0, len(m) - win, win)]
pts = [(i * Wd / len(rms), H + 150 - (20 * np.log10(r + 1e-6) + 50) * 2.8) for i, r in enumerate(rms)]
d.line(pts, fill=(120, 200, 255), width=2)
for s in range(int(dur) + 1):
    x0 = s * Wd / dur; d.line([(x0, 0), (x0, H + 160)], fill=(80, 80, 90)); d.text((x0 + 2, H + 2), f"{s}s", fill=(230, 230, 230))
for db in (-40, -30, -20, -10):
    y = H + 150 - (db + 50) * 2.8; d.text((2, y - 6), f"{db}", fill=(150, 150, 150))
canvas.save(sys.argv[2])
