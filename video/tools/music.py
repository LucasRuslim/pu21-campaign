"""
影片配樂 + 音效（全部用程式合成，沒有取樣、沒有版權問題）。
96 BPM、D 大調，一小節 2.5 秒，跟畫面的時間表（build/timeline.json，由 render.mjs 寫出）對齊。

  小節 1  Bm   夜空、流星（音樂盒旋律、流星呼嘯、字點亮的星光聲）
  小節 2  G    「他一定也會這麼做的」
  小節 3  D    鏡頭搖到花田；8 張紙條飄上來 = 8 個往上爬的音
  小節 4  A    紙條燒成光（32 分音符的閃光）、8 顆流星落地 = 8 個鐘聲；漸強
  小節 5  G→A  權杖落地：低音爆 + 鈸 + 合唱；「寫下你的願望」
  小節 6  D    結尾卡：解決到主和弦，鐘聲，慢慢收掉

用法：python3 video/tools/music.py  →  video/build/music.wav
"""
import json
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, istft, sosfilt, stft

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "build")
SR = 48000
DUR = 15.0
BEAT = 60 / 96
TAIL = 4.0
N = int((DUR + TAIL) * SR)
rng = np.random.default_rng(20251005)

with open(os.path.join(BUILD, "timeline.json")) as f:
    T = json.load(f)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t0, pan=0.0, gain=1.0):
        """sig：單聲道或 (2, n)；pan -1 左 … 1 右（等功率）"""
        i0 = int(round(t0 * SR))
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        n = min(sig.shape[1], N - i0)
        if n > 0:
            self.x[:, i0:i0 + n] += sig[:, :n] * gain


# ---------------------------------------------------------------- 樂器
def music_box(f, dur=2.6, vel=1.0):
    t = tt(dur)
    parts = [(1, 1.0, 1.5), (2, 0.32, 0.8), (3, 0.08, 0.45), (4.16, 0.10, 0.22), (5.43, 0.05, 0.14), (8.9, 0.025, 0.07)]
    s = np.zeros_like(t)
    for r, a, d in parts:
        if f * r < 16000:
            s += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    s *= 1 - np.exp(-t / 0.0015)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.004) * 0.04
    return (s + click) * vel


def bell(f, dur=4.0, vel=1.0):
    t = tt(dur)
    index = 2.4 * np.exp(-t / 0.35)
    s = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * 1.4 * t)) * np.exp(-t / 1.3)
    s += 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.45)
    s += 0.18 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.18)
    s *= 1 - np.exp(-t / 0.001)
    return s * vel


def saw(f, t, detune_cents=0.0, vib=0.0):
    f = f * 2 ** (detune_cents / 1200)
    phase = 2 * np.pi * f * t
    if vib:
        phase += vib * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6.28)) * 2 * np.pi * f / (2 * np.pi * 5.2)
    s = np.zeros_like(t)
    kmax = int(min(28, 11000 / f))
    for k in range(1, kmax + 1):
        s += np.sin(k * phase + rng.uniform(0, 6.28)) / k
    return s


def env_adsr(n, att, rel, total):
    t = np.arange(n) / SR
    e = np.clip(t / max(att, 1e-4), 0, 1)
    e = 0.5 - 0.5 * np.cos(np.pi * e)
    r0 = total - rel
    tail = np.clip((t - r0) / rel, 0, 1)
    return e * (1 - tail) ** 2


def pad(notes, dur, vel, cutoff=1600, att=0.9, rel=1.4):
    """一個和弦：每個音三個微微走音的鋸齒波，左右分開"""
    total = dur + rel
    t = tt(total)
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    for m in notes:
        f = midi(m)
        L += saw(f, t, -7) + 0.6 * saw(f, t, 3)
        R += saw(f, t, 7) + 0.6 * saw(f, t, -3)
    e = env_adsr(len(t), att, rel, total)
    out = np.vstack([lp(L, cutoff), lp(R, cutoff)]) * e * vel / max(1, len(notes))
    return out


def choir(notes, dur, vel, att=0.35, rel=1.8):
    """「啊——」：鋸齒波經過母音共振峰"""
    total = dur + rel
    t = tt(total)
    src = np.zeros_like(t)
    for m in notes:
        src += saw(midi(m), t, rng.uniform(-6, 6), vib=0.004) + saw(midi(m), t, rng.uniform(-6, 6), vib=0.004)
    v = bp(src, 650, 950) * 1.0 + bp(src, 1050, 1300) * 0.55 + bp(src, 2600, 3100) * 0.22
    e = env_adsr(len(t), att, rel, total)
    v = v * e * vel / max(1, len(notes))
    return np.vstack([v, np.roll(v, int(0.011 * SR))])


def bass(m, dur, vel, rel=0.9):
    total = dur + rel
    t = tt(total)
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    return lp(s, 400) * env_adsr(len(t), 0.06, rel, total) * vel


def boom(vel=1.0, length=2.2):
    t = tt(length)
    f = 36 + 60 * np.exp(-t / 0.09)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.55 * length / 2.2))
    thump = lp(rng.standard_normal(len(t)), 160) * np.exp(-t / 0.06) * 2.5
    mid = np.sin(2 * np.pi * 105 * t) * np.exp(-t / 0.18) * 0.35
    return (s + thump + mid) * vel


def kick(vel=1.0):
    t = tt(0.5)
    f = 45 + 90 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return s * vel


def tom(m, vel=1.0):
    t = tt(0.7)
    f = midi(m) * (1 + 0.5 * np.exp(-t / 0.02))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    s += lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.03) * 0.4
    return s * vel


def shaker(vel=1.0):
    t = tt(0.12)
    return hp(rng.standard_normal(len(t)), 6500) * np.exp(-t / 0.025) * vel


def crash(vel=1.0, length=3.5):
    t = tt(length)
    n = rng.standard_normal((2, len(t)))
    s = np.vstack([hp(n[0], 4500) , hp(n[1], 4500)]) * np.exp(-t / 1.0)
    s += np.vstack([bp(n[0], 7000, 12000), bp(n[1], 7000, 12000)]) * np.exp(-t / 1.6) * 0.6
    s *= 1 - np.exp(-t / 0.002)
    return s * vel


def shaped_noise(dur, fc_fn, width_oct, amp_fn, stereo_pan_fn=None):
    """隨時間移動的帶通雜訊（呼嘯、上升音）：在頻譜上畫一個會移動的高斯帶"""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    nper = 2048
    f, fr, Z = stft(x, fs=SR, nperseg=nper, noverlap=nper * 3 // 4)
    times = fr
    logf = np.log2(np.maximum(f, 20))[:, None]
    fc = np.log2(np.array([fc_fn(tm / dur) for tm in times]))[None, :]
    mask = np.exp(-0.5 * ((logf - fc) / width_oct) ** 2)
    _, y = istft(Z * mask, fs=SR, nperseg=nper, noverlap=nper * 3 // 4)
    y = y[:n]
    y = y / (np.max(np.abs(y)) + 1e-9)
    tm = np.arange(n) / n
    y *= np.array([amp_fn(v) for v in np.linspace(0, 1, 512)])[np.minimum((tm * 511).astype(int), 511)]
    if stereo_pan_fn is None:
        return y
    pans = np.array([stereo_pan_fn(v) for v in np.linspace(0, 1, 512)])[np.minimum((tm * 511).astype(int), 511)]
    a = (pans + 1) * np.pi / 4
    return np.vstack([y * np.cos(a), y * np.sin(a)]) * np.sqrt(2)


def whoosh(dur, f0, f1, vel, pan0=0.0, pan1=0.0, peak=0.6, width=0.55):
    def amp(u):
        return (u / peak) ** 2 if u < peak else (1 - (u - peak) / (1 - peak)) ** 1.6
    return shaped_noise(dur, lambda u: f0 * (f1 / f0) ** u, width, amp, lambda u: pan0 + (pan1 - pan0) * u) * vel


PENTA = [74, 76, 78, 81, 83]      # D 大調五聲音階


def sparkles(bus, t0, span, n, vel, lo=86, hi=103, seed=0):
    r = np.random.default_rng(seed)
    notes = [m for m in range(lo, hi) if (m % 12) in {p % 12 for p in PENTA}]
    for _ in range(n):
        m = r.choice(notes)
        f = midi(m)
        t = tt(0.5)
        s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t / r.uniform(0.06, 0.18)) * (1 - np.exp(-t / 0.001))
        bus.add(s * vel * r.uniform(0.4, 1.0), t0 + r.uniform(0, span), pan=r.uniform(-0.8, 0.8))


# ---------------------------------------------------------------- 混音
mbox = Bus()     # 音樂盒旋律、琶音（多殘響）
sfx = Bus()      # 呼嘯、閃光、鐘聲、鈸（多殘響）
padb = Bus()     # 和弦、合唱（中等殘響）
bassb = Bus()    # 低音（少量殘響）
drums = Bus()    # 低音爆、大鼓、沙鈴（少量殘響）
b = lambda beat: beat * BEAT

# 和弦（開始拍、長度拍、音、力度、濾波）
CHORDS = [
    (0, 4.3, [59, 62, 66, 71], 0.10, 1300, 1.6),       # Bm
    (4, 4.3, [55, 59, 62, 74], 0.11, 1400, 0.8),       # G
    (8, 4.3, [54, 62, 66, 69, 74], 0.13, 1700, 0.6),   # D/F#
    (12, 4.0, [57, 61, 64, 69, 76], 0.15, 2100, 0.5),  # A（漸強）
    (16, 2.1, [55, 59, 62, 67, 71, 74], 0.15, 3000, 0.08),   # G（權杖落地）
    (18, 2.1, [57, 61, 64, 69, 73, 76], 0.15, 3200, 0.1),    # A
    (20, 4.4, [50, 57, 62, 66, 69, 76], 0.14, 2600, 0.15),    # D add9（結尾）
]
for beat, dur, notes, vel, cut, att in CHORDS:
    padb.add(pad(notes, b(dur), vel, cutoff=cut, att=att), b(beat))
# 小節 4 的漸強：再疊一層越來越亮的和弦
padb.add(pad([57, 64, 69, 73, 76], b(4), 0.1, cutoff=4000, att=b(3.6), rel=0.15), b(12))

# 合唱（權杖落地之後）
padb.add(choir([62, 67, 71], b(2), 0.4), b(16))
padb.add(choir([64, 69, 73], b(2), 0.4), b(18))
padb.add(choir([62, 66, 69, 74], b(4), 0.36, rel=2.2), b(20))

# 低音
for beat, dur, ms, vel in [(8, 4, [38], 0.7), (12, 4, [45], 0.75), (16, 2, [43, 55], 0.9), (18, 2, [45, 57], 0.9), (20, 4, [38, 50], 0.9)]:
    for m in ms:
        bassb.add(bass(m, b(dur), vel), b(beat))

# 音樂盒旋律（拍、MIDI、力度）
MELODY = [
    (0.5, 78, 0.55), (1.5, 76, 0.4), (2.0, 74, 0.5), (3.0, 78, 0.45),        # Bm
    (4.0, 79, 0.55), (5.5, 78, 0.4), (6.0, 74, 0.5), (7.0, 71, 0.45),        # G
    (11.0, 81, 0.5), (11.5, 78, 0.35),                                        # D（紙條音之後）
    (12.0, 76, 0.4), (14.0, 73, 0.3),                                         # A
    (16.0, 86, 0.6), (17.0, 83, 0.45), (17.5, 81, 0.4), (18.0, 85, 0.55), (19.0, 88, 0.55),   # G → A
    (20.0, 90, 0.6), (20.0, 86, 0.35), (20.0, 81, 0.3), (21.0, 88, 0.3), (22.0, 86, 0.35), (23.0, 81, 0.25),  # D
]
for beat, m, vel in MELODY:
    mbox.add(music_box(midi(m), 2.8, vel), b(beat), pan=float(np.clip((m - 80) / 20, -0.4, 0.4)))
# 伴奏琶音（低一個八度、輕）
ARP = {8: [62, 66, 69, 74], 12: [61, 64, 69, 73], 16: [59, 62, 67, 71], 18: [61, 64, 69, 73], 20: [62, 66, 69, 74]}
for bar_beat, notes in ARP.items():
    length = 2 if bar_beat in (16, 18) else 4
    for k in range(int(length * 2)):
        if bar_beat == 8 and 0.5 <= k / 2 < 2.5:
            continue    # 這裡讓給紙條的音
        mbox.add(music_box(midi(notes[k % 4]), 1.6, 0.16), b(bar_beat + k / 2), pan=(k % 4 - 1.5) * 0.25)

# ---------------------------------------------------------------- 音效（跟畫面同步）
hero_t0, hero_dur = T["hero"], T["heroDur"]
# 大流星：從左劃到右
sfx.add(whoosh(hero_dur + 0.3, 900, 5200, 0.5, pan0=-0.9, pan1=0.9, peak=0.45, width=0.45), hero_t0 - 0.05)
sfx.add(whoosh(hero_dur + 0.3, 180, 700, 0.3, pan0=-0.7, pan1=0.7, peak=0.45, width=0.7), hero_t0 - 0.05)
# 第一行字一個一個被點亮
for i, tc in enumerate(np.linspace(0.49, 1.02, 7)):
    mbox.add(music_box(midi([86, 88, 90, 93, 95, 98, 100][i]), 1.2, 0.2), tc, pan=-0.6 + i * 0.2)
    sparkles(sfx, tc, 0.15, 3, 0.1, seed=10 + i)
# 小流星
for k, tm in enumerate([1.7, 2.6, 3.3, 3.9]):
    sfx.add(whoosh(0.5, 2500, 7000, 0.12, pan0=-0.5, pan1=0.5), tm)
# 第二行出現：一陣輕輕的閃光
sparkles(sfx, T["line2"], 0.9, 14, 0.1, seed=30)
# 字散開 + 鏡頭往下搖
sparkles(sfx, T["quoteOut"], 0.6, 18, 0.09, lo=93, hi=108, seed=40)
sfx.add(whoosh(1.9, 5000, 700, 0.3, pan0=0.3, pan1=-0.3, peak=0.35, width=0.6), T["tilt0"] - 0.1)
drums.add(boom(0.28, 1.6), b(8))       # 小節 3 第一拍：輕輕的低音
# 8 張紙條飄上來：往上爬的音
RISE = [74, 78, 81, 86, 88, 90, 93, 98]
for i, tn in enumerate(T["noteIn"]):
    mbox.add(music_box(midi(RISE[i]), 2.0, 0.42), tn, pan=-0.5 + (i % 4) * 0.33)
# 紙條燒成光
for i in range(8):
    ti = T["ignite"] + i * T["igniteStep"]
    sfx.add(whoosh(0.35, 3000, 9000, 0.08, peak=0.25), ti)
    sparkles(sfx, ti, 0.3, 4, 0.05, lo=98, hi=110, seed=60 + i)
    sfx.add(music_box(midi([93, 97, 100, 102, 105, 100, 97, 105][i]), 0.9, 0.12), ti, pan=-0.7 + i * 0.2)
# 光球落下 + 落地的鐘聲
LAND_BELLS = [81, 83, 85, 88, 90, 93, 95, 97]
for i, tl in enumerate(T["land"]):
    launch = T["ignite"] + i * T["igniteStep"] + 0.18
    sfx.add(whoosh(tl - launch + 0.05, 4200, 1300, 0.07, pan0=0.4 - i * 0.1, pan1=-0.3 + i * 0.1, peak=0.8, width=0.4), launch)
    sfx.add(bell(midi(LAND_BELLS[i]), 3.2, 0.13), tl, pan=-0.6 + (i * 0.37) % 1.2)
    drums.add(kick(0.18), tl)
    sparkles(sfx, tl, 0.25, 5, 0.045, seed=80 + i)
# 小節 4 的心跳
for k in range(4):
    drums.add(kick(0.22 + k * 0.05), b(12 + k))
# 權杖落下前的上升音
riser_t0 = b(14.5)
riser_len = T["impact"] - riser_t0
sfx.add(shaped_noise(riser_len, lambda u: 400 * (9000 / 400) ** (u ** 1.3), 0.5, lambda u: u ** 2.4) * 0.22, riser_t0)
tr = tt(riser_len)
sweep_f = 200 * (1200 / 200) ** ((tr / riser_len) ** 1.5)
sweep = np.sin(2 * np.pi * np.cumsum(sweep_f) / SR) * (tr / riser_len) ** 2.5 * 0.05
padb.add(sweep, riser_t0)
sfx.add(whoosh(T["impact"] - T["fall"], 300, 3500, 0.3, peak=0.95, width=0.5), T["fall"])
# 權杖落地！
drums.add(boom(1.0), T["impact"])
sfx.add(crash(0.22), T["impact"])
sparkles(sfx, T["impact"], 1.4, 40, 0.05, lo=90, hi=110, seed=200)
sfx.add(bell(midi(62), 5.0, 0.18), T["impact"])
sfx.add(bell(midi(74), 5.0, 0.14), T["impact"])
# 小節 5 的節奏
for k in range(1, 4):
    drums.add(kick(0.3), b(16 + k))
for k in range(16):
    drums.add(shaker(0.05 if k % 2 else 0.08), b(16 + k / 4))
for beat, m, v in [(19.0, 50, 0.3), (19.5, 47, 0.32), (19.75, 45, 0.36)]:
    drums.add(tom(m, v), b(beat))
# 權杖飛走 + 結尾卡
sfx.add(whoosh(0.65, 600, 7000, 0.22, peak=0.4, width=0.5), T["end"] - 0.08)
drums.add(boom(0.55, 1.8), T["end"])
sfx.add(crash(0.1, 3.0), T["end"])
sfx.add(bell(midi(86), 4.5, 0.2), T["end"] + 0.47)
sfx.add(bell(midi(93), 4.5, 0.12), T["end"] + 0.47)
sparkles(sfx, T["end"] + 0.45, 0.8, 18, 0.05, seed=300)
sfx.add(music_box(midi(98), 1.5, 0.2), T["end"] + 0.9)      # 按鈕跳出來

# ---------------------------------------------------------------- 殘響
def make_ir(sec, seed, damp=5500):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        noise = r.standard_normal(n)
        bright = lp(noise, damp) * np.exp(-t * 6.9 / (sec * 0.55))
        dark = lp(noise, 1800) * np.exp(-t * 6.9 / sec)
        ir[ch] = bright * 0.6 + dark
        pre = int(0.018 * SR)
        ir[ch] = np.concatenate([np.zeros(pre), ir[ch][:-pre]])
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


def reverb(x, ir, mix):
    y = np.vstack([fftconvolve(x[0], ir[0])[:N], fftconvolve(x[1], ir[1])[:N]])
    return x * (1 - mix * 0.35) + y * mix


IR_BIG = make_ir(3.4, 1)
IR_MID = make_ir(2.4, 2)
GAIN = {"mbox": 0.26, "sfx": 1.0, "padb": 2.4, "bassb": 0.13, "drums": 0.62}
if os.environ.get("LEVELS"):
    for name in GAIN:
        x = globals()[name].x.mean(axis=0)
        bars = [x[int(k * 4 * BEAT * SR):int((k + 1) * 4 * BEAT * SR)] for k in range(6)]
        print(f"{name:6s}", " ".join(f"{20*np.log10(np.sqrt(np.mean(v**2))+1e-9):6.1f}" for v in bars))
mixdown = (reverb(mbox.x * GAIN["mbox"] + sfx.x * GAIN["sfx"], IR_BIG, 0.5) + reverb(padb.x * GAIN["padb"], IR_MID, 0.35)
           + reverb(bassb.x * GAIN["bassb"] + drums.x * GAIN["drums"], IR_MID, 0.08))
mixdown = np.vstack([hp(mixdown[0], 38), hp(mixdown[1], 38)])

# 母帶：柔和壓縮（tanh）、峰值 -1 dBFS、頭尾淡入淡出
mixdown = mixdown[:, : int(DUR * SR)]
peak = np.max(np.abs(mixdown))
mixdown = np.tanh(mixdown / peak * 1.15) / np.tanh(1.15)
mixdown *= 10 ** (-1 / 20) / np.max(np.abs(mixdown))
n = mixdown.shape[1]
fade_in = np.clip(np.arange(n) / (0.03 * SR), 0, 1)
fade_out = np.clip((DUR - np.arange(n) / SR) / 0.6, 0, 1) ** 1.5
mixdown *= fade_in * fade_out

rms = np.sqrt(np.mean(mixdown ** 2))
print(f"peak {20*np.log10(np.max(np.abs(mixdown))):.1f} dBFS, rms {20*np.log10(rms):.1f} dBFS")
os.makedirs(BUILD, exist_ok=True)
wavfile.write(os.path.join(BUILD, "music.wav"), SR, (mixdown.T * 32767).astype(np.int16))
print("wrote", os.path.join(BUILD, "music.wav"))
