/* =========================================================
   3D 權杖（three.js）
   模型：blender/build_staff.py → assets/staff.glb → js/staff-model.js
   用法（main.js）：
     Staff.ok            是否能用 WebGL
     Staff.ready(fn)     模型載入後呼叫
     Staff.define(name, { el, anchor:[x,y], angle, gap, size, mark })
     Staff.go(name)      飛到某個指引位置並指向目標
     Staff.twirl()       原地旋轉一圈
   角度 angle：權杖頭（月牙）指向的方向，0 = 向右，90 = 向上，-90 = 向下
   size：權杖在畫面上的長度（佔視窗高度的比例）

   效能：畫布只有權杖那麼大（不是全螢幕），用 CSS transform 移動 / 旋轉 / 縮放，
   WebGL 只負責畫權杖本身的自轉。
   ========================================================= */
(function () {
  var api = { ok: false, ready: function () {}, define: function () {}, go: function () {}, twirl: function () {}, current: function () { return null; } };
  window.Staff = api;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.getElementById("staff3d");
  if (reduceMotion || !canvas || !window.THREE || !THREE.GLTFLoader || !window.STAFF_GLB) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return;
  }
  api.ok = true;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.physicallyCorrectLights = true;
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  var FOV = 18;
  var camera = new THREE.PerspectiveCamera(FOV, 0.34, 0.1, 100);

  var key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(-4, 6, 8);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x7cc4ff, 3.2);   // 月光般的藍色輪廓光
  rim.position.set(6, 1, -5);
  scene.add(rim);
  var fill = new THREE.DirectionalLight(0xffd9a8, 0.8);
  fill.position.set(5, -3, 6);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  var spinner = new THREE.Group(); // 自轉 + 滑鼠傾斜（位置 / 指向交給 CSS）
  scene.add(spinner);

  var orbLight = new THREE.PointLight(0xff1a14, 0, 4, 2);
  var L = 3.46, tipY = 1.73; // 由模型實際尺寸覆寫

  /* ---------- 畫布尺寸：以最大的權杖長度為準，其他大小用 CSS 縮小 ---------- */
  var W = 1, H = 1, baseLen = 1, cw = 1, ch = 1;
  var ASPECT = 0.36, PAD = 1.08;   // 畫布寬 / 權杖長，畫布高 / 權杖長

  function lenFor(size) {
    var s = size * H;
    if (W < 700) s *= 0.8;
    return Math.min(s, W * 1.15);   // 權杖不要比畫面寬
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    baseLen = Math.max(lenFor(0.74), 1);
    cw = Math.round(baseLen * ASPECT);
    ch = Math.round(baseLen * PAD);
    renderer.setSize(cw, ch, false);
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    camera.aspect = cw / ch;
    camera.position.set(0, 0, (L * PAD / 2) / Math.tan((FOV / 2) * Math.PI / 180));
    camera.updateProjectionMatrix();
  }

  /* ---------- 載入模型 ---------- */
  var readyFns = [];
  var isReady = false;
  api.ready = function (fn) { if (isReady) fn(); else readyFns.push(fn); };

  function b64ToBuffer(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  new THREE.GLTFLoader().parse(b64ToBuffer(window.STAFF_GLB), "", function (gltf) {
    var model = gltf.scene;
    var box = new THREE.Box3().setFromObject(model);
    var center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    L = box.max.y - box.min.y;
    tipY = box.max.y - center.y;

    model.traverse(function (o) {
      if (!o.isMesh) return;
      var m = o.material;
      if (m) m.envMapIntensity = 1.3;
      if (/orb/i.test(o.name) || (m && /orb/i.test(m.name))) {
        o.material = new THREE.MeshPhysicalMaterial({
          color: 0x8f0006, emissive: 0x3d0002, emissiveIntensity: 1,
          roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
          envMapIntensity: 2.2
        });
        var p = new THREE.Vector3();
        o.getWorldPosition(p);
        orbLight.position.copy(p).sub(center);
        orbY = p.y - center.y;   // 寶珠離中心多遠（用來把寶珠對準插座）
      }
      if (m && /gold/i.test(m.name)) { m.roughness = 0.2; m.envMapIntensity = 1.6; }
      if (m && /lacquer/i.test(m.name)) { m.envMapIntensity = 1.4; }
    });
    spinner.add(model);
    spinner.add(orbLight);
    resize();

    isReady = true;
    readyFns.forEach(function (fn) { fn(); });
    readyFns = [];
  }, function (err) {
    api.ok = false;
    console.warn("staff model failed", err);
  });

  resize();
  var resizeT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(resize, 120);
  });

  /* ---------- 指引位置 ---------- */
  var stops = {};
  var active = null;
  var pointedEl = null;
  api.define = function (name, def) { stops[name] = def; };

  var cur = { x: 0, y: 0, ang: 90, len: 0 };
  var spinVel = 0, flash = 0;
  var orbY = 1.3;
  var arriveFns = [], departFns = [], arrivedMode = null, docked = false;
  /** 權杖到達某個位置（並停穩）時呼叫 fn(name)；離開那個位置時呼叫 onDepart 的 fn(name) */
  api.onArrive = function (fn) { arriveFns.push(fn); };
  api.onDepart = function (fn) { departFns.push(fn); };
  api.isDocked = function () { return docked; };
  var mouseY = 0;
  window.addEventListener("mousemove", function (e) { mouseY = e.clientY / H - 0.5; }, { passive: true });

  function resolve(v) { return typeof v === "function" ? v() : v; }
  function resolveEl(def) {
    if (!def.el) return null;
    return typeof def.el === "function" ? def.el() : document.querySelector(def.el);
  }

  api.go = function (name, force) {
    if (active === name && !force) return;
    var first = active === null;
    active = name;
    wasTravel = false;
    var def = stops[name];
    if (first && def) {   // 第一次出現：直接放在目標位置
      var d0 = desired();
      if (d0) { cur.x = d0.x; cur.y = d0.y; cur.ang = d0.ang; }
    }
    spinVel += name === "loader" ? 0 : (force ? 3 : 5);
    flash = 1;
    var el = def ? (def.mark ? (typeof def.mark === "function" ? def.mark() : document.querySelector(def.mark)) : resolveEl(def)) : null;
    // el 可能不是真的元素（3D 海報的位置），沒有 classList 就不加強調
    if (pointedEl && pointedEl !== el && pointedEl.classList) pointedEl.classList.remove("is-pointed");
    if (el && el.classList && def.emphasis !== false) {
      el.classList.remove("is-pointed");
      void el.offsetWidth;
      el.classList.add("is-pointed");
    }
    pointedEl = el;
  };
  api.twirl = function (amount) { spinVel += amount || 18; flash = 1; };
  /** 從畫面外、靠近目標的那一側飛進來（換頁之後用，才不會橫越整個畫面） */
  api.enterFromSide = function () {
    var d = desired();
    if (!d || d.travel) return;
    var off = d.len * .75;
    cur.x = d.x < W / 2 ? -off : W + off;
    cur.y = d.y; cur.ang = d.ang; cur.len = d.len;
    vel.x = vel.y = vel.ang = 0;
    prevD = null;
  };
  /** 權杖現在離目標還有多遠（px） */
  api.distance = function () {
    var d = desired();
    return d ? Math.hypot(d.x - cur.x, d.y - cur.y) : 0;
  };
  /** 立刻移到目前的目標位置（不要飛過去）：頁尾的快速飛越從畫面外開始 */
  api.snap = function () {
    var d = desired();
    if (!d) return;
    cur.x = d.x; cur.y = d.y; cur.ang = d.ang; cur.len = d.len;
    vel.x = vel.y = vel.ang = vel.len = 0;
    prevD = { x: d.x, y: d.y, ang: d.ang };
  };
  api.current = function () { return active; };

  var wasTravel = false;   // 用來做「滯後」：避免目標剛好在畫面邊緣時來回切換
  function desired() {
    var def = stops[active];
    if (!def) return null;
    var size = resolve(def.size || 0.5);
    var len = def.sizePx ? resolve(def.sizePx) : lenFor(size);
    var ang = resolve(def.angle);
    if (def.tipAt) {   // 直接指定杖尖（寶珠）的位置：頁尾的魔杖揮動
      var tp = def.tipAt();
      if (!tp) return null;
      var ta = ang * Math.PI / 180, reachT = len * (orbY / L);
      return { x: tp[0] - Math.cos(ta) * reachT, y: tp[1] + Math.sin(ta) * reachT, ang: ang, len: len };
    }
    if (def.at) {   // 固定在畫面上的某一點（載入畫面）
      var at = resolve(def.at);
      return { x: at[0] * W, y: at[1] * H, ang: ang, len: len };
    }
    var el = resolveEl(def);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var anchor = resolve(def.anchor) || [0.5, 0.5];
    var rx = r.left + r.width * anchor[0];
    var ry = r.top + r.height * anchor[1];

    // 目標還不在畫面上（捲動中、沒有東西可以指）：權杖回到畫面中央，直立慢慢自轉
    // 滯後：離開要超出 60px，回來要真的進入畫面，才不會在邊緣抖動
    var off = wasTravel ? (ry < 10 || ry > H - 10) : (ry < -60 || ry > H + 60);
    wasTravel = off;
    if (off) {
      return { x: W * 0.5, y: H * 0.5, ang: 90, len: lenFor(0.46), travel: true };
    }

    var tx = Math.max(24, Math.min(W - 24, rx));
    var ty = Math.max(24, Math.min(H - 24, ry));
    var a = ang * Math.PI / 180;
    var dx = Math.cos(a), dy = -Math.sin(a);                 // 螢幕座標（y 向下）
    var tipLen = len * (tipY / L);                            // 中心到月牙尖端
    // dock: "orb"  → 寶珠中心落在目標上
    //       "tail" → 權杖底端立在目標上（頁尾：權杖站進「1」的位置）
    var reach = def.dock === "orb" ? len * (orbY / L) : def.dock === "tail" ? -len * ((L - tipY) / L) : tipLen;
    var gap = (def.gap == null ? 18 : def.gap) + reach;
    var x = tx - dx * gap, y = ty - dy * gap;

    // 保險：月牙（權杖頭）一定留在畫面內
    if (def.dock !== "tail") {
      var hx = x + dx * (tipLen - len * 0.1), hy = y + dy * (tipLen - len * 0.1);
      var m = len * 0.1;
      x += Math.max(m - hx, 0) - Math.max(hx - (W - m), 0);
      y += Math.max(m - hy, 0) - Math.max(hy - (H - m), 0);
    }
    return { x: x, y: y, ang: ang, len: len, el: el };
  }

  function angDelta(from, to) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  /* ---------- 平滑移動：臨界阻尼彈簧（慢慢起步、順順滑過去、輕輕停下） ---------- */
  var vel = { x: 0, y: 0, ang: 0, len: 0 };
  function damp(key, target, smoothTime, dt) {
    var omega = 2 / smoothTime;
    var x = omega * dt;
    var e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    var change = cur[key] - target;
    var temp = (vel[key] + omega * change) * dt;
    vel[key] = (vel[key] - omega * temp) * e;
    cur[key] = target + (change + temp) * e;
  }

  /* ---------- 每一格 ---------- */
  var last = performance.now();
  var t = 0;
  var shown = false;
  var lastMode = null, sinceMove = 0, prevD = null, isBehind = false;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0, now - last) / 1000);
    last = now;
    t += dt;
    if (!isReady || document.hidden) return;

    var d = desired();
    var mode = active + (d && d.travel ? ":travel" : "");
    if (mode !== lastMode) {
      // 離開原本停穩的位置 → 通知（例如頁尾熄燈），下次回來會重新觸發
      if (arrivedMode && arrivedMode === lastMode) {
        var leaving = arrivedMode.split(":")[0];
        departFns.forEach(function (fn) { fn(leaving); });
      }
      arrivedMode = null;
      lastMode = mode;
      sinceMove = 0;
      prevD = null;
    }
    sinceMove += dt;

    if (d) {
      // 同一個目標在捲動中移動：權杖跟著一起移動（不會落後），剩下的距離再用彈簧補上
      // 只有「同一個目標」在捲動中移動時才跟著一起移動；換目標（例如政綱換下一張卡片）就慢慢滑過去，不會瞬移
      if (prevD && !d.travel && prevD.el === d.el) {
        cur.x += d.x - prevD.x;
        cur.y += d.y - prevD.y;
        if (stops[active] && stops[active].follow) cur.ang += angDelta(prevD.ang, d.ang);   // 飛越時：角度也緊跟著路徑
      }
      prevD = { x: d.x, y: d.y, ang: d.ang, el: d.el };
      var st = d.travel ? 0.55 : (stops[active] && stops[active].follow ? 0.24 : 0.42);   // 越小越快；頁尾準備飛越時快一點
      damp("x", d.x, st, dt);
      damp("y", d.y, st, dt);
      var angTarget = cur.ang + angDelta(cur.ang, d.ang);
      damp("ang", angTarget, st * 1.1, dt);
    }
    damp("len", d ? d.len : 0, 0.45, dt);

    // 到達偵測：停穩在目標上 → 通知（例如頁尾：權杖站進「1」→ 點亮「請投 1 號」）
    var def = stops[active];
    var still = !!(def && def.still && d && !d.travel);
    if (d && !d.travel && sinceMove > 0.3 &&
        Math.abs(d.x - cur.x) < 3 && Math.abs(d.y - cur.y) < 3 && Math.abs(angDelta(cur.ang, d.ang)) < 1.5 &&
        Math.abs(vel.x) + Math.abs(vel.y) < 60) {
      if (arrivedMode !== mode) {
        arrivedMode = mode;
        docked = still;
        if (docked) flash = 2.5;
        arriveFns.forEach(function (fn) { fn(active); });
      }
    }
    if (arrivedMode !== mode) docked = false;

    // behind：權杖在文字後面（頁尾「請投 2 號」：數字在前，權杖插在後面）
    var behindNow = !!(def && def.behind && d && !d.travel);
    if (behindNow !== isBehind) { canvas.style.zIndex = behindNow ? "0" : ""; isBehind = behindNow; }

    var vis = cur.len > 2;
    if (vis !== shown) { canvas.style.visibility = vis ? "visible" : "hidden"; shown = vis; }
    if (!vis) return;

    // 位置 / 指向 / 大小：交給 GPU 合成（CSS transform）
    var a = cur.ang * Math.PI / 180;
    var bob = still ? 0 : Math.sin(t * 1.4) * 7;
    var sx = cur.x + Math.sin(a) * bob;
    var sy = cur.y + Math.cos(a) * bob;
    canvas.style.transform =
      "translate3d(" + (sx - cw / 2).toFixed(1) + "px," + (sy - ch / 2).toFixed(1) + "px,0) " +
      "rotate(" + (90 - cur.ang).toFixed(2) + "deg) scale(" + (cur.len / baseLen).toFixed(4) + ")";

    // 自轉 + 滑鼠傾斜 + 寶珠發光：WebGL
    var ease = 1 - Math.exp(-dt * 3);
    if (still) {
      // 插進插座：停止旋轉，轉回正面，寶珠亮起來
      spinVel *= Math.exp(-dt * 4);
      var full = Math.PI * 2;
      var targetRot = Math.round(spinner.rotation.y / full) * full;
      spinner.rotation.y += spinVel * dt + (targetRot - spinner.rotation.y) * ease;
      spinner.rotation.x += (0 - spinner.rotation.x) * ease;
    } else {
      var base = active === "loader" ? 0.9 : (d && d.travel ? 0.7 : 0.45);
      spinner.rotation.y += (base + spinVel) * dt;
      spinVel *= Math.exp(-dt * 1.5);
      spinner.rotation.x += ((mouseY * 0.5) - spinner.rotation.x) * ease;
    }
    flash *= Math.exp(-dt * 2.2);
    orbLight.intensity = ((docked ? 3 : 1.2) + Math.sin(t * 2.4) * 0.5 + flash * 6) * 3;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
