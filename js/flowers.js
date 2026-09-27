/* =========================================================
   大朵的花（7 種花 + 葉子，一開始用 canvas 畫好，之後只是放大、旋轉、移動）
   兩個獨立的花海：
   - Flowers：導覽轉場。Flowers.start() → Flowers.front(x)（x 左邊的花開出來）→ Flowers.scatter()
   - FlowerWipe：會長 → 副會長 換人。FlowerWipe.scrub(p)，p 0 → 0.45 花從左邊開滿畫面，0.55 → 1 花散開；
     完全跟著捲動（往回捲會倒著播），p ≤ 0 或 ≥ 1 時隱藏
   ========================================================= */
(function () {
  function noop() {}
  var dummy = { ok: false, start: noop, front: noop, scatter: noop, scrub: noop, covered: function () { return true; } };
  window.Flowers = dummy;
  window.FlowerWipe = dummy;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!document.createElement("canvas").getContext("2d")) return;

  /* ---------------- 畫花 ---------------- */
  var S = 256, C = 128, K = C / 110;   // 圖片大小；花瓣最長 110px，K = 圖片半徑 / 花的半徑

  function petalPath(g, len, w, shape) {
    g.beginPath();
    g.moveTo(0, 0);
    if (shape === "notch") {          // 波斯菊：尖端有缺口
      g.bezierCurveTo(w * .6, -len * .2, w * .62, -len * .8, w * .22, -len);
      g.lineTo(0, -len * .9);
      g.lineTo(-w * .22, -len);
      g.bezierCurveTo(-w * .62, -len * .8, -w * .6, -len * .2, 0, 0);
    } else if (shape === "thin") {    // 雛菊：細長
      g.bezierCurveTo(w * .7, -len * .25, w * .6, -len * .9, 0, -len);
      g.bezierCurveTo(-w * .6, -len * .9, -w * .7, -len * .25, 0, 0);
    } else {                          // 圓的花瓣
      g.bezierCurveTo(w * .75, -len * .12, w * .72, -len * 1.02, 0, -len);
      g.bezierCurveTo(-w * .72, -len * 1.02, -w * .75, -len * .12, 0, 0);
    }
    g.closePath();
  }

  function ring(g, r) {
    for (var i = 0; i < r.n; i++) {
      g.save();
      g.rotate((i / r.n) * Math.PI * 2 + (r.rot || 0) + (Math.random() - .5) * (r.jit || .08));
      var len = r.len * (1 - Math.random() * .08);
      var grd = g.createRadialGradient(0, 0, 0, 0, 0, len);
      grd.addColorStop(0, r.base);
      grd.addColorStop(.6, r.mid || r.tip);
      grd.addColorStop(1, r.tip);
      g.shadowColor = "rgba(10, 16, 32, .28)";
      g.shadowBlur = 7;
      g.shadowOffsetY = 2;
      petalPath(g, len, r.w, r.shape);
      g.fillStyle = grd;
      g.fill();
      g.shadowColor = "transparent";
      g.lineWidth = 1;
      g.strokeStyle = r.edge || "rgba(0, 0, 0, .1)";
      g.stroke();
      // 花瓣上的紋路
      g.beginPath();
      g.moveTo(0, -len * .12);
      g.quadraticCurveTo(len * .03, -len * .5, 0, -len * .82);
      g.strokeStyle = r.vein || "rgba(255, 255, 255, .22)";
      g.stroke();
      g.restore();
    }
  }

  function center(g, c) {
    var grd = g.createRadialGradient(-c.r * .3, -c.r * .3, 0, 0, 0, c.r);
    grd.addColorStop(0, c.c1);
    grd.addColorStop(1, c.c2);
    g.shadowColor = "rgba(0, 0, 0, .3)";
    g.shadowBlur = 4;
    g.beginPath(); g.arc(0, 0, c.r, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
    g.shadowColor = "transparent";
    if (c.seeds) {                    // 雛菊的花心：小點排成螺旋
      for (var i = 0; i < 70; i++) {
        var a = i * 2.39996, d = Math.sqrt(i / 70) * c.r * .88;
        g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 1.3, 0, Math.PI * 2);
        g.fillStyle = "rgba(120, 70, 10, .45)"; g.fill();
      }
    }
    if (c.stamens) {                  // 花蕊
      for (var k = 0; k < c.stamens; k++) {
        var b = (k / c.stamens) * Math.PI * 2 + Math.random() * .2, dd = c.r * (1.05 + Math.random() * .45);
        g.beginPath(); g.moveTo(Math.cos(b) * c.r * .5, Math.sin(b) * c.r * .5); g.lineTo(Math.cos(b) * dd, Math.sin(b) * dd);
        g.strokeStyle = c.stalk || "rgba(255, 240, 200, .7)"; g.lineWidth = 1.2; g.stroke();
        g.beginPath(); g.arc(Math.cos(b) * dd, Math.sin(b) * dd, 2.4, 0, Math.PI * 2);
        g.fillStyle = c.tipc || "#ffe28a"; g.fill();
      }
    }
  }

  var SPECS = [
    { w: 3, rings: [{ n: 5, len: 108, w: 72, base: "#2552a8", mid: "#4f86d6", tip: "#cfe6ff", vein: "rgba(255,255,255,.3)" }],   // 蒼月草（藍色）
      c: { r: 15, c1: "#fff8d6", c2: "#e4b64a", stamens: 12 } },
    { w: 2, rings: [{ n: 6, len: 106, w: 66, base: "#d9d3ee", mid: "#f4f1fb", tip: "#ffffff", vein: "rgba(150,140,190,.25)", edge: "rgba(120,110,160,.18)" }],   // 白色銀蓮花
      c: { r: 20, c1: "#4a4868", c2: "#17162a", stamens: 22, stalk: "rgba(40,36,70,.9)", tipc: "#2a2744" } },
    { w: 2, rings: [{ n: 22, len: 104, w: 17, shape: "thin", base: "#e9e6f7", tip: "#ffffff", vein: "rgba(180,170,210,.2)", edge: "rgba(120,110,160,.14)", jit: .12 }],   // 雛菊
      c: { r: 27, c1: "#ffe07a", c2: "#e39a1c", seeds: true } },
    { w: 1.5, rings: [{ n: 8, len: 106, w: 44, shape: "notch", base: "#c24b86", mid: "#e889b6", tip: "#ffe0ee", vein: "rgba(255,255,255,.3)" }],   // 波斯菊（粉紅）
      c: { r: 15, c1: "#ffe08a", c2: "#d99a1e", stamens: 16 } },
    { w: 1.5, rings: [   // 奶油色玫瑰
        { n: 7, len: 108, w: 70, base: "#e8b996", tip: "#fff4e8", rot: 0 },
        { n: 6, len: 84, w: 62, base: "#e2a984", tip: "#fde9d8", rot: .5 },
        { n: 5, len: 60, w: 52, base: "#d99672", tip: "#f9dcc6", rot: .2 },
        { n: 5, len: 38, w: 38, base: "#c98060", tip: "#f0c8ae", rot: .9 }],
      c: { r: 9, c1: "#d38a66", c2: "#a45f42" } },
    { w: 1.5, rings: [{ n: 5, len: 106, w: 66, base: "#5e4fb0", mid: "#9b8ee0", tip: "#ece7ff", vein: "rgba(255,255,255,.28)" }],   // 薰衣草紫
      c: { r: 14, c1: "#fffbe0", c2: "#e8c65a", stamens: 10 } },
    { w: 1.5, rings: [   // 藍玫瑰
        { n: 7, len: 108, w: 72, base: "#2d4f96", tip: "#b8d3f5" },
        { n: 6, len: 82, w: 62, base: "#284683", tip: "#a4c3ee", rot: .45 },
        { n: 5, len: 58, w: 50, base: "#223c73", tip: "#94b6e6", rot: .15 },
        { n: 4, len: 34, w: 36, base: "#1c3262", tip: "#809fd4", rot: .8 }],
      c: { r: 8, c1: "#5a7fc4", c2: "#1c3262" } }
  ];

  function makeFlower(spec) {
    var cv = document.createElement("canvas");
    cv.width = cv.height = S;
    var g = cv.getContext("2d");
    g.translate(C, C);
    spec.rings.forEach(function (r) { ring(g, r); });
    center(g, spec.c);
    return cv;
  }
  function makeLeaves() {
    var cv = document.createElement("canvas");
    cv.width = cv.height = S;
    var g = cv.getContext("2d");
    g.translate(C, C);
    for (var i = 0; i < 3; i++) {
      g.save();
      g.rotate(-.9 + i * .9 + (Math.random() - .5) * .3);
      var len = 104 - i * 6;
      var grd = g.createLinearGradient(0, 0, 0, -len);
      grd.addColorStop(0, "#23492f");
      grd.addColorStop(1, "#5f9660");
      g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = 6; g.shadowOffsetY = 2;
      petalPath(g, len, 50, "thin");
      g.fillStyle = grd; g.fill();
      g.shadowColor = "transparent";
      g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -len * .9);
      g.strokeStyle = "rgba(200, 235, 190, .35)"; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
    return cv;
  }

  // 每種花畫兩個版本（花瓣角度稍微不同，看起來比較自然）
  var FLOWERS = [], WEIGHTS = [];
  SPECS.forEach(function (sp) {
    for (var v = 0; v < 2; v++) { FLOWERS.push(makeFlower(sp)); WEIGHTS.push(sp.w); }
  });
  var LEAVES = [makeLeaves(), makeLeaves(), makeLeaves()];
  var WSUM = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
  function pickFlower() {
    var r = Math.random() * WSUM;
    for (var i = 0; i < FLOWERS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return FLOWERS[i]; }
    return FLOWERS[0];
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function easeOutBack(t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ---------------- 一片花海（各自有自己的畫布） ---------------- */
  function makeField() {
    var canvas = document.createElement("canvas");
    canvas.className = "flowerfield";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1, sp = 60, items = [];
    var mode = null;                       // "time"（導覽轉場）或 "scrub"（跟著捲動）
    var running = false, scatterAt = 0, frontX = -1e9;
    var scrubP = 0, queued = false;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var base = Math.max(46, Math.min(W, H) * .085);   // 花的半徑
      sp = base * 1.28;
      items = [];
      function add(x, y, r, spr, layer) {
        items.push({
          x: x, y: y, r: r, spr: spr, layer: layer, rot: rnd(0, Math.PI * 2),
          trig: x + rnd(-sp * .7, sp * .5), t0: 0,
          sd: rnd(0, .3), sdur: rnd(.75, 1.15), vr: rnd(-3, 3)
        });
      }
      // 底層：葉子
      for (var ly = -sp * .5; ly < H + sp; ly += sp * 1.05)
        for (var lx = -sp * .5; lx < W + sp; lx += sp * 1.1)
          add(lx + rnd(-sp * .3, sp * .3), ly + rnd(-sp * .3, sp * .3), base * rnd(1.1, 1.4), LEAVES[(Math.random() * 3) | 0], 0);
      // 花：六角形排列（不會有空隙）
      var row = 0;
      for (var y = -sp * .4; y < H + sp; y += sp * .866, row++)
        for (var x = -sp * .4 + (row % 2 ? sp * .5 : 0); x < W + sp; x += sp)
          add(x + rnd(-sp * .18, sp * .18), y + rnd(-sp * .18, sp * .18), base * rnd(.88, 1.2), pickFlower(), 1);
      // 上層：小一點的花，填補縫隙
      var extra = Math.round(items.length * .3);
      for (var e = 0; e < extra; e++) add(rnd(0, W), rnd(0, H), base * rnd(.55, .85), pickFlower(), 2);
      items.sort(function (a, b) { return a.layer - b.layer; });
      items.forEach(function (it) {   // 散開的方向：從畫面中心往外，稍微往上
        var dx = it.x - W / 2, dy = it.y - H / 2, d = Math.hypot(dx, dy) || 1;
        var sp2 = Math.max(W, H) * rnd(.45, .8);
        it.vx = dx / d * sp2; it.vy = dy / d * sp2 - H * .25;
      });
    }

    function drawItem(it, b, u) {        // b：開花程度 0–1，u：散開程度 0–1
      var s = it.layer === 0 ? b : easeOutBack(b);
      var rot = it.rot - (1 - b) * 1.4;
      var x = it.x, y = it.y, a = 1;
      if (u > 0) {
        var f = u * u;
        x += it.vx * f; y += it.vy * f;
        rot += it.vr * u;
        s *= 1 - .45 * u;
        a = 1 - Math.pow(u, 1.6);
      }
      if (s <= .01 || a <= .01) return;
      var R = it.r * s * K * dpr, c = Math.cos(rot), sn = Math.sin(rot);
      ctx.globalAlpha = a;
      ctx.setTransform(c, sn, -sn, c, x * dpr, y * dpr);
      ctx.drawImage(it.spr, -R, -R, R * 2, R * 2);
    }
    function clear() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function hide() {
      running = false; mode = null;
      clear();
      canvas.style.visibility = "hidden";
    }

    /* 導覽轉場：跟著時間 */
    function tick() {
      if (mode !== "time") return;
      var now = performance.now() / 1000;
      clear();
      var alive = 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.t0) { alive++; continue; }
        var b = Math.min(1, (now - it.t0) / (it.layer === 0 ? .3 : .42));
        var u = scatterAt ? clamp01((now - scatterAt - it.sd) / it.sdur) : 0;
        if (u >= 1) continue;
        alive++;
        drawItem(it, b, u);
      }
      ctx.globalAlpha = 1;
      if (scatterAt && !alive) { hide(); return; }
      requestAnimationFrame(tick);
    }

    /* 換人：跟著捲動（同一個 p 永遠畫出同一個畫面，所以往回捲會倒著播） */
    function drawScrub() {
      queued = false;
      if (mode !== "scrub") return;
      var p = scrubP;
      var fx = -sp * 1.5 + (W + sp * 4.7) * clamp01(p / .45);   // 開花的前緣從左到右
      var s2 = clamp01((p - .55) / .45);
      clear();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var b = clamp01((fx - it.trig) / (sp * 1.4));
        if (b <= 0) continue;
        var u = s2 > 0 ? clamp01((s2 - it.sd * .5) / (it.sdur * .6)) : 0;
        if (u >= 1) continue;
        drawItem(it, b, u);
      }
      ctx.globalAlpha = 1;
    }

    window.addEventListener("resize", function () {
      if (mode === "scrub") { layout(); drawScrub(); }
    });

    return {
      ok: true,
      start: function () {
        layout();
        mode = "time"; scatterAt = 0; frontX = -1e9;
        canvas.style.visibility = "visible";
        if (!running) { running = true; requestAnimationFrame(tick); }
      },
      /** x 左邊的花開出來（杖頭現在的位置） */
      front: function (x) {
        if (x <= frontX) return;
        frontX = x;
        var now = performance.now() / 1000;
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (!it.t0 && it.trig <= x) it.t0 = now + (it.layer === 2 ? .06 : 0);
        }
      },
      /** 全部的花都開完了嗎 */
      covered: function () {
        var now = performance.now() / 1000;
        for (var i = 0; i < items.length; i++) if (!items[i].t0 || now - items[i].t0 < .42) return false;
        return true;
      },
      scatter: function () {
        this.front(1e9);
        scatterAt = performance.now() / 1000;
      },
      scrub: function (p) {
        if (!(p > 0 && p < 1)) { if (mode === "scrub") hide(); return; }
        if (mode === "time") return;
        if (mode !== "scrub") { layout(); mode = "scrub"; canvas.style.visibility = "visible"; }
        scrubP = p;
        if (!queued) { queued = true; requestAnimationFrame(drawScrub); }
      }
    };
  }

  window.Flowers = makeField();
  window.FlowerWipe = makeField();
})();
