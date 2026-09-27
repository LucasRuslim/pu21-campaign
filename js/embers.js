/* =========================================================
   魔法粒子（芙莉蓮風格）：星光、魔力光點、花瓣、魔法陣
   - 滑鼠移動：星光 + 光點拖尾，偶爾飄落花瓣
   - 點擊：魔法陣擴散 + 星光
   - 捲動：光點和花瓣隨捲動飄過
   - Embers.burst(x, y, n)：爆發（權杖插入、送出願望）
   效能：只有在有粒子時才跑，沒有就停止並隱藏畫布；圖案都是預先畫好的 sprite
   ========================================================= */
(function () {
  var api = { scroll: function () {}, burst: function () {}, flowers: function () {}, trail: function () {}, bloom: function () {}, ok: false };
  window.Embers = api;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.className = "embers";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  api.ok = true;

  var W = 0, H = 0;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- 預先畫好的圖案 ---------- */
  function make(size, draw) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"), size);
    return c;
  }
  function glow(stops) {
    return make(64, function (g, s) {
      var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      stops.forEach(function (st) { grd.addColorStop(st[0], st[1]); });
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
  }
  function star(core, tint) {
    return make(96, function (g) {
      var c = 48;
      var grd = g.createRadialGradient(c, c, 0, c, c, 22);
      grd.addColorStop(0, core); grd.addColorStop(.3, tint); grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(c, c, 22, 0, Math.PI * 2); g.fill();
      // 四道光芒
      [[1, 0], [0, 1]].forEach(function (d) {
        var lg = g.createLinearGradient(c - d[0] * 46, c - d[1] * 46, c + d[0] * 46, c + d[1] * 46);
        lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(.5, core); lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg;
        g.beginPath();
        if (d[0]) { g.moveTo(c - 46, c); g.quadraticCurveTo(c, c - 3, c + 46, c); g.quadraticCurveTo(c, c + 3, c - 46, c); }
        else { g.moveTo(c, c - 46); g.quadraticCurveTo(c - 3, c, c, c + 46); g.quadraticCurveTo(c + 3, c, c, c - 46); }
        g.fill();
      });
    });
  }
  function petal(a, b) {
    return make(48, function (g) {
      g.translate(24, 24);
      var grd = g.createLinearGradient(0, -20, 0, 20);
      grd.addColorStop(0, a); grd.addColorStop(1, b);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -20);
      g.bezierCurveTo(13, -12, 12, 10, 0, 20);
      g.bezierCurveTo(-12, 10, -13, -12, 0, -20);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, -14); g.lineTo(0, 14); g.stroke();
    });
  }
  var MOTES = [
    glow([[0, "rgba(255,255,255,1)"], [.2, "rgba(190,232,255,.9)"], [.55, "rgba(90,160,230,.35)"], [1, "rgba(60,120,210,0)"]]),
    glow([[0, "rgba(255,255,250,1)"], [.2, "rgba(255,236,190,.9)"], [.55, "rgba(230,190,110,.35)"], [1, "rgba(200,160,80,0)"]])
  ];
  var STARS = [star("rgba(255,255,255,1)", "rgba(170,220,255,.6)"), star("rgba(255,250,235,1)", "rgba(240,210,140,.55)")];
  var PETALS = [
    petal("rgba(255,255,255,.95)", "rgba(210,232,255,.9)"),
    petal("rgba(236,246,255,.95)", "rgba(150,200,245,.9)"),
    petal("rgba(255,244,250,.95)", "rgba(230,205,240,.9)")
  ];

  /* ---------- 粒子 ---------- */
  var MAX = 400;
  var parts = [];
  var running = false, last = 0;

  function add(p) {
    if (parts.length >= MAX) parts.shift();
    p.max = p.life;
    parts.push(p);
    if (!running) start();
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function spark(x, y, vx, vy, big, life) {
    var isStar = Math.random() < (big ? .5 : .35);
    add({
      k: "spark", x: x, y: y, vx: vx, vy: vy,
      spr: isStar ? pick(STARS) : pick(MOTES),
      s: isStar ? rnd(8, big ? 20 : 14) : rnd(3, big ? 9 : 7),
      life: life || rnd(.6, big ? 1.8 : 1.3), tw: rnd(8, 16), ph: rnd(0, 6.28), lift: rnd(20, 60)
    });
  }
  function petalP(x, y, vx, vy, big, life) {
    add({
      k: "petal", x: x, y: y, vx: vx, vy: vy, spr: pick(PETALS),
      s: big ? rnd(9, 16) : rnd(6, 11), life: life || rnd(2.2, 3.6), rot: rnd(0, 6.28), vr: rnd(-3, 3),
      ph: rnd(0, 6.28), sw: rnd(30, 70), flip: rnd(2, 4)
    });
  }
  function ring(x, y, r) {
    add({ k: "ring", x: x, y: y, r: 4, R: r || 70, life: .9, rot: rnd(0, 6.28) });
  }

  function start() {
    running = true;
    canvas.style.visibility = "visible";
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function tick(now) {
    var dt = Math.min(0.05, Math.max(0, now - last) / 1000);   // 第一格的 now 可能比 last 早 → 不能是負的
    last = now;
    ctx.clearRect(0, 0, W, H);
    if (!parts.length) {
      running = false;
      canvas.style.visibility = "hidden";
      return;
    }
    var i, p, k, a;
    // 更新
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y < -60 || p.y > H + 60) { parts.splice(i, 1); continue; }
      if (p.k === "spark") {
        p.vy -= p.lift * dt;
        p.vx *= .97; p.vy *= .97;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.ph += p.tw * dt;
      } else if (p.k === "petal") {
        p.ph += dt * 2.2;
        p.vy += (26 - p.vy) * dt * .8;             // 慢慢飄落
        p.vx += (Math.sin(p.ph) * p.sw - p.vx) * dt * 1.5;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      } else {
        p.r += (p.R - p.r) * dt * 5;
        p.rot += dt * .8;
      }
    }
    // 花瓣（一般混合）
    ctx.globalCompositeOperation = "source-over";
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.k !== "petal") continue;
      k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 2.5) * .9;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.abs(Math.cos(p.ph * p.flip * .3)) * .7 + .3);   // 翻轉
      ctx.drawImage(p.spr, -p.s, -p.s, p.s * 2, p.s * 2);
      ctx.restore();
    }
    // 光（相加混合）
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      k = p.life / p.max;
      if (p.k === "spark") {
        a = (k < .85 ? k / .85 : (1 - k) / .15) * (.65 + .35 * Math.sin(p.ph));
        var sz = p.s * (.5 + .5 * k) * (.85 + .25 * Math.sin(p.ph));
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.drawImage(p.spr, p.x - sz, p.y - sz, sz * 2, sz * 2);
      } else if (p.k === "ring") {
        // 小魔法陣：兩個圓 + 刻度
        ctx.globalAlpha = k * .9;
        ctx.strokeStyle = "rgba(180,225,255,1)";
        ctx.lineWidth = 1.5;
        if (p.r <= 0) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(240,215,150,1)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .72, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        for (var t = 0; t < 12; t++) {
          var ang = p.rot + t * Math.PI / 6;
          ctx.moveTo(p.x + Math.cos(ang) * p.r * .76, p.y + Math.sin(ang) * p.r * .76);
          ctx.lineTo(p.x + Math.cos(ang) * p.r * .94, p.y + Math.sin(ang) * p.r * .94);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  /* ---------- 捲動：光點往反方向流過，偶爾有花瓣 ---------- */
  var acc = 0;
  api.scroll = function (v) {
    var speed = Math.min(Math.abs(v), 60);
    if (speed < 2) return;
    acc += speed * 0.014;
    var down = v > 0;
    while (acc >= 1) {
      acc -= 1;
      var x = Math.random() * W;
      if (Math.random() < .18) {
        petalP(x, down ? -20 : H + 20, rnd(-30, 30), down ? 60 + speed * 3 : -(60 + speed * 3));
      } else {
        spark(x, down ? H + 10 : Math.random() * H * .3, rnd(-20, 20),
          down ? -(140 + speed * 12 + Math.random() * 100) : 100 + speed * 5, false);
      }
    }
  };

  /* ---------- 花瓣（魔杖經過每個字時） ---------- */
  api.flowers = function (x, y, n) {
    for (var i = 0; i < (n || 20); i++) {
      var a = Math.random() * Math.PI * 2, sp = rnd(60, 260);
      if (i % 3 === 0) spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp * .7 - 60, true);
      else petalP(x + rnd(-10, 10), y + rnd(-10, 10), Math.cos(a) * sp * .6, Math.sin(a) * sp * .5 - 90, true);
    }
  };
  /* 杖尖的軌跡：移動越多，灑出越多花瓣和星光 */
  var trailAcc = 0;
  api.trail = function (x, y, dx, dy, step, quick) {
    step = step || 16;
    trailAcc += Math.sqrt(dx * dx + dy * dy);
    while (trailAcc > step) {
      trailAcc -= step;
      var life = quick ? rnd(.35, .7) : 0;
      if (Math.random() < .6) petalP(x + rnd(-14, 14), y + rnd(-14, 14), -dx * 1.5 + rnd(-40, 40), rnd(-30, 40), true, life);
      else spark(x + rnd(-6, 6), y + rnd(-6, 6), -dx * 2 + rnd(-40, 40), rnd(-40, 20), false, life);
    }
  };
  /* 一團花蓋住一個字，很快散開消失 → 花散掉之後就看到字 */
  api.bloom = function (x, y, w, h, n) {
    for (var i = 0; i < (n || 34); i++) {
      var px = x + rnd(.1, .9) * w, py = y + rnd(.1, .9) * h;
      var ang = Math.atan2(py - (y + h / 2), px - (x + w / 2)), sp = rnd(30, 140);
      if (i % 4 === 0) spark(px, py, Math.cos(ang) * sp, Math.sin(ang) * sp, true, rnd(.35, .6));
      else petalP(px, py, Math.cos(ang) * sp, Math.sin(ang) * sp - 20, true, rnd(.45, .8));
    }
  };

  /* ---------- 爆發 ---------- */
  api.burst = function (x, y, n) {
    ring(x, y, 90);
    ring(x, y, 150);
    for (var i = 0; i < (n || 40); i++) {
      var a = Math.random() * Math.PI * 2, sp = rnd(120, 460);
      if (i % 5 === 0) petalP(x, y, Math.cos(a) * sp * .5, Math.sin(a) * sp * .4 - 60);
      else spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp * .7 - 80, true);
    }
  };

  /* ---------- 滑鼠：星光拖尾 + 花瓣；點擊：魔法陣 ---------- */
  if (window.matchMedia("(pointer: fine)").matches) {
    var lx = -1, ly = -1, dist = 0, petalDist = 0;
    window.addEventListener("mousemove", function (e) {
      if (lx < 0) { lx = e.clientX; ly = e.clientY; return; }
      var dx = e.clientX - lx, dy = e.clientY - ly;
      var d = Math.sqrt(dx * dx + dy * dy);
      dist += d; petalDist += d;
      lx = e.clientX; ly = e.clientY;
      while (dist > 11) {
        dist -= 11;
        spark(lx + rnd(-5, 5), ly + rnd(-5, 5), -dx * 1.5 + rnd(-40, 40), -dy * 1.5 + rnd(-50, 10), false);
      }
      if (petalDist > 90) {
        petalDist = 0;
        petalP(lx, ly, rnd(-40, 40), rnd(-40, 0));
      }
    }, { passive: true });
    window.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      ring(e.clientX, e.clientY, 56);
      for (var i = 0; i < 10; i++) {
        var a = Math.random() * Math.PI * 2, sp = rnd(80, 240);
        spark(e.clientX, e.clientY, Math.cos(a) * sp, Math.sin(a) * sp, true);
      }
    }, { passive: true });
  }
})();
