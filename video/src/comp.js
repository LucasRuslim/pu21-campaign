/* =========================================================
   普二一競選團 · IG 宣傳影片（15 秒）
   整支影片就是一個 draw(t)：同一個 t 永遠畫出同一張畫面，錄影時一格一格呼叫。
     ?fmt=feed   → 1080×1350（貼文 4:5）
     ?fmt=story  → 1080×1920（限時動態 9:16）
     ?t=3.2      → 只畫某一秒（檢查畫面用）
     ?play       → 即時播放（在瀏覽器預覽）
   要改字：改下面的 COPY。要改節奏：改 T（音樂 music.py 也讀同一份時間表）。
   ========================================================= */
(function () {
  "use strict";

  const Q = new URLSearchParams(location.search);
  const STORY = Q.get("fmt") === "story";
  const W = 1080, H = STORY ? 1920 : 1350;
  const DUR = 15, FPS = 30;
  const cv = document.getElementById("c");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  /* ---------------- 文字 ---------------- */
  const COPY = {
    line1: "如果是欣梅爾，",
    line2: "他一定也會這麼做的。",
    caption: "《葬送的芙莉蓮》",
    s3a: "所以我們也想——",
    s3b: "聽見你的每一個願望。",
    s3c: "再小的事，都算數。",
    title: "寫下你的願望",
    sub: "如果我們當選，你希望學校有什麼改變？",
    wishes: ["零錢兌換機", "多一台飲水機", "福利社快一點", "冷氣早點開", "園遊會多一天", "社團時間多一點", "走廊加椅子", "午餐更多選擇"],
    pres: { role: "會長", name: "張芝穎" },
    vice: { role: "副會長", name: "陳奕璁" },
    team: "普二一競選團",
    number: "2",
    date: "10.05",
    dateDay: "（一）",
    ctaFeed: "點主頁連結寫願望",
    ctaStory: "點下方連結，寫下你的願望"
  };

  /* ---------------- 時間表（秒）：96 BPM，一小節 2.5 秒 ---------------- */
  const T = {
    hero: 0.12, heroDur: 1.25,          // 開場的大流星（經過時點亮第一行字）
    line2: 2.5, caption: 3.3,
    quoteOut: 4.4,
    tilt0: 4.5, tilt1: 6.3,              // 鏡頭從夜空往下搖到花田
    s3a: 5.05, s3aOut: 6.0,
    s3b: 6.2, s3bOut: 7.95,
    s3c: 8.55, s3cOut: 9.7,
    noteIn: [5.25, 5.4, 5.55, 5.72, 5.9, 6.06, 6.24, 6.42],
    ignite: 7.5, igniteStep: 0.075, burn: 0.5,
    land: [8.125, 8.281, 8.4375, 8.594, 8.75, 8.906, 9.0625, 9.375],
    fall: 9.42, impact: 10.0,            // 權杖落地
    title: 10.12, sub: 10.8,
    end: 12.5                            // 結尾卡
  };

  /* ---------------- 版面（兩種尺寸） ---------------- */
  const LY = STORY ? {
    hor1: 1130,
    quoteY: 800, lineGap: 118, quoteSize: 86, captionY: 1010,
    s3Y: 430, s3Size: 76,
    noteBand: [560, 1040], noteText: 40,
    orbY: 520, footY: 1650, magicR: 330,
    titleY: 1265, titleSize: 140, subY: 1372, subSize: 37,
    end: {
      emblem: { x: 540, y: 505, r: 140 }, teamY: 690,
      titleY: 1222, titleScale: 0.9, subY: 1312,
      ctaY: 1408, slotY: 1500, topY: 330,
      plaqueY: 1062,
      pres: { fx: 258, fy: 548, head: 205 }, vice: { fx: 822, fy: 548, head: 205 },
      fade: [900, 1075]
    }
  } : {
    hor1: 790,
    quoteY: 520, lineGap: 112, quoteSize: 80, captionY: 722,
    s3Y: 250, s3Size: 72,
    noteBand: [340, 700], noteText: 38,
    orbY: 330, footY: 1170, magicR: 300,
    titleY: 900, titleSize: 132, subY: 998, subSize: 34,
    end: {
      emblem: { x: 540, y: 212, r: 126 }, teamY: 372,
      titleY: 878, titleScale: 0.86, subY: 958,
      pillY: 1058, footY: 1186,
      plaqueY: 730,
      pres: { fx: 262, fy: 246, head: 172 }, vice: { fx: 818, fy: 246, head: 172 },
      fade: [600, 760]
    }
  };

  /* ---------------- 顏色 & 字型 ---------------- */
  const C = { ivory: "#f5f2ea", mana: "#3f7fcf", manaHi: "#a8dcff", manaDeep: "#1d3f73", gold: "#e6c98a", ink: "#151a26", muted: "#9aa6ba" };
  const F = {
    serif: (s, w = 900) => `${w} ${s}px "Noto Serif TC"`,
    display: (s) => `900 ${s}px "Chiron Hei HK", "Noto Sans TC"`,
    sans: (s, w = 500) => `${w} ${s}px "Noto Sans TC"`,
    hand: (s) => `700 ${s}px "LXGW WenKai TC"`,
    latin: (s) => `italic 600 ${s}px "Cormorant Garamond"`
  };

  /* ---------------- 小工具 ---------------- */
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(PI * t) - 1) / 2,
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
  };
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r()); }
  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function sprite(img, x, y, r, a, sy) {
    if (a <= 0.003 || r <= 0.2) return;
    ctx.globalAlpha = Math.min(1, a);
    const ry = r * (sy || 1);
    ctx.drawImage(img, x - r, y - ry, r * 2, ry * 2);
  }
  // 1D 平滑雜訊（山的輪廓）
  function noise1(seed) {
    const r = mulberry(seed), v = []; for (let i = 0; i < 512; i++) v.push(r());
    return (x) => { const i = Math.floor(x), f = x - i, a = v[((i % 512) + 512) % 512], b = v[(((i + 1) % 512) + 512) % 512]; return lerp(a, b, f * f * (3 - 2 * f)); };
  }
  // 2D value noise（紙燒掉的形狀）
  function noise2(seed) {
    const r = mulberry(seed), P = 64, v = new Float32Array(P * P); for (let i = 0; i < v.length; i++) v[i] = r();
    const at = (x, y) => v[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), w);
    };
  }

  /* =========================================================
     預先畫好的圖（光點、花、紙條…）
     ========================================================= */
  function glowSprite(inner, mid, size = 128, midStop = 0.22) {
    const c = mk(size, size), g = c.getContext("2d");
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(midStop, mid); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  const GLOW_WHITE = glowSprite("rgba(255,255,255,1)", "rgba(205,228,255,0.38)");
  const GLOW_BLUE = glowSprite("rgba(214,236,255,1)", "rgba(79,146,232,0.42)");
  const GLOW_GOLD = glowSprite("rgba(255,246,220,1)", "rgba(232,192,112,0.4)");
  const GLOW_RED = glowSprite("rgba(255,236,230,1)", "rgba(255,58,48,0.5)");
  const GLOW_SOFT = glowSprite("rgba(110,165,255,0.6)", "rgba(58,108,210,0.28)", 128, 0.35);

  const FLARE = (function () {
    const S = 256, m = S / 2, c = mk(S, S), g = c.getContext("2d");
    g.globalCompositeOperation = "lighter";
    for (const [sx, sy] of [[1, 0.03], [0.03, 1]]) {
      const gr = g.createRadialGradient(m, m, 0, m, m, m);
      gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.25, "rgba(185,218,255,0.38)"); gr.addColorStop(1, "rgba(120,170,255,0)");
      g.save(); g.translate(m, m); g.scale(sx, sy); g.translate(-m, -m); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
    }
    g.drawImage(GLOW_WHITE, m - 40, m - 40, 80, 80);
    return c;
  })();
  // 橫向的光（變形鏡頭的光條）
  const STREAK = (function () {
    const c = mk(512, 64), g = c.getContext("2d");
    const gr = g.createRadialGradient(256, 32, 0, 256, 32, 256);
    gr.addColorStop(0, "rgba(235,245,255,1)"); gr.addColorStop(0.2, "rgba(140,195,255,0.45)"); gr.addColorStop(1, "rgba(60,120,230,0)");
    g.save(); g.translate(256, 32); g.scale(1, 0.12); g.translate(-256, -32); g.fillStyle = gr; g.fillRect(0, -300, 512, 664); g.restore();
    return c;
  })();

  /* ---- 花（跟網站 js/flowers.js 同一套畫法：蒼月草、白花、淡紫） ---- */
  const FS = 256, FC = 128, FK = FC / 110;
  function petalPath(g, len, w, shape) {
    g.beginPath(); g.moveTo(0, 0);
    if (shape === "thin") {
      g.bezierCurveTo(w * 0.7, -len * 0.25, w * 0.6, -len * 0.9, 0, -len);
      g.bezierCurveTo(-w * 0.6, -len * 0.9, -w * 0.7, -len * 0.25, 0, 0);
    } else {
      g.bezierCurveTo(w * 0.75, -len * 0.12, w * 0.72, -len * 1.02, 0, -len);
      g.bezierCurveTo(-w * 0.72, -len * 1.02, -w * 0.75, -len * 0.12, 0, 0);
    }
    g.closePath();
  }
  function makeFlower(spec, seed) {
    const r = mulberry(seed), c = mk(FS, FS), g = c.getContext("2d");
    g.translate(FC, FC);
    for (const ring of spec.rings) {
      for (let i = 0; i < ring.n; i++) {
        g.save();
        g.rotate((i / ring.n) * TAU + (ring.rot || 0) + (r() - 0.5) * 0.1);
        const len = ring.len * (1 - r() * 0.08);
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, len);
        grd.addColorStop(0, ring.base); grd.addColorStop(0.6, ring.mid); grd.addColorStop(1, ring.tip);
        g.shadowColor = "rgba(6,12,28,.35)"; g.shadowBlur = 7; g.shadowOffsetY = 2;
        petalPath(g, len, ring.w, ring.shape);
        g.fillStyle = grd; g.fill();
        g.shadowColor = "transparent";
        g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.12)"; g.stroke();
        g.beginPath(); g.moveTo(0, -len * 0.12); g.quadraticCurveTo(len * 0.03, -len * 0.5, 0, -len * 0.82);
        g.strokeStyle = "rgba(255,255,255,.3)"; g.stroke();
        g.restore();
      }
    }
    const cc = spec.c, grd = g.createRadialGradient(-cc.r * 0.3, -cc.r * 0.3, 0, 0, 0, cc.r);
    grd.addColorStop(0, cc.c1); grd.addColorStop(1, cc.c2);
    g.beginPath(); g.arc(0, 0, cc.r, 0, TAU); g.fillStyle = grd; g.fill();
    for (let k = 0; k < cc.st; k++) {
      const b = (k / cc.st) * TAU + r() * 0.2, dd = cc.r * (1.1 + r() * 0.5);
      g.beginPath(); g.moveTo(Math.cos(b) * cc.r * 0.5, Math.sin(b) * cc.r * 0.5); g.lineTo(Math.cos(b) * dd, Math.sin(b) * dd);
      g.strokeStyle = "rgba(255,240,200,.75)"; g.lineWidth = 1.3; g.stroke();
      g.beginPath(); g.arc(Math.cos(b) * dd, Math.sin(b) * dd, 2.6, 0, TAU); g.fillStyle = "#ffe28a"; g.fill();
    }
    return c;
  }
  const FLOWER_SPECS = [
    { w: 6, rings: [{ n: 5, len: 108, w: 74, base: "#1f4a9e", mid: "#4a80d0", tip: "#b3d6ff" }], c: { r: 15, c1: "#fff8d6", c2: "#e4b64a", st: 12 } },   // 蒼月草
    { w: 3, rings: [{ n: 5, len: 106, w: 70, base: "#3469b8", mid: "#79b0ea", tip: "#d8ecff" }], c: { r: 14, c1: "#fffbe6", c2: "#e8c65a", st: 11 } },   // 淺藍
    { w: 2, rings: [{ n: 6, len: 104, w: 64, base: "#93a9da", mid: "#d9e4f6", tip: "#f4f8ff" }], c: { r: 17, c1: "#fff3c4", c2: "#d9a93c", st: 16 } }, // 白花
    { w: 1.3, rings: [{ n: 5, len: 104, w: 66, base: "#5a4db0", mid: "#9d90e2", tip: "#efeaff" }], c: { r: 14, c1: "#fffbe0", c2: "#e8c65a", st: 10 } } // 淡紫
  ];
  const FLOWERS = [], FW = [];
  FLOWER_SPECS.forEach((sp, i) => { for (let v = 0; v < 2; v++) { FLOWERS.push(makeFlower(sp, 31 + i * 7 + v)); FW.push(sp.w); } });
  const FWSUM = FW.reduce((a, b) => a + b, 0);
  // 前景用：模糊 + 暗一點（景深）
  const FLOWERS_NEAR = FLOWERS.map((f) => { const c = mk(FS, FS), g = c.getContext("2d"); g.filter = "blur(5px) brightness(0.5) saturate(1.2)"; g.drawImage(f, 0, 0); return c; });
  function pickFlower(r) { let x = r() * FWSUM; for (let i = 0; i < FLOWERS.length; i++) { x -= FW[i]; if (x <= 0) return i; } return 0; }
  const HERO_FLOWER = makeFlower({ rings: [{ n: 5, len: 108, w: 76, base: "#2a5cb8", mid: "#62a0ea", tip: "#e6f4ff" }, { n: 5, len: 64, w: 50, base: "#3f7fcf", mid: "#a8dcff", tip: "#ffffff", rot: 0.63 }], c: { r: 15, c1: "#fffbe6", c2: "#f0c65a", st: 14 } }, 911);

  const BUD = (function () {
    const c = mk(64, 110), g = c.getContext("2d");
    g.translate(32, 104);
    const gr = g.createLinearGradient(0, -96, 0, 0);
    gr.addColorStop(0, "#7fb0e8"); gr.addColorStop(0.55, "#2c5ea6"); gr.addColorStop(1, "#14305a");
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(24, -22, 20, -70, 0, -98); g.bezierCurveTo(-20, -70, -24, -22, 0, 0);
    g.fillStyle = gr; g.fill();
    g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(6, -50, 0, -92); g.strokeStyle = "rgba(200,230,255,.35)"; g.lineWidth = 2; g.stroke();
    return c;
  })();
  function makeLeaves(seed) {
    const r = mulberry(seed), c = mk(FS, FS), g = c.getContext("2d");
    g.translate(FC, FC);
    for (let i = 0; i < 3; i++) {
      g.save(); g.rotate(-0.9 + i * 0.9 + (r() - 0.5) * 0.3);
      const len = 104 - i * 6, gr = g.createLinearGradient(0, 0, 0, -len);
      gr.addColorStop(0, "#0a1c22"); gr.addColorStop(1, "#1f4a4a");
      petalPath(g, len, 50, "thin"); g.fillStyle = gr; g.fill();
      g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -len * 0.9); g.strokeStyle = "rgba(140,200,220,.22)"; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
    return c;
  }
  const LEAVES = [makeLeaves(5), makeLeaves(6), makeLeaves(7)];

  /* ---- 銀河 ---- */
  const MILKY = (function () {
    const MW = 2000, MH = 760, c = mk(MW, MH), g = c.getContext("2d"), r = mulberry(99);
    const cols = [[110, 150, 235], [150, 125, 230], [205, 220, 255], [80, 118, 210], [120, 185, 255]];
    for (let i = 0; i < 320; i++) {
      const x = r() * MW, y = MH / 2 + gauss(r) * 95 * (0.7 + 0.3 * Math.sin(x / 260)), rad = 40 + r() * 150;
      const col = cols[(r() * cols.length) | 0], a = 0.018 + r() * 0.045;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 90; i++) {
      const x = r() * MW, y = MH / 2 + gauss(r) * 30, rad = 24 + r() * 80;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(0,0,0,0.16)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3200; i++) {
      const x = r() * MW, y = MH / 2 + gauss(r) * 115, s = 0.5 + r() * r() * 1.4;
      g.fillStyle = `rgba(225,235,255,${0.15 + r() * 0.6})`; g.fillRect(x, y, s, s);
    }
    // 兩端淡出
    g.globalCompositeOperation = "destination-in";
    const fade = g.createLinearGradient(0, 0, MW, 0);
    fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(0.2, "rgba(0,0,0,1)"); fade.addColorStop(0.8, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fade; g.fillRect(0, 0, MW, MH);
    return c;
  })();

  /* ---- 月亮（跟權杖一樣是新月） ---- */
  const MOON = (function () {
    const S = 420, m = S / 2, c = mk(S, S), g = c.getContext("2d");
    const halo = g.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, "rgba(200,225,255,0.22)"); halo.addColorStop(0.25, "rgba(140,185,255,0.10)"); halo.addColorStop(1, "rgba(80,130,230,0)");
    g.fillStyle = halo; g.fillRect(0, 0, S, S);
    const d = mk(S, S), dg = d.getContext("2d");
    const body = dg.createRadialGradient(m - 14, m - 12, 4, m, m, 50);
    body.addColorStop(0, "#fffdf4"); body.addColorStop(1, "#e9e3cf");
    dg.shadowColor = "rgba(210,230,255,0.95)"; dg.shadowBlur = 26;
    dg.beginPath(); dg.arc(m, m, 46, 0, TAU); dg.fillStyle = body; dg.fill();
    dg.shadowBlur = 0; dg.globalCompositeOperation = "destination-out";
    dg.beginPath(); dg.arc(m + 20, m - 13, 42, 0, TAU); dg.fill();
    g.drawImage(d, 0, 0);
    return c;
  })();

  /* ---- 雜訊顆粒 & 暗角 ---- */
  const GRAIN = [0, 1, 2, 3].map((k) => {
    const c = mk(W / 2, H / 2), g = c.getContext("2d"), id = g.createImageData(c.width, c.height), r = mulberry(500 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + gauss(r) * 34; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); return c;
  });
  const VIGNETTE = (function () {
    const c = mk(W, H), g = c.getContext("2d");
    const gr = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    gr.addColorStop(0, "rgba(0,0,6,0)"); gr.addColorStop(1, "rgba(0,2,10,0.6)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return c;
  })();
  const BLOOM = mk(W / 4, H / 4), BLOOMG = BLOOM.getContext("2d");
  const BLOOM2 = mk(W / 8, H / 8), BLOOMG2 = BLOOM2.getContext("2d");

  /* =========================================================
     鏡頭：一開始抬頭看流星雨，然後往下搖到花田
     ========================================================= */
  const HOR0 = H + 420;
  const camAt = (t) => E.inOutCubic(seg(t, T.tilt0, T.tilt1));
  const horizonY = (t) => lerp(HOR0, LY.hor1, camAt(t));
  const skyShift = (t) => horizonY(t) - HOR0;          // 天空往上移多少（負的）
  const PAR = { stars: 0.32, milky: 0.3, moon: 0.22, meteor: 0.32, quote: 1.0 };
  const dolly = (t) => 0.034 * Math.max(0, t - 4.6); // 慢慢往前推（花田越來越近）
  function shake(t) {
    const u = t - T.impact; if (u < 0 || u > 0.45) return { x: 0, y: 0 };
    const k = Math.exp(-u * 10) * 9;
    return { x: Math.sin(u * 97) * k, y: Math.cos(u * 83) * k };
  }

  /* =========================================================
     星星、流星
     ========================================================= */
  const STARS = (function () {
    const r = mulberry(11), list = [];
    const n = STORY ? 1000 : 760;
    for (let i = 0; i < n; i++) {
      const mag = Math.pow(r(), 3.2);
      const tint = r();
      list.push({
        x: r() * W, y: -60 + r() * (H + 420), r: 0.5 + mag * 2.6, a: 0.25 + 0.75 * Math.pow(r(), 0.6),
        f: 0.8 + r() * 3.2, ph: r() * TAU, flare: mag > 0.55,
        c: tint < 0.15 ? "#ffe9c9" : tint < 0.55 ? "#e8f1ff" : "#cfe0ff"
      });
    }
    return list;
  })();
  function drawStars(t, sky) {
    ctx.globalCompositeOperation = "lighter";
    for (const s of STARS) {
      const y = s.y + sky * PAR.stars;
      if (y < -20 || y > H + 20) continue;
      const a = s.a * (0.62 + 0.38 * Math.sin(t * s.f + s.ph));
      if (s.r < 1.25) { ctx.globalAlpha = a; ctx.fillStyle = s.c; ctx.fillRect(s.x - s.r * 0.7, y - s.r * 0.7, s.r * 1.4, s.r * 1.4); }
      else sprite(GLOW_WHITE, s.x, y, s.r * 4.2, a);
      if (s.flare) sprite(FLARE, s.x, y, s.r * 13, a * 0.75);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  const heroPath = (function () {
    const y = LY.quoteY, x0 = -200, x1 = W + 200, slope = 0.26;
    return { x0, y0: y - (540 - x0) * slope, x1, y1: y + (x1 - 540) * slope };
  })();
  const METEORS = (function () {
    const r = mulberry(4242), list = [];
    list.push({ hero: true, t0: T.hero, dur: T.heroDur, len: 620, w: 5.2, a: 1 });
    const n = STORY ? 58 : 48;
    for (let i = 0; i < n; i++) {
      const t0 = 0.3 + (i / n) * 4.4 + r() * 0.15;
      const ang = ((22 + r() * 12) * PI) / 180, sp = 1500 + r() * 1400;
      list.push({ t0, dur: 0.35 + r() * 0.5, x0: -160 + r() * W * 0.95, y0: -60 + r() * H * 0.78, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: 110 + r() * 320, w: 1 + r() * 1.9, a: 0.3 + r() * 0.55 });
    }
    // 結尾天空偶爾也有流星
    for (let i = 0; i < 5; i++) {
      const t0 = 10.6 + i * 0.95 + r() * 0.3, ang = ((24 + r() * 8) * PI) / 180, sp = 1400 + r() * 800;
      list.push({ t0, dur: 0.5, x0: -100 + r() * W * 0.7, y0: -40 + r() * LY.hor1 * 0.35, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: 160 + r() * 200, w: 1.3, a: 0.45 });
    }
    return list;
  })();
  function meteorHead(m, t) {
    const age = t - m.t0;
    if (m.hero) {
      const p = age / m.dur, dx = heroPath.x1 - heroPath.x0, dy = heroPath.y1 - heroPath.y0, L = Math.hypot(dx, dy);
      return { x: lerp(heroPath.x0, heroPath.x1, p), y: lerp(heroPath.y0, heroPath.y1, p), ux: dx / L, uy: dy / L };
    }
    const sp = Math.hypot(m.vx, m.vy);
    return { x: m.x0 + m.vx * age, y: m.y0 + m.vy * age, ux: m.vx / sp, uy: m.vy / sp };
  }
  function drawMeteors(t, sky) {
    ctx.globalCompositeOperation = "lighter";
    for (const m of METEORS) {
      const age = t - m.t0;
      if (age < 0 || age > m.dur) continue;
      const p = age / m.dur, h = meteorHead(m, t);
      const hx = h.x, hy = h.y + (m.hero ? 0 : sky * PAR.meteor);
      const env = Math.min(1, age / 0.07) * (1 - E.inCubic(seg(p, m.hero ? 0.8 : 0.5, 1))) * m.a;
      const L = m.len * Math.min(1, age / (m.hero ? 0.35 : 0.2));
      const tx = hx - h.ux * L, ty = hy - h.uy * L, nx = -h.uy, ny = h.ux;
      const layers = m.hero ? [[m.w * 7, 0.16], [m.w * 2.2, 0.5], [m.w, 1]] : [[m.w * 3, 0.25], [m.w, 1]];
      for (const [w, a] of layers) {
        const gr = ctx.createLinearGradient(hx, hy, tx, ty);
        gr.addColorStop(0, `rgba(240,250,255,${0.95 * env * a})`);
        gr.addColorStop(0.18, `rgba(160,208,255,${0.6 * env * a})`);
        gr.addColorStop(1, "rgba(70,120,230,0)");
        ctx.fillStyle = gr; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(hx + nx * w, hy + ny * w); ctx.lineTo(tx, ty); ctx.lineTo(hx - nx * w, hy - ny * w); ctx.closePath(); ctx.fill();
      }
      sprite(GLOW_WHITE, hx, hy, m.w * (m.hero ? 16 : 7), env);
      if (m.hero) { sprite(FLARE, hx, hy, 170, env * 0.9); sprite(GLOW_BLUE, hx, hy, 260, env * 0.35); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  /* =========================================================
     天空、地平線、山
     ========================================================= */
  function drawSky(t, hy) {
    const g = ctx.createLinearGradient(0, hy - 2700, 0, hy);
    g.addColorStop(0, "#010309"); g.addColorStop(0.42, "#050a18"); g.addColorStop(0.72, "#0a1430");
    g.addColorStop(0.9, "#152a58"); g.addColorStop(1, "#27487f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawMilky(t, sky) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.9;
    ctx.translate(W * 0.5, H * (STORY ? 0.3 : 0.27) + sky * PAR.milky);
    ctx.rotate(-0.5 + t * 0.002);
    ctx.drawImage(MILKY, -MILKY.width / 2, -MILKY.height / 2);
    ctx.restore();
  }
  function drawMoon(t, sky) {
    ctx.globalCompositeOperation = "lighter";
    sprite(MOON, W * 0.8, H * (STORY ? 0.2 : 0.16) + sky * PAR.moon, 210, 0.95);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }
  const HILLS = [
    { n: noise1(1), amp: 80, base: 26, freq: 1 / 230, col: "#16294f", rim: "rgba(150,190,255,0.22)" },
    { n: noise1(2), amp: 120, base: 4, freq: 1 / 170, col: "#0e1b39", rim: "rgba(150,190,255,0.14)" },
    { n: noise1(3), amp: 50, base: -6, freq: 1 / 120, col: "#0a142c", rim: "rgba(150,190,255,0.10)" }
  ];
  function drawHorizon(t, hy) {
    if (hy > H + 300) return;
    // 地平線的光
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(W / 2, hy); ctx.scale(1, 0.4);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.95);
    gr.addColorStop(0, "rgba(90,140,235,0.34)"); gr.addColorStop(1, "rgba(40,80,190,0)");
    ctx.fillStyle = gr; ctx.fillRect(-W, -W, W * 2, W * 2);
    ctx.restore();
    for (const h of HILLS) {
      ctx.beginPath(); ctx.moveTo(-20, hy + 30);
      for (let x = -20; x <= W + 20; x += 10) {
        const n = h.n(x * h.freq) * 0.7 + h.n(x * h.freq * 2.7 + 50) * 0.3;
        ctx.lineTo(x, hy - h.base - n * h.amp * (0.55 + 0.45 * Math.sin(x / 400 + h.amp)));
      }
      ctx.lineTo(W + 20, hy + 30); ctx.closePath();
      ctx.fillStyle = h.col; ctx.fill();
      ctx.strokeStyle = h.rim; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // 霧
    const mist = ctx.createLinearGradient(0, hy - 110, 0, hy + 160);
    mist.addColorStop(0, "rgba(120,165,245,0)"); mist.addColorStop(0.45, "rgba(120,165,245,0.18)"); mist.addColorStop(1, "rgba(120,165,245,0)");
    ctx.fillStyle = mist; ctx.fillRect(0, hy - 110, W, 270);
  }

  /* =========================================================
     花田（有透視：越遠越小、越靠近地平線）
     ========================================================= */
  const K = H - LY.hor1;
  function proj(wx, d, hy) { const s = K / d; return { x: W / 2 + wx * s, y: hy + s, s: s }; }
  // 紙條（願望）：飄到空中的位置、落地的位置
  const NOTE_LAYOUT = [
    [0.27, 0.08, 0.95, 0.20, 0.36], [0.74, 0.16, 0.92, 0.84, 0.30], [0.5, 0.40, 1.05, 0.50, 0.56], [0.2, 0.56, 0.86, 0.10, 0.64],
    [0.79, 0.62, 0.95, 0.68, 0.48], [0.43, 0.8, 0.82, 0.33, 0.17], [0.74, 0.93, 0.78, 0.62, 0.12], [0.2, 0.99, 0.74, 0.42, 0.8]
  ];
  const LANDS = NOTE_LAYOUT.map((L, i) => {
    const tl = T.land[i], hy = LY.hor1, sx = L[3] * W, sy = hy + L[4] * (H - hy);
    const de = K / (sy - hy), d = de + dolly(tl), wx = ((sx - W / 2) * de) / K;
    return { t: tl, wx: wx, d: d };
  });
  const STAFF_GROUND = { wx: 0, d: K / (LY.footY - LY.hor1) + dolly(T.impact) };
  const FIELD = (function () {
    const r = mulberry(777), items = [];
    const n = STORY ? 1150 : 900;
    const bloomAt = (wx, d) => {
      let bt = Math.min(20, T.impact + Math.hypot(wx - STAFF_GROUND.wx, (d - STAFF_GROUND.d) * 1.2) / 9);
      for (const L of LANDS) bt = Math.min(bt, L.t + 0.08 + Math.hypot(wx - L.wx, (d - L.d) * 1.25) / 4.2);
      return bt;
    };
    for (let i = 0; i < n; i++) {
      const d = 0.62 + Math.pow(r(), 0.8) * 13.5;
      const edge = ((W / 2 + 140) * d) / K;
      const wx = (r() * 2 - 1) * edge;
      items.push({ k: 0, d, wx, spr: pickFlower(r), size: 0.78 + r() * 0.5, rot: r() * TAU, ph: r() * TAU, stem: 1 + r() * 0.8, lean: (r() - 0.5) * 0.5, leaf: (r() * 3) | 0, bt: bloomAt(wx, d) + r() * 0.18 });
    }
    // 流星落下的地方：一朵大花
    LANDS.forEach((L, i) => items.push({ k: 2, d: L.d, wx: L.wx, spr: 0, size: 1.55, rot: i * 1.3, ph: i, stem: 1.25, lean: 0, leaf: i % 3, bt: L.t }));
    // 前景的草
    const g = STORY ? 300 : 240;
    for (let i = 0; i < g; i++) {
      const d = 0.62 + r() * 2.6, edge = ((W / 2 + 80) * d) / K;
      items.push({ k: 1, d, wx: (r() * 2 - 1) * edge, h: 0.55 + r() * 0.9, lean: (r() - 0.5) * 0.7, ph: r() * TAU, w: 0.7 + r() * 0.6 });
    }
    items.sort((a, b) => b.d - a.d);
    return items;
  })();
  function wind(t, x) {
    const u = t - T.impact;
    if (u < 0) return 0;
    const env = E.outCubic(seg(u, 0, 0.12)) * Math.exp(-u * 2.3);
    return Math.sign(x - W / 2) * env * 0.45;
  }
  function drawField(t, hy) {
    if (hy > H + 40) return;
    // 地面
    const gg = ctx.createLinearGradient(0, hy, 0, H);
    gg.addColorStop(0, "#0f1d3c"); gg.addColorStop(0.12, "#0a1530"); gg.addColorStop(1, "#040912");
    ctx.fillStyle = gg; ctx.fillRect(0, hy, W, H - hy + 60);

    const dl = dolly(t);
    // 落地的地方地面發光
    ctx.globalCompositeOperation = "lighter";
    for (const L of LANDS) {
      const u = t - L.t; if (u < 0) continue;
      const de = L.d - dl; if (de < 0.3) continue;
      const p = proj(L.wx, de, hy), env = E.outCubic(seg(u, 0, 0.5)) * (0.55 + 0.45 * Math.exp(-u * 2));
      sprite(GLOW_SOFT, p.x, p.y, p.s * 1.1, env * 0.55, 0.32);
    }
    ctx.globalCompositeOperation = "source-over";

    for (const it of FIELD) {
      const de = it.d - dl;
      if (de < 0.5) continue;
      const p = proj(it.wx, de, hy);
      if (p.x < -200 || p.x > W + 200 || p.y > H + 250) continue;
      const haze = clamp(1 - (de - 4) / 12, 0.3, 1);
      if (it.k === 1) { drawGrass(it, p, t); continue; }
      const r = 0.15 * p.s * it.size;        // 花的半徑
      const near = de < 1.45 ? 0.55 : 1;     // 最前面的花：暗一點、模糊（景深）
      const stemL = 0.3 * p.s * it.stem;
      const b = clamp((t - it.bt) / 0.55);
      const sway = Math.sin(t * 1.35 + it.ph + it.wx * 0.4) * 0.07 + it.lean * 0.25 + wind(t, p.x) * (1.1 - Math.min(1, de / 8));
      const hx = p.x + Math.sin(sway) * stemL, hy2 = p.y - Math.cos(sway) * stemL;
      if (r < 3.2) {         // 很遠的花：只畫一個光點
        ctx.globalCompositeOperation = "lighter";
        const a = (0.15 + 0.85 * b) * haze;
        sprite(GLOW_BLUE, hx, hy2, r * 3.4, a * 0.55);
        ctx.globalCompositeOperation = "source-over";
        continue;
      }
      ctx.globalAlpha = haze;
      // 葉子
      if (r > 7) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.5);
        const lr = r * 1.25 * FK;
        ctx.drawImage(LEAVES[it.leaf], -lr, -lr, lr * 2, lr * 2);
        ctx.restore();
      }
      // 莖
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x, p.y - stemL * 0.5, hx, hy2);
      ctx.strokeStyle = "#16353a"; ctx.lineWidth = Math.max(1, r * 0.07); ctx.stroke();
      const squash = clamp(0.42 + 0.38 / de, 0.42, 0.86);
      if (b <= 0) {
        // 花苞
        const bs = r * 0.9;
        ctx.globalAlpha = haze * 0.75;
        ctx.save(); ctx.translate(hx, hy2); ctx.rotate(sway * 0.8);
        ctx.drawImage(BUD, -bs * 0.3, -bs * 0.95, bs * 0.6, bs * 1.03);
        ctx.restore();
        continue;
      }
      const sc = it.k === 2 ? E.outBack(b, 2.2) : E.outBack(b, 1.9);
      const R = r * sc * FK;
      // 花的光暈
      ctx.globalCompositeOperation = "lighter";
      const glowA = (0.4 + 0.2 * Math.sin(t * 2.1 + it.ph)) * b + 1.1 * Math.exp(-Math.max(0, t - it.bt) * 3.2) * (t > it.bt ? 1 : 0);
      sprite(GLOW_BLUE, hx, hy2, r * (it.k === 2 ? 3.6 : 2.4), glowA * haze * (it.k === 2 ? 0.7 : 0.5) * near, squash);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = haze;
      ctx.save(); ctx.translate(hx, hy2); ctx.scale(1, squash); ctx.rotate(it.rot - (1 - b) * 1.6 + sway * 0.5);
      ctx.drawImage(it.k === 2 ? HERO_FLOWER : near < 1 ? FLOWERS_NEAR[it.spr] : FLOWERS[it.spr], -R, -R, R * 2, R * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // 靠近地平線的地方蓋一層霧（遠的花看起來比較淡）
    const fog = ctx.createLinearGradient(0, hy - 10, 0, hy + 120);
    fog.addColorStop(0, "rgba(40,70,140,0.55)"); fog.addColorStop(1, "rgba(40,70,140,0)");
    ctx.fillStyle = fog; ctx.fillRect(0, hy - 10, W, 130);
  }
  function drawGrass(it, p, t) {
    const h = 0.26 * p.s * it.h, w = 0.02 * p.s * it.w;
    const sw = Math.sin(t * 1.6 + it.ph) * 0.12 + it.lean + wind(t, p.x) * 1.4;
    const tx = p.x + Math.sin(sw) * h, ty = p.y - Math.cos(sw) * h;
    ctx.beginPath(); ctx.moveTo(p.x - w, p.y);
    ctx.quadraticCurveTo(p.x - w * 0.3 + Math.sin(sw) * h * 0.4, p.y - h * 0.55, tx, ty);
    ctx.quadraticCurveTo(p.x + w * 0.3 + Math.sin(sw) * h * 0.4, p.y - h * 0.5, p.x + w, p.y);
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#050d18"; ctx.fill();
    ctx.strokeStyle = "rgba(120,170,240,0.12)"; ctx.lineWidth = 1; ctx.stroke();
  }

  /* =========================================================
     願望紙條（飄上來 → 燒成光 → 變成流星落到花田 → 開花）
     ========================================================= */
  const PAPERS = [["#fdfaf2", "#ece4d2"], ["#f4f8ff", "#dde7f7"], ["#fff9e8", "#f1e2bd"], ["#f8f4ff", "#e5ddf6"]];
  function star4(g, x, y, r, col) {
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = -PI / 2 + (k / 8) * TAU, rr = k % 2 ? r * 0.32 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill();
  }
  function makeNote(text, seed, size, paper) {
    const r = mulberry(seed), S = 1.5, pad = 12;
    ctx.font = F.hand(size);
    const tw = ctx.measureText(text).width, w = Math.round(tw + size * 1.7), h = Math.round(size * 2.3);
    const c = mk((w + pad * 2) * S, (h + pad * 2) * S), g = c.getContext("2d");
    g.scale(S, S); g.translate(pad, pad);
    // 紙：邊緣有一點不規則
    const pts = [], j = () => (r() - 0.5) * 2.2;
    for (let x = 0; x <= w; x += w / 10) pts.push([x + j(), j()]);
    for (let y = 0; y <= h; y += h / 4) pts.push([w + j(), y + j()]);
    for (let x = w; x >= 0; x -= w / 10) pts.push([x + j(), h + j()]);
    for (let y = h; y >= 0; y -= h / 4) pts.push([j(), y + j()]);
    g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
    const pg = g.createLinearGradient(0, 0, w, h);
    pg.addColorStop(0, paper[0]); pg.addColorStop(1, paper[1]);
    g.fillStyle = pg; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(120,100,70,${0.03 + r() * 0.04})`; g.lineWidth = 0.6; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 18, y + (r() - 0.5) * 6); g.stroke(); }
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, "rgba(255,255,255,0.4)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(60,80,140,0.12)");
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    g.restore();
    // 手畫的藍色小星星
    star4(g, size * 0.58, h / 2 - 1, size * 0.26, "#3f7fcf");
    star4(g, size * 0.9, h / 2 - size * 0.3, size * 0.1, "#7fb2ea");
    g.font = F.hand(size); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#1c2946"; g.fillText(text, w / 2 + size * 0.22, h / 2 + size * 0.05);
    // 燒掉用的雜訊：從一個角落開始燒
    const n2 = noise2(seed + 3), cw = c.width, ch = c.height, noise = new Float32Array(cw * ch);
    const ox = r() < 0.5 ? 0 : cw, oy = r() < 0.5 ? 0 : ch, diag = Math.hypot(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) noise[y * cw + x] = 0.55 * (Math.hypot(x - ox, y - oy) / diag) + 0.45 * (n2(x / 22, y / 22) * 0.7 + n2(x / 7, y / 7) * 0.3);
    const base = g.getImageData(0, 0, cw, ch);
    const tmp = mk(cw, ch);
    return { c, w, h, S, pad, noise, base, tmp, tmpG: tmp.getContext("2d"), out: tmp.getContext("2d").createImageData(cw, ch) };
  }
  function burnFrame(n, p) {
    const src = n.base.data, dst = n.out.data, th = p * 1.3 - 0.15, edge = 0.07, scorch = 0.06;
    for (let i = 0, j = 0; i < n.noise.length; i++, j += 4) {
      const a = src[j + 3];
      if (!a) { dst[j + 3] = 0; continue; }
      const v = n.noise[i];
      if (v < th - edge) dst[j + 3] = 0;
      else if (v < th) {
        const k = (th - v) / edge;
        dst[j] = 190 + 65 * (1 - k); dst[j + 1] = 225 + 30 * (1 - k); dst[j + 2] = 255; dst[j + 3] = a * (1 - k * k);
      } else if (v < th + scorch) {
        const k = (v - th) / scorch;
        dst[j] = src[j] * k + 70 * (1 - k); dst[j + 1] = src[j + 1] * k + 120 * (1 - k); dst[j + 2] = src[j + 2] * k + 220 * (1 - k); dst[j + 3] = a;
      } else { dst[j] = src[j]; dst[j + 1] = src[j + 1]; dst[j + 2] = src[j + 2]; dst[j + 3] = a; }
    }
    n.tmpG.putImageData(n.out, 0, 0);
    return n.tmp;
  }
  const NOTES = COPY.wishes.map((txt, i) => {
    const L = NOTE_LAYOUT[i], r = mulberry(300 + i);
    const band = LY.noteBand;
    return {
      spr: makeNote(txt, 1000 + i * 17, LY.noteText, PAPERS[i % PAPERS.length]),
      tx: L[0] * W, ty: band[0] + L[1] * (band[1] - band[0]), scale: L[2] * (STORY ? 1.08 : 1),
      dx0: (r() - 0.5) * 260, rot: (r() - 0.5) * 0.22, spin: (r() - 0.5) * 1.2, ph: r() * TAU,
      t0: T.noteIn[i], ign: T.ignite + i * T.igniteStep, land: LANDS[i]
    };
  });
  function notePos(n, t) {
    const u = E.outCubic(seg(t, n.t0, n.t0 + 1.4));
    const x = lerp(n.tx + n.dx0, n.tx, u) + Math.sin(t * 0.9 + n.ph) * 12 * u;
    const y = lerp(H + 160, n.ty, u) + Math.sin(t * 1.3 + n.ph * 1.7) * 9 * u;
    return { x, y, rot: n.rot + Math.sin(t * 1.1 + n.ph) * 0.05 + (1 - u) * n.spin, s: n.scale, u };
  }
  function drawNotes(t) {
    for (const n of NOTES) {
      if (t < n.t0 || t > n.ign + T.burn + 0.05) continue;
      const q = notePos(n, t), sp = n.spr;
      const bp = seg(t, n.ign, n.ign + T.burn);
      const img = bp > 0 ? burnFrame(sp, bp) : sp.c;
      const dw = img.width / sp.S * q.s, dh = img.height / sp.S * q.s;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      // 紙條下面的藍光
      ctx.globalCompositeOperation = "lighter";
      sprite(GLOW_BLUE, 0, sp.h * 0.25 * q.s, sp.w * 0.75 * q.s, (0.28 + bp * 0.9) * Math.min(1, q.u * 2), 0.45);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.min(1, q.u * 3);
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.shadowColor = "transparent";
      if (bp > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6 * Math.sin(bp * PI); ctx.filter = "blur(6px)"; ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh); ctx.filter = "none"; }
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  // 光球的路徑：從紙條中心先往上彈，再劃一道弧線落到花田
  function orbPath(n) {
    const launch = n.ign + 0.18, q = notePos(n, launch);
    const de = n.land.d - dolly(n.land.t), p = proj(n.land.wx, de, LY.hor1);
    const cx = (q.x + p.x) / 2 + (p.x - q.x) * 0.1, cy = Math.min(q.y, p.y) - (STORY ? 300 : 230);
    return { launch, x0: q.x, y0: q.y, cx, cy, x1: p.x, y1: p.y - 0.3 * p.s * 1.25 * 0.9 };
  }
  const ORBS = NOTES.map(orbPath);
  function orbAt(o, n, t) {
    const u = Math.pow(seg(t, o.launch, n.land.t), 1.35);
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return { x: a * o.x0 + b * o.cx + c * o.x1, y: a * o.y0 + b * o.cy + c * o.y1 };
  }
  function drawOrbs(t) {
    ctx.globalCompositeOperation = "lighter";
    NOTES.forEach((n, i) => {
      const o = ORBS[i];
      if (t < o.launch - 0.1 || t > n.land.t + 0.9) return;
      if (t < n.land.t) {
        const born = E.outCubic(seg(t, o.launch - 0.1, o.launch + 0.05));
        // 尾巴
        let px = null, py = null;
        for (let k = 16; k >= 0; k--) {
          const tt = t - k * 0.016; if (tt < o.launch) continue;
          const q = orbAt(o, n, tt);
          if (px !== null) {
            const f = 1 - k / 17;
            ctx.strokeStyle = `rgba(170,215,255,${0.75 * f * born})`; ctx.lineWidth = 1 + 7 * f; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
          px = q.x; py = q.y;
        }
        const q = orbAt(o, n, t);
        sprite(GLOW_BLUE, q.x, q.y, 110, 0.8 * born);
        sprite(GLOW_WHITE, q.x, q.y, 34, born);
        sprite(FLARE, q.x, q.y, 120, 0.7 * born);
      } else {
        // 落地：閃光 + 漣漪
        const u = t - n.land.t, de = n.land.d - dolly(t), p = proj(n.land.wx, de, horizonY(t));
        const fl = Math.exp(-u * 7);
        sprite(GLOW_WHITE, p.x, p.y - p.s * 0.2, p.s * 0.55, fl);
        sprite(FLARE, p.x, p.y - p.s * 0.2, p.s * 1.1, fl * 0.9);
        const rr = p.s * 0.9 * E.outCubic(seg(u, 0, 0.8));
        ctx.strokeStyle = `rgba(168,220,255,${0.7 * (1 - seg(u, 0.1, 0.8))})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * 0.28, 0, 0, TAU); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.lineCap = "butt";
  }

  /* =========================================================
     粒子（火花、字散開、花瓣、螢火蟲）—— 全部用解析式算，沒有累積狀態
     ========================================================= */
  const PARTS = [];
  function burst(o) {
    const r = mulberry(o.seed);
    for (let i = 0; i < o.n; i++) {
      const a = (o.dir ?? -PI / 2) + (r() - 0.5) * (o.spread ?? TAU), sp = o.speed * (0.35 + r() * 0.9);
      PARTS.push({
        t0: o.t0 + r() * (o.jitter || 0), life: o.life * (0.6 + r() * 0.7),
        x: o.x + (r() - 0.5) * (o.w || 0), y: o.y + (r() - 0.5) * (o.h || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g ?? 0, drag: o.drag ?? 1.2,
        size: o.size * (0.5 + r()), spr: o.spr || GLOW_BLUE, sky: !!o.sky, petal: !!o.petal,
        rot: r() * TAU, vr: (r() - 0.5) * 8, col: o.col, a: o.a ?? 1, tw: r() * TAU
      });
    }
  }
  function drawParts(t, sky) {
    for (const p of PARTS) {
      const u = t - p.t0; if (u < 0 || u > p.life) continue;
      const k = (1 - Math.exp(-p.drag * u)) / p.drag;   // 有阻力的位移
      const x = p.x + p.vx * k, y = p.y + p.vy * k + 0.5 * p.g * u * u + (p.sky ? sky * PAR.quote : 0);
      const life = u / p.life, a = p.a * Math.min(1, u / 0.06) * (1 - life * life) * (0.75 + 0.25 * Math.sin(u * 18 + p.tw));
      if (p.petal) {
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vr * u); ctx.scale(1, 0.45 + 0.4 * Math.sin(u * 6 + p.tw));
        ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = "lighter";
        sprite(p.spr, x, y, p.size, a);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  const FIREFLIES = (function () {
    const r = mulberry(8080), list = [];
    for (let i = 0; i < (STORY ? 150 : 115); i++) list.push({ x: r() * W, y: LY.hor1 - 260 + r() * (H - LY.hor1 + 200), f1: 0.3 + r() * 0.6, f2: 0.4 + r() * 0.7, ph: r() * TAU, rise: 8 + r() * 26, s: 5 + r() * 12, t0: 8.1 + r() * 1.8, gold: r() < 0.25 });
    return list;
  })();
  function drawFireflies(t) {
    ctx.globalCompositeOperation = "lighter";
    for (const f of FIREFLIES) {
      if (t < f.t0) continue;
      const u = t - f.t0, a = E.outCubic(seg(u, 0, 0.8)) * (0.45 + 0.55 * Math.sin(t * 2.4 + f.ph * 3) ** 2);
      const x = f.x + Math.sin(t * f.f1 + f.ph) * 34, y = f.y - u * f.rise + Math.sin(t * f.f2 + f.ph * 2) * 18;
      sprite(f.gold ? GLOW_GOLD : GLOW_BLUE, x, y, f.s, a * 0.85);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  /* =========================================================
     文字
     ========================================================= */
  const layoutCache = new Map();
  function layout(text, font, spacing) {
    const key = text + "|" + font + "|" + spacing;
    if (layoutCache.has(key)) return layoutCache.get(key);
    ctx.font = font;
    const chars = [];
    let x = 0;
    for (const ch of [...text]) { const w = ctx.measureText(ch).width; chars.push({ ch, x, w }); x += w + spacing; }
    const total = x - spacing;
    chars.forEach((c) => (c.cx = c.x + c.w / 2 - total / 2));
    const L = { chars, width: total };
    layoutCache.set(key, L);
    return L;
  }
  function glyph(ch, x, y, font, st) {
    if (!(st.alpha > 0.004)) return;
    ctx.save();
    ctx.translate(x + (st.dx || 0), y + (st.dy || 0));
    const sc = st.scale ?? 1; if (sc !== 1) ctx.scale(sc, sc);
    ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (st.blur > 0.3) ctx.filter = `blur(${st.blur.toFixed(2)}px)`;
    if (st.shadow) {
      ctx.globalAlpha = st.alpha * st.shadow;
      ctx.shadowColor = "rgba(1,3,10,0.95)"; ctx.shadowBlur = st.shadowBlur || 28; ctx.shadowOffsetY = 6;
      ctx.fillStyle = "rgba(1,3,10,0.6)"; ctx.fillText(ch, 0, 0);
      ctx.shadowOffsetY = 0;
    }
    ctx.globalAlpha = st.alpha;
    ctx.shadowColor = st.glow ? st.glowColor || "rgba(80,150,240,0.9)" : "transparent";
    ctx.shadowBlur = st.glow || 0;
    ctx.fillStyle = st.fill || C.ivory;
    ctx.fillText(ch, 0, 0);
    if (st.hot > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, st.alpha * st.hot);
      ctx.shadowColor = "rgba(150,205,255,1)"; ctx.shadowBlur = 34;
      ctx.fillStyle = "#ffffff"; ctx.fillText(ch, 0, 0);
    }
    ctx.restore();
  }
  // 常用的出現 / 消失
  function riseIn(t, t0, i, o = {}) {
    const d = o.dur || 0.7, st = t0 + i * (o.stagger ?? 0.055), u = seg(t, st, st + d), e = E.outCubic(u);
    return { alpha: E.outQuad(u), dy: (1 - e) * (o.dist ?? 28), blur: (1 - e) * (o.blur ?? 10), u };
  }
  function dissolveOut(t, t0, i, n, o = {}) {
    const st = t0 + (i / Math.max(1, n)) * (o.spread ?? 0.3), u = seg(t, st, st + (o.dur || 0.45)), e = E.inCubic(u);
    return { k: 1 - E.inQuad(u), dy: -e * (o.dist ?? 46), blur: e * 14, scale: 1 + e * 0.06, u };
  }
  function sweep(t, t0, dur, x, span) {       // 一道光從左掃到右
    const u = (t - t0) / dur; if (u < 0 || u > 1) return 0;
    const pos = lerp(-span * 0.7, span * 0.7, E.inOutSine(u));
    return Math.exp(-Math.pow((x - pos) / (span * 0.09), 2));
  }

  /* ---- 1 & 2：引言 ---- */
  const Q1 = layout(COPY.line1, F.serif(LY.quoteSize), 6);
  const Q2 = layout(COPY.line2, F.serif(LY.quoteSize), 6);
  const QC = layout(COPY.caption, F.sans(STORY ? 30 : 28, 500), 7);
  function line1Reveal(c) { return T.hero + (T.heroDur * (W / 2 + c.cx - heroPath.x0)) / (heroPath.x1 - heroPath.x0); }
  function drawQuote(t, sky) {
    if (t > 5.4) return;
    const oy = sky * PAR.quote, font = F.serif(LY.quoteSize), n = Q1.chars.length + Q2.chars.length;
    const hotChars = /[欣梅爾]/;
    Q1.chars.forEach((c, i) => {
      const tr = line1Reveal(c), u = t - tr;
      if (u < -0.02) return;
      const a = clamp(u / 0.12), e = E.outCubic(seg(u, 0, 0.6));
      const out = dissolveOut(t, T.quoteOut, i, n);
      const hot = Math.exp(-Math.max(0, u) * 4.2) * 1.3 + sweep(t, 3.4, 1.0, c.cx, 900) * 0.7;
      const isName = hotChars.test(c.ch);
      glyph(c.ch, W / 2 + c.cx, LY.quoteY + oy, font, {
        alpha: a * out.k, dy: (1 - e) * 10 + out.dy, blur: (1 - E.outCubic(seg(u, 0, 0.3))) * 8 + out.blur,
        scale: (1 + (1 - e) * 0.1) * out.scale, fill: isName ? "#d8ecff" : C.ivory,
        glow: isName ? 26 : 16, glowColor: isName ? "rgba(95,165,255,0.95)" : "rgba(70,130,230,0.7)", hot, shadow: 0.6
      });
    });
    Q2.chars.forEach((c, i) => {
      const r = riseIn(t, T.line2, i, { dur: 0.75, stagger: 0.06 });
      const out = dissolveOut(t, T.quoteOut, Q1.chars.length + i, n);
      const hot = sweep(t, 3.4, 1.0, c.cx, 900) * 0.7;
      glyph(c.ch, W / 2 + c.cx, LY.quoteY + LY.lineGap + oy, font, {
        alpha: r.alpha * out.k, dy: r.dy + out.dy, blur: r.blur + out.blur, scale: out.scale,
        glow: 16, glowColor: "rgba(70,130,230,0.7)", hot, shadow: 0.6
      });
    });
    // 出處
    const ca = E.outCubic(seg(t, T.caption, T.caption + 0.8)) * (1 - seg(t, T.quoteOut + 0.1, T.quoteOut + 0.45));
    if (ca > 0) {
      const y = LY.captionY + oy + (1 - E.outCubic(seg(t, T.caption, T.caption + 0.8))) * 14;
      ctx.globalAlpha = ca;
      ctx.strokeStyle = "rgba(230,201,138,0.7)"; ctx.lineWidth = 1.2;
      const half = QC.width / 2 + 26, lw = 70 * E.outCubic(seg(t, T.caption, T.caption + 1));
      ctx.beginPath(); ctx.moveTo(W / 2 - half, y); ctx.lineTo(W / 2 - half - lw, y); ctx.moveTo(W / 2 + half, y); ctx.lineTo(W / 2 + half + lw, y); ctx.stroke();
      QC.chars.forEach((c) => glyph(c.ch, W / 2 + c.cx, y, F.sans(STORY ? 30 : 28, 500), { alpha: ca, fill: C.gold, glow: 10, glowColor: "rgba(230,190,110,0.5)" }));
      ctx.globalAlpha = 1;
    }
  }

  /* ---- 3 & 4：所以我們也想—— / 聽見你的每一個願望 / 再小的事，都算數 ---- */
  const S3 = [
    { text: COPY.s3a, t0: T.s3a, t1: T.s3aOut, hi: "" },
    { text: COPY.s3b, t0: T.s3b, t1: T.s3bOut, hi: "願望" },
    { text: COPY.s3c, t0: T.s3c, t1: T.s3cOut, hi: "都算數" }
  ].map((s) => ({ ...s, L: layout(s.text, F.serif(LY.s3Size), 5) }));
  function drawS3(t) {
    const font = F.serif(LY.s3Size);
    for (const s of S3) {
      if (t < s.t0 - 0.05 || t > s.t1 + 0.6) continue;
      const hiStart = s.hi ? s.text.indexOf(s.hi) : -1;
      s.L.chars.forEach((c, i) => {
        const r = riseIn(t, s.t0, i, { dur: 0.65, stagger: 0.045, dist: 24 });
        const out = dissolveOut(t, s.t1, i, s.L.chars.length, { spread: 0.2, dur: 0.35, dist: 30 });
        const hi = hiStart >= 0 && i >= hiStart && i < hiStart + s.hi.length;
        glyph(c.ch, W / 2 + c.cx, LY.s3Y, font, {
          alpha: r.alpha * out.k, dy: r.dy + out.dy, blur: r.blur + out.blur, scale: out.scale,
          fill: hi ? "#cfe8ff" : C.ivory, glow: hi ? 28 : 14, glowColor: hi ? "rgba(90,165,255,1)" : "rgba(60,120,220,0.6)",
          hot: sweep(t, s.t0 + 0.7, 0.9, c.cx, 800) * 0.6, shadow: 0.7
        });
      });
    }
  }

  /* =========================================================
     權杖 + 魔法陣
     ========================================================= */
  let STAFF = null;   // { frames:[], orbV, fw, fh }
  const staffScale = (LY.footY - LY.orbY) / (1864 - 0.133 * 1900);
  function staffState(t) {
    if (t < T.fall) return null;
    if (t < T.impact) {
      const u = seg(t, T.fall, T.impact), e = E.inQuad(u);
      return { y: lerp(-H * 1.25, 0, e), spin: (1 - u) * (1 - u) * 3.2 * 72, blur: 1 - u * 0.3, a: 1 };
    }
    if (t < T.end) return { y: 0, spin: Math.sin((t - T.impact) * 1.1) * 5, blur: 0, a: 1 };
    const u = seg(t, T.end - 0.05, T.end + 0.6), e = E.inCubic(u);
    if (u >= 1) return null;
    return { y: -e * H * 1.4, spin: e * e * 3 * 72 + Math.sin((t - T.impact) * 1.1) * 5, blur: e, a: 1 };
  }
  function drawStaffAt(y, spin, alpha) {
    const s = staffScale, fw = STAFF.fw * s, fh = STAFF.fh * s;
    const idx = ((spin % 72) + 72) % 72, i0 = Math.floor(idx), f = idx - i0;
    const x = W / 2 - fw / 2, top = LY.orbY - STAFF.orbV * fh + y;
    ctx.globalAlpha = alpha;
    ctx.drawImage(STAFF.frames[i0], x, top, fw, fh);
    if (f > 0.02) { ctx.globalAlpha = alpha * f; ctx.drawImage(STAFF.frames[(i0 + 1) % 72], x, top, fw, fh); }
    ctx.globalAlpha = 1;
  }
  function drawStaff(t) {
    const st = staffState(t); if (!st || !STAFF) return;
    const orbY = LY.orbY + st.y;
    // 落下 / 飛走時的光軌
    ctx.globalCompositeOperation = "lighter";
    if (st.blur > 0.05) {
      const dir = t < T.impact ? -1 : 1, len = 700 * st.blur;
      const gr = ctx.createLinearGradient(0, orbY, 0, orbY + dir * len);
      gr.addColorStop(0, "rgba(190,225,255,0.55)"); gr.addColorStop(1, "rgba(80,140,240,0)");
      ctx.fillStyle = gr; ctx.fillRect(W / 2 - 14, Math.min(orbY, orbY + dir * len), 28, len);
    }
    // 權杖後面的光
    sprite(GLOW_BLUE, W / 2, orbY + (LY.footY - LY.orbY) * 0.45, (LY.footY - LY.orbY) * 0.7, 0.18, 1.6);
    ctx.globalCompositeOperation = "source-over";
    // 殘影
    if (st.blur > 0.2) for (let k = 3; k >= 1; k--) { const p = staffState(t - k * 0.012); if (p) drawStaffAt(p.y, p.spin, 0.18); }
    ctx.save();
    ctx.shadowColor = "rgba(110,175,255,0.75)"; ctx.shadowBlur = 36;
    drawStaffAt(st.y, st.spin, st.a);
    ctx.restore();
    // 寶珠
    ctx.globalCompositeOperation = "lighter";
    const u = t - T.impact;
    const pulse = t > T.impact ? 0.38 + 0.14 * Math.sin(t * 3.1) : 0.3;
    const flash = u > 0 ? Math.exp(-u * 3.5) : 0;
    sprite(GLOW_RED, W / 2, orbY, 52 * staffScale / 0.52 * (1 + flash), pulse + flash);
    if (u > 0) {
      sprite(GLOW_WHITE, W / 2, orbY, 170 * flash + 30, flash * 1.2);
      ctx.globalAlpha = flash * 0.9; ctx.drawImage(STREAK, W / 2 - 900, orbY - 56, 1800, 112);
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 2.3); ctx.drawImage(STREAK, W / 2 - 420, orbY - 20, 840, 40);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  function drawImpactFx(t) {
    const u = t - T.impact; if (u < 0 || u > 1.6) return;
    ctx.globalCompositeOperation = "lighter";
    // 光柱
    const pa = Math.exp(-u * 3.2);
    const gr = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
    gr.addColorStop(0, "rgba(90,150,255,0)"); gr.addColorStop(0.5, `rgba(210,235,255,${0.55 * pa})`); gr.addColorStop(1, "rgba(90,150,255,0)");
    ctx.fillStyle = gr; ctx.fillRect(W / 2 - 90, 0, 180, LY.footY);
    // 地面的衝擊波
    for (const [d, a] of [[0, 1], [0.12, 0.6]]) {
      const v = seg(u - d, 0, 1.1); if (v <= 0 || v >= 1) continue;
      const rx = E.outCubic(v) * W * 0.95;
      ctx.strokeStyle = `rgba(175,220,255,${a * (1 - v)})`; ctx.lineWidth = 5 * (1 - v) + 1;
      ctx.beginPath(); ctx.ellipse(W / 2, LY.footY, rx, rx * 0.2, 0, 0, TAU); ctx.stroke();
    }
    sprite(GLOW_WHITE, W / 2, LY.footY, 260, Math.exp(-u * 5));
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  // 魔法陣上的符文（自己產生的，不是任何真的文字）
  const GLYPHS = (function () {
    const r = mulberry(1234), list = [];
    for (let i = 0; i < 28; i++) {
      const strokes = [], n = 2 + ((r() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const kind = r();
        if (kind < 0.65) strokes.push({ l: [((r() * 3) | 0) / 2 - 0.5, ((r() * 3) | 0) / 2 - 0.5, ((r() * 3) | 0) / 2 - 0.5, ((r() * 3) | 0) / 2 - 0.5] });
        else if (kind < 0.85) strokes.push({ c: [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5, 0.12 + r() * 0.15] });
        else strokes.push({ a: [0, 0, 0.45, r() * TAU, PI * (0.6 + r() * 0.8)] });
      }
      list.push(strokes);
    }
    return list;
  })();
  function drawGlyph(gl, size) {
    ctx.beginPath();
    for (const s of gl) {
      if (s.l) { ctx.moveTo(s.l[0] * size, s.l[1] * size); ctx.lineTo(s.l[2] * size, s.l[3] * size); }
      else if (s.c) { ctx.moveTo((s.c[0] + s.c[2]) * size, s.c[1] * size); ctx.arc(s.c[0] * size, s.c[1] * size, s.c[2] * size, 0, TAU); }
      else { const a = s.a; ctx.moveTo(Math.cos(a[3]) * a[2] * size, Math.sin(a[3]) * a[2] * size); ctx.arc(0, 0, a[2] * size, a[3], a[3] + a[4]); }
    }
    ctx.stroke();
  }
  function magicCircle(cx, cy, R, prog, t, alpha) {
    if (alpha <= 0.01 || prog <= 0) return;
    const rot = t * 0.16, A = (x) => `rgba(175,222,255,${x * alpha})`;
    ctx.save(); ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = `rgba(80,150,255,${0.9 * alpha})`; ctx.shadowBlur = 16;
    const arc = (r, lw, p, start, ccw, a = 1) => { if (p <= 0) return; ctx.strokeStyle = A(a); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, r, start, start + (ccw ? -1 : 1) * TAU * p, !!ccw); ctx.stroke(); };
    const p1 = E.outCubic(seg(prog, 0, 0.55)), p2 = E.outCubic(seg(prog, 0.08, 0.62)), p3 = E.outCubic(seg(prog, 0.2, 0.8)), p4 = E.outCubic(seg(prog, 0.35, 1));
    arc(R, 3.2, p1, -PI / 2 + rot);
    arc(R * 0.955, 1.3, p2, -PI / 2 - rot * 1.3, true, 0.8);
    arc(R * 0.78, 1.3, p2, PI / 2 + rot, false, 0.8);
    // 符文帶
    ctx.lineWidth = Math.max(1.2, R * 0.006); ctx.strokeStyle = A(0.95); ctx.lineCap = "round";
    const ng = 36, gs = R * 0.1;
    for (let i = 0; i < ng; i++) {
      const vis = seg(p3, i / ng * 0.8, i / ng * 0.8 + 0.2); if (vis <= 0) continue;
      const ang = (i / ng) * TAU - rot * 0.7;
      ctx.save(); ctx.globalAlpha = vis; ctx.rotate(ang); ctx.translate(0, -R * 0.868); drawGlyph(GLYPHS[i % GLYPHS.length], gs); ctx.restore();
    }
    ctx.globalAlpha = 1;
    // 點狀圈
    ctx.setLineDash([2, 10]); arc(R * 0.71, 2.2, p3, -PI / 2 + rot * 2); ctx.setLineDash([]);
    // 六芒星
    if (p4 > 0) {
      ctx.save(); ctx.rotate(-rot * 0.8);
      ctx.strokeStyle = A(0.85); ctx.lineWidth = 1.6;
      for (let tri = 0; tri < 2; tri++) {
        ctx.beginPath();
        for (let k = 0; k <= 3; k++) { const a = -PI / 2 + tri * PI + (k / 3) * TAU; const x = Math.cos(a) * R * 0.66, y = Math.sin(a) * R * 0.66; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.setLineDash([R * 3.5 * p4, R * 10]); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let k = 0; k < 6; k++) { const a = -PI / 2 + (k / 6) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, R * 0.035 * p4, 0, TAU); ctx.stroke(); }
      ctx.restore();
      arc(R * 0.38, 1.5, p4, PI + rot, false, 0.9);
      ctx.save(); ctx.rotate(rot * 1.5); ctx.strokeStyle = A(0.7); ctx.lineWidth = 1.2;
      for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, r0 = R * (k % 2 ? 0.4 : 0.42), r1 = R * 0.47; ctx.globalAlpha = p4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  function magicState(t) {
    if (t < T.impact) return null;
    const prog = seg(t, T.impact, T.impact + 1.0);
    const m = seg(t, T.end, T.end + 0.75), e = E.inOutCubic(m);
    const em = LY.end.emblem;
    return { x: lerp(W / 2, em.x, e), y: lerp(LY.orbY, em.y, e), r: lerp(LY.magicR, em.r, e), prog, a: 1 };
  }
  function drawMagic(t) {
    const s = magicState(t); if (!s) return;
    // 魔法陣中間的光
    ctx.globalCompositeOperation = "lighter";
    sprite(GLOW_SOFT, s.x, s.y, s.r * 1.25, 0.5 * s.prog);
    ctx.globalCompositeOperation = "source-over";
    magicCircle(s.x, s.y, s.r, s.prog, t, s.a);
  }

  /* =========================================================
     結尾卡：2 號、候選人、寫下你的願望
     ========================================================= */
  const PHOTO_META = {                 // 原圖裡：臉的中心 x、頭頂 y、下巴 y
    pres: { src: "../../assets/president3-cut.webp", cx: 690, top: 54, chin: 572 },
    vice: { src: "../../assets/vice2-cut.webp", cx: 489, top: 8, chin: 287 }
  };
  const PHOTOS = {};
  function bakePhoto(img, meta, place) {
    const s = place.head / (meta.chin - meta.top);
    const w = img.width * s, h = img.height * s;
    const x = place.fx - meta.cx * s, y = place.fy - meta.top * s;
    const c = mk(w, h), g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, c.width, c.height);
    // 夜晚的藍色調
    g.globalCompositeOperation = "source-atop";
    const tint = g.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, "rgba(40,70,140,0.03)"); tint.addColorStop(1, "rgba(20,40,100,0.2)");
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    // 底部淡出
    g.globalCompositeOperation = "destination-in";
    const f = g.createLinearGradient(0, LY.end.fade[0] - y, 0, LY.end.fade[1] - y);
    f.addColorStop(0, "rgba(0,0,0,1)"); f.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = f; g.fillRect(0, 0, w, h);
    return { c, x, y, w: c.width, h: c.height };
  }
  function drawPhotos(t) {
    if (t < T.end) return;
    [["pres", 0.12], ["vice", 0.24]].forEach(([k, d]) => {
      const P = PHOTOS[k]; if (!P) return;
      const u = seg(t, T.end + d, T.end + d + 0.8), e = E.outQuint(u);
      if (u <= 0) return;
      ctx.save();
      ctx.globalAlpha = E.outQuad(u);
      if (u < 1) ctx.filter = `blur(${((1 - e) * 14).toFixed(2)}px)`;
      ctx.shadowColor = "rgba(120,180,255,0.45)"; ctx.shadowBlur = 24;
      ctx.drawImage(P.c, P.x, P.y + (1 - e) * 140, P.w, P.h);
      ctx.restore();
      // 光掃過去
      const sw = sweep(t, T.end + d + 0.5, 0.8, 0, 1);
      if (sw > 0.02) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sw * 0.25; ctx.filter = "brightness(1.6)"; ctx.drawImage(P.c, P.x, P.y, P.w, P.h); ctx.restore(); }
    });
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function plaque(cx, cy, role, name, a, dy) {
    if (a <= 0) return;
    const rf = F.sans(STORY ? 26 : 23, 700), nf = F.serif(STORY ? 50 : 44);
    ctx.font = rf; const rw = ctx.measureText(role).width + 28;
    ctx.font = nf; const nw = ctx.measureText(name).width;
    const total = rw + 14 + nw, x0 = cx - total / 2, y = cy + dy;
    const ph = STORY ? 44 : 40;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = "rgba(63,127,207,0.8)"; ctx.shadowBlur = 18;
    roundRect(x0, y - ph / 2, rw, ph, ph / 2); ctx.fillStyle = C.mana; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.font = rf; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(role, x0 + rw / 2, y + 1);
    ctx.restore();
    glyphRun(name, x0 + rw + 14 + nw / 2, y, nf, 3, { alpha: a, glow: 14, glowColor: "rgba(70,130,230,0.7)", shadow: 0.8 });
  }
  function glyphRun(text, cx, cy, font, spacing, st) { const L = layout(text, font, spacing); L.chars.forEach((c) => glyph(c.ch, cx + c.cx, cy, font, st)); }

  /* ---- 5 & 6：寫下你的願望 ---- */
  const TT = layout(COPY.title, F.display(LY.titleSize), 8);
  const TS = layout(COPY.sub, F.sans(LY.subSize, 500), 3);
  function titleXform(t) {
    const m = E.inOutCubic(seg(t, T.end + 0.05, T.end + 0.8));
    return { y: lerp(LY.titleY, LY.end.titleY, m), s: lerp(1, LY.end.titleScale, m), sy: lerp(LY.subY, LY.end.subY, m) };
  }
  // 字後面壓暗一點（花田很亮，字才看得清楚）
  function drawScrims(t) {
    const a = E.outCubic(seg(t, T.impact + 0.05, T.impact + 0.5));
    if (a <= 0) return;
    const X = titleXform(t), m = E.inOutCubic(seg(t, T.end, T.end + 0.8));
    ctx.save();
    ctx.translate(W / 2, (X.y + X.sy) / 2); ctx.scale(1, 0.32);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.72);
    g.addColorStop(0, `rgba(2,5,14,${0.62 * a})`); g.addColorStop(0.6, `rgba(2,5,14,${0.4 * a})`); g.addColorStop(1, "rgba(2,5,14,0)");
    ctx.fillStyle = g; ctx.fillRect(-W, -W, W * 2, W * 2);
    ctx.restore();
    if (m > 0) {
      const top = LY.end.titleY - (STORY ? 150 : 130);
      const g2 = ctx.createLinearGradient(0, top, 0, H);
      g2.addColorStop(0, "rgba(2,5,14,0)"); g2.addColorStop(0.3, `rgba(2,5,14,${0.45 * m})`); g2.addColorStop(1, `rgba(2,5,14,${0.8 * m})`);
      ctx.fillStyle = g2; ctx.fillRect(0, top, W, H - top);
    }
  }
  function drawTitle(t) {
    if (t < T.title) return;
    const X = titleXform(t), font = F.display(LY.titleSize);
    const grad = ctx.createLinearGradient(0, -LY.titleSize / 2, 0, LY.titleSize / 2);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, "#dcebff");
    TT.chars.forEach((c, i) => {
      const st = T.title + i * 0.05, u = seg(t, st, st + 0.42), e = E.outExpo(u);
      const hot = Math.exp(-Math.max(0, t - st - 0.05) * 6) * 0.9 + sweep(t, 11.1, 0.9, c.cx, 1000) * 0.55 + sweep(t, 13.9, 0.9, c.cx, 1000) * 0.55;
      glyph(c.ch, W / 2 + c.cx * X.s, X.y, font, {
        alpha: E.outQuad(seg(u, 0, 0.5)), scale: (1 + (1 - e) * 0.9) * X.s, blur: (1 - e) * 18,
        fill: grad, glow: 26, glowColor: "rgba(63,127,207,0.95)", hot, shadow: 1, shadowBlur: 44
      });
    });
    const su = seg(t, T.sub, T.sub + 0.7);
    if (su > 0) {
      const e = E.outCubic(su), font2 = F.sans(LY.subSize, 500);
      TS.chars.forEach((c) => glyph(c.ch, W / 2 + c.cx, X.sy + (1 - e) * 16, font2, { alpha: e * 0.95, fill: "#dfe8f6", shadow: 0.8, shadowBlur: 18 }));
    }
  }
  function drawEndCard(t) {
    if (t < T.end) return;
    const EN = LY.end, em = EN.emblem;
    // 魔法陣中間的「2」
    const nu = seg(t, T.end + 0.45, T.end + 1.0), ne = E.outBack(nu, 1.6);
    if (nu > 0) {
      glyph(COPY.number, em.x + em.r * 0.02, em.y + em.r * 0.02, F.latin(em.r * 1.55), { alpha: E.outQuad(nu), scale: 0.6 + 0.4 * ne, fill: C.gold, glow: 34, glowColor: "rgba(230,190,110,0.85)", hot: Math.exp(-(t - T.end - 0.5) * 3) * 0.8, shadow: 0.6 });
      glyph("No.", em.x - em.r * 0.5, em.y - em.r * 0.42, F.latin(em.r * 0.3), { alpha: E.outQuad(nu), fill: C.gold, glow: 10, glowColor: "rgba(230,190,110,0.6)" });
      glyph("號", em.x + em.r * 0.5, em.y + em.r * 0.36, F.serif(em.r * 0.26), { alpha: E.outQuad(nu), fill: C.gold, glow: 10, glowColor: "rgba(230,190,110,0.6)" });
    }
    // 團隊名
    const tu = seg(t, T.end + 0.8, T.end + 1.4);
    if (tu > 0) glyphRun(COPY.team, W / 2, EN.teamY + (1 - E.outCubic(tu)) * 10, F.sans(STORY ? 26 : 22, 500), STORY ? 10 : 8, { alpha: E.outCubic(tu) * 0.85, fill: "#c9d6ea", shadow: 0.8, shadowBlur: 14 });
    // 名牌
    const pu = seg(t, T.end + 0.7, T.end + 1.2), pe = E.outCubic(pu);
    plaque(EN.pres.fx, EN.plaqueY, COPY.pres.role, COPY.pres.name, pe, (1 - pe) * 16);
    const vu = seg(t, T.end + 0.8, T.end + 1.3), ve = E.outCubic(vu);
    plaque(EN.vice.fx, EN.plaqueY, COPY.vice.role, COPY.vice.name, ve, (1 - ve) * 16);
    if (STORY) drawStoryCta(t); else drawFeedCta(t);
  }
  function drawFeedCta(t) {
    const EN = LY.end;
    const u = seg(t, T.end + 0.85, T.end + 1.35), e = E.outBack(u, 1.4);
    if (u > 0) {
      const text = COPY.ctaFeed, font = F.sans(33, 700);
      ctx.font = font; const tw = ctx.measureText(text).width;
      const pw = tw + 150, ph = 84, cx = W / 2, cy = EN.pillY;
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e); ctx.globalAlpha = clamp(u * 2);
      ctx.shadowColor = "rgba(79,143,216,0.95)"; ctx.shadowBlur = 40;
      roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2);
      const bg = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2); bg.addColorStop(0, "#5592de"); bg.addColorStop(1, "#2f66b3");
      ctx.fillStyle = bg; ctx.fill();
      ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      // 亮光掃過按鈕
      const sw = (t - (T.end + 1.4)) % 1.6;
      if (sw > 0 && sw < 0.7) {
        ctx.save(); roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.clip();
        const x = lerp(-pw, pw, sw / 0.7), g2 = ctx.createLinearGradient(x - 80, 0, x + 80, 0);
        g2.addColorStop(0, "rgba(255,255,255,0)"); g2.addColorStop(0.5, "rgba(255,255,255,0.35)"); g2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g2; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); ctx.restore();
      }
      ctx.font = font; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, -22, 2);
      // ↗ 箭頭
      const ax = tw / 2 + 16, nudge = Math.sin(t * 5) * 3;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(ax + nudge - 2, 13 - nudge); ctx.lineTo(ax + 22 + nudge, -9 - nudge); ctx.moveTo(ax + 4 + nudge, -10 - nudge); ctx.lineTo(ax + 22 + nudge, -9 - nudge); ctx.lineTo(ax + 22 + nudge, 9 - nudge); ctx.stroke();
      ctx.restore();
    }
    // 投票日
    const fu = seg(t, T.end + 1.0, T.end + 1.6), fe = E.outCubic(fu);
    if (fu > 0) richLine([
      { text: "投票日", font: F.sans(28, 500), fill: "#c9d6ea", sp: 6 },
      { gap: 22 },
      { text: COPY.date, font: F.latin(52), fill: C.gold, sp: 2, glow: true },
      { text: COPY.dateDay, font: F.sans(28, 700), fill: C.gold, sp: 0 },
      { gap: 34 }, { dot: true }, { gap: 34 },
      { text: "請投", font: F.sans(28, 700), fill: C.ivory, sp: 4 },
      { gap: 10 },
      { text: COPY.number, font: F.latin(56), fill: C.gold, sp: 0, glow: true },
      { gap: 10 },
      { text: "號", font: F.sans(28, 700), fill: C.ivory, sp: 0 }
    ], W / 2, LY.end.footY + (1 - fe) * 12, fe);
  }
  function drawStoryCta(t) {
    const EN = LY.end;
    // 上方：投票日
    const fu = seg(t, T.end + 0.9, T.end + 1.5), fe = E.outCubic(fu);
    if (fu > 0) richLine([
      { text: "投票日", font: F.sans(30, 500), fill: "#c9d6ea", sp: 6 },
      { gap: 22 },
      { text: COPY.date, font: F.latin(56), fill: C.gold, sp: 2, glow: true },
      { text: COPY.dateDay, font: F.sans(30, 700), fill: C.gold, sp: 0 },
      { gap: 34 }, { dot: true }, { gap: 34 },
      { text: "請投", font: F.sans(30, 700), fill: C.ivory, sp: 4 },
      { gap: 10 },
      { text: COPY.number, font: F.latin(60), fill: C.gold, sp: 0, glow: true },
      { gap: 10 },
      { text: "號", font: F.sans(30, 700), fill: C.ivory, sp: 0 }
    ], W / 2, EN.topY + (1 - fe) * -12, fe);
    // 下方：指向連結貼紙
    const u = seg(t, T.end + 0.9, T.end + 1.5), e = E.outCubic(u);
    if (u > 0) {
      glyphRun(COPY.ctaStory, W / 2, EN.ctaY + (1 - e) * 14, F.sans(38, 700), 4, { alpha: e, fill: C.ivory, glow: 16, glowColor: "rgba(63,127,207,0.9)", shadow: 0.9 });
      // 放連結貼紙的位置：一團柔和的光 + 往下的箭頭
      ctx.globalCompositeOperation = "lighter";
      sprite(GLOW_SOFT, W / 2, EN.slotY + 20, 420, 0.55 * e, 0.32);
      ctx.globalCompositeOperation = "source-over";
      const bounce = Math.abs(Math.sin((t - T.end) * 4.2)) * 12;
      ctx.save(); ctx.globalAlpha = e; ctx.strokeStyle = C.manaHi; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(90,160,255,1)"; ctx.shadowBlur = 16;
      const ax = W / 2, ay = EN.ctaY + 44 + bounce;
      ctx.beginPath(); ctx.moveTo(ax - 16, ay); ctx.lineTo(ax, ay + 16); ctx.lineTo(ax + 16, ay); ctx.stroke();
      ctx.restore();
    }
  }
  function richLine(parts, cx, cy, a) {
    let total = 0;
    for (const p of parts) {
      if (p.gap) { p.w = p.gap; }
      else if (p.dot) { p.w = 6; }
      else { p.L = layout(p.text, p.font, p.sp); p.w = p.L.width; }
      total += p.w;
    }
    let x = cx - total / 2;
    for (const p of parts) {
      if (p.dot) { ctx.globalAlpha = a; ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x + 3, cy, 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      else if (p.L) p.L.chars.forEach((c) => glyph(c.ch, x + p.w / 2 + c.cx, cy, p.font, { alpha: a, fill: p.fill, glow: p.glow ? 16 : 0, glowColor: "rgba(230,190,110,0.7)", shadow: 0.8, shadowBlur: 16 }));
      x += p.w;
    }
  }

  /* =========================================================
     每一格
     ========================================================= */
  let frameNo = 0;
  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    const hy = horizonY(t), sky = skyShift(t), sh = shake(t);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    drawSky(t, hy);
    drawMilky(t, sky);
    drawStars(t, sky);
    drawMoon(t, sky);
    drawMeteors(t, sky);
    drawHorizon(t, hy);
    drawField(t, hy);
    drawMagic(t);
    drawImpactFx(t);
    drawStaff(t);
    drawNotes(t);
    drawOrbs(t);
    drawFireflies(t);
    drawParts(t, sky);
    drawPhotos(t);
    ctx.restore();
    drawScrims(t);
    drawQuote(t, sky);
    drawS3(t);
    drawTitle(t);
    drawEndCard(t);
    post(t);
    frameNo++;
  }
  function post(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.filter = "none";
    // 光暈（bloom）：只讓亮的地方發光
    BLOOMG.globalCompositeOperation = "copy"; BLOOMG.filter = "contrast(3) brightness(0.8) blur(5px)";
    BLOOMG.drawImage(cv, 0, 0, BLOOM.width, BLOOM.height); BLOOMG.filter = "none";
    BLOOMG2.globalCompositeOperation = "copy"; BLOOMG2.filter = "blur(6px)";
    BLOOMG2.drawImage(BLOOM, 0, 0, BLOOM2.width, BLOOM2.height); BLOOMG2.filter = "none";
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.34; ctx.drawImage(BLOOM, 0, 0, W, H);
    ctx.globalAlpha = 0.3; ctx.drawImage(BLOOM2, 0, 0, W, H);
    // 撞擊的閃光
    const u = t - T.impact;
    if (u > 0 && u < 0.6) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * Math.exp(-u * 9); ctx.fillStyle = "#cfe6ff"; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.drawImage(VIGNETTE, 0, 0);
    // 開頭淡入、結尾不淡出（IG 會重播，保持畫面）
    const fin = seg(t, 0, 0.25);
    if (fin < 1) { ctx.globalAlpha = 1 - fin; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.085;
    ctx.drawImage(GRAIN[Math.floor(t * FPS) % 4], 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }

  /* =========================================================
     載入
     ========================================================= */
  async function loadImage(src) {
    for (let tries = 0; ; tries++) {
      try { const im = new Image(); im.src = src + (tries ? `?r=${tries}` : ""); await im.decode(); return im; }
      catch (e) { if (tries > 4) throw new Error(src + ": " + e.message); await new Promise((r) => setTimeout(r, 100)); }
    }
  }
  async function init() {
    await Promise.all([
      document.fonts.load(F.serif(80), "如果是欣梅爾"), document.fonts.load(F.serif(80, 700), "如果"),
      document.fonts.load(F.display(100), "寫下你的願望"), document.fonts.load(F.latin(100), "No.2"),
      document.fonts.load(F.hand(40), "零錢兌換機"), document.fonts.load(F.sans(30, 500), "如果"), document.fonts.load(F.sans(30, 700), "如果")
    ]);
    layoutCache.clear();
    const meta = await (await fetch("../build/staff/meta.json")).json();
    const frames = [];
    for (let i = 0; i < meta.frames; i++) frames.push(await loadImage(`../build/staff/${String(i).padStart(3, "0")}.png`));
    STAFF = { frames, orbV: meta.orbV, fw: meta.w, fh: meta.h };
    const [pi, vi] = await Promise.all([loadImage(PHOTO_META.pres.src), loadImage(PHOTO_META.vice.src)]);
    PHOTOS.pres = bakePhoto(pi, PHOTO_META.pres, LY.end.pres);
    PHOTOS.vice = bakePhoto(vi, PHOTO_META.vice, LY.end.vice);
    // 文字的版面要在字型載入後重新量（上面預先量過的換成正確的）
    rebuildLayouts();
  }
  function rebuildLayouts() {
    const re = (L, text, font, sp) => Object.assign(L, layout(text, font, sp));
    re(Q1, COPY.line1, F.serif(LY.quoteSize), 6); re(Q2, COPY.line2, F.serif(LY.quoteSize), 6);
    re(QC, COPY.caption, F.sans(STORY ? 30 : 28, 500), 7);
    S3.forEach((s) => re(s.L, s.text, F.serif(LY.s3Size), 5));
    re(TT, COPY.title, F.display(LY.titleSize), 8); re(TS, COPY.sub, F.sans(LY.subSize, 500), 3);
  }

  window.META = { W, H, DUR, FPS, T, fmt: STORY ? "story" : "feed" };
  window.draw = draw;
  window.READY = init().then(() => {
    // 字型載入之前算的火花位置要重算
    PARTS.length = 0;
    rebuildParticles();
    if (Q.has("t")) draw(+Q.get("t"));
    else if (Q.has("play")) {
      document.body.classList.add("preview");
      const start = performance.now();
      const loop = () => { draw(((performance.now() - start) / 1000) % DUR); requestAnimationFrame(loop); };
      loop();
    } else draw(0);
    return true;
  });
  function rebuildParticles() {
    Q1.chars.forEach((c, i) => burst({ seed: 50 + i, t0: line1Reveal(c), n: 7, x: W / 2 + c.cx, y: LY.quoteY, w: c.w * 0.6, h: LY.quoteSize * 0.6, speed: 140, life: 0.9, size: 9, g: 60, sky: true, spr: GLOW_WHITE }));
    const n = Q1.chars.length + Q2.chars.length;
    [Q1, Q2].forEach((L, li) => L.chars.forEach((c, i) => {
      const idx = li * Q1.chars.length + i;
      burst({ seed: 90 + idx, t0: T.quoteOut + (idx / n) * 0.3 + 0.05, n: 9, x: W / 2 + c.cx, y: LY.quoteY + li * LY.lineGap, w: c.w * 0.8, h: LY.quoteSize * 0.8, speed: 90, dir: -PI / 2, spread: 1.6, life: 1.1, size: 8, g: -40, sky: true, jitter: 0.15 });
    }));
    const cols = ["#9cc9f5", "#d9ecff", "#5f95dd", "#ffffff", "#b9b0ee"];
    cols.forEach((col, k) => burst({ seed: 600 + k, t0: T.impact, n: STORY ? 12 : 10, x: W / 2, y: LY.footY - 20, w: 500, h: 60, speed: 900, dir: -PI / 2, spread: 2.2, life: 2.2, size: 11, g: 520, drag: 2.2, petal: true, col, jitter: 0.08 }));
    burst({ seed: 690, t0: T.impact, n: 40, x: W / 2, y: LY.footY - 30, w: 300, h: 40, speed: 1000, dir: -PI / 2, spread: 2.6, life: 1.6, size: 12, g: 200, drag: 2.5, spr: GLOW_WHITE, jitter: 0.05 });
    // 紙條燒掉時的火花
    NOTES.forEach((nn, i) => {
      for (let k = 0; k < 6; k++) {
        const tb = nn.ign + (k / 6) * T.burn, q = notePos(nn, tb);
        burst({ seed: 700 + i * 10 + k, t0: tb, n: 5, x: q.x, y: q.y, w: nn.spr.w * q.s * 0.8, h: nn.spr.h * q.s * 0.6, speed: 160, dir: -PI / 2, spread: 2.4, life: 0.9, size: 8, g: -80, spr: k % 2 ? GLOW_BLUE : GLOW_WHITE });
      }
      // 落地時的火花
      const o = ORBS[i];
      burst({ seed: 800 + i, t0: nn.land.t, n: 16, x: o.x1, y: o.y1, w: 20, h: 10, speed: 380, dir: -PI / 2, spread: 2.2, life: 1.0, size: 9, g: 380, drag: 1.6, spr: GLOW_WHITE });
    });
  }
})();
