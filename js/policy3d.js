/* =========================================================
   政綱：3D 花田（three.js）
   整段是一個連續的鏡頭（桌面版）：
   撕開的藍色紙 → 往後倒變成天空（setPhase.look = 0：抬頭看天空，day = 1：白天的藍）
   → 天空慢慢變成星空（day → 0）→ 鏡頭往下看到一片空的草地（look → 1）
   → 芙莉蓮的「花田魔法」：一圈光從中間擴散，花一朵一朵開出來，海報從土裡升起（bloom 0 → 1）
   → 鏡頭俯衝進花田（swoop 0 → 1）→ 一張一張飛到海報前面（setProgress 0 → 1）
   → 最後停在問題卡片前面，鏡頭直直推進卡片裡（setZoom 1 → n，和 DOM 卡片的放大同步）

   Policy3D.init({ canvas, policies, question, footer }) → Promise
   Policy3D.start() / stop()        只有在這一段畫面上時才畫
   Policy3D.setPhase({ look, day, bloom, swoop })
   Policy3D.setProgress(p) / setZoom(s) / setQuestionVisible(bool)
   Policy3D.activeIndex()           0–3：現在看的是哪一張；4：問題卡片
   Policy3D.panelRect(i)            海報在畫面上的位置（權杖指向用）
   Policy3D.questionRect() / questionTextPx()   問題卡片最後在畫面上的位置和字的大小（交給 DOM 卡片對齊）
   ========================================================= */
(function () {
  var api = { ok: false };
  window.Policy3D = api;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.THREE || !THREE.GLTFLoader || !window.FLOWERS_GLB) return;
  (function () {
    try {
      var c = document.createElement("canvas");
      api.ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { api.ok = false; }
  })();
  if (!api.ok) return;

  var TAU = Math.PI * 2;
  var renderer, scene, camera, canvas, timeU = { value: 0 };
  var panels = [], qPanel = null, opts = null, started = false, raf = 0, last = 0, ready = false, wantRun = false, starsImg = null;
  var progress = 0, small = false;
  var ph = { look: 1, day: 0, bloom: 1, swoop: 1 }, zoomS = 1;       // 預設＝一般狀態（海報之間）
  var bloomU = { value: 999 }, bloomC = new THREE.Vector2(0, -8);     // 花田魔法：開花的半徑、中心
  var dayU = { value: 0 }, starsMat = null, moonMat = null, ring = null, qTextPx = 40;
  var AER = new THREE.Vector3(0, 18, 6);                              // 高空的鏡頭位置
  var tmpA = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function backOut(t) { var c1 = 1.7, c3 = c1 + 1; t -= 1; return 1 + c3 * t * t * t + c1 * t * t; }
  var PANEL_W = 1.7, PANEL_H = 2.55, PANEL_Y = 1.5, SPACING = 8.5;
  var KEYS = [], STOPS = [0, .18, .36, .54, .72, 1], HOLD = .035;
  var lin = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
  var FOG = "#6f9bd6";

  /* ---------------- 小工具 ---------------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
  function b64ToBuffer(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src || location.protocol === "file:") return resolve(null);   // file:// 的圖片不能放進 WebGL
      var im = new Image();
      im.decoding = "async";
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  /* ---------------- 海報（畫在 canvas 上，當作貼圖） ---------------- */
  var TW = 1024, TH = 1536;
  function tornEdge(g, w, h, seed) {
    // 上面是圓角，下面是撕過的紙邊
    var s = seed;
    function r() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
    var R = 26;
    g.beginPath();
    g.moveTo(R, 0); g.lineTo(w - R, 0); g.quadraticCurveTo(w, 0, w, R);
    g.lineTo(w, h - 40);
    var y = h - 40, x = w, drift = 0;
    while (x > 0) {
      x -= 10 + r() * 18;
      drift = drift * .6 + (r() - .5) * 22;
      var bite = r() < .12 ? r() * 26 : 0;
      y = h - 26 + drift - bite;
      g.lineTo(Math.max(0, x), Math.min(h - 2, Math.max(h - 80, y)));
    }
    g.lineTo(0, R); g.quadraticCurveTo(0, 0, R, 0);
    g.closePath();
  }
  function wrapTokens(text) {
    var out = [], m, re = /[A-Za-z0-9.@_\-]+|\s+|./g;
    while ((m = re.exec(text))) out.push(m[0]);
    return out;
  }
  function wrap(g, text, maxW) {
    var toks = wrapTokens(text), lines = [], line = "";
    var noStart = "，。、；：！？）」』》〉,.;:!?)";
    toks.forEach(function (t) {
      var test = line + t;
      if (g.measureText(test).width > maxW && line && noStart.indexOf(t[0]) < 0) {
        lines.push(line.trim());
        line = t.trim() ? t : "";
      } else line = test;
    });
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
  function paperGrain(g, w, h, a) {
    for (var i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < .5 ? "rgba(255,255,255," + a + ")" : "rgba(0,0,0," + a + ")";
      g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
  }

  function drawPolicy(p, i, total, img, footer, seed) {
    var cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    var g = cv.getContext("2d");
    g.save();
    tornEdge(g, TW, TH, seed);
    g.clip();
    // 紙的底色
    var bg = g.createLinearGradient(0, 0, 0, TH);
    bg.addColorStop(0, "#132646"); bg.addColorStop(1, "#0a1224");
    g.fillStyle = bg; g.fillRect(0, 0, TW, TH);
    // 圖片（上面 62%）
    var IH = TH * .62;
    if (img) {
      var fx = .5, fy = .4;
      if (p.focus) { var f = p.focus.split(/\s+/); fx = parseFloat(f[0]) / 100; fy = parseFloat(f[1]) / 100; }
      var sc = Math.max(TW / img.width, IH / img.height);
      var dw = img.width * sc, dh = img.height * sc;
      g.drawImage(img, (TW - dw) * fx, (IH - dh) * fy, dw, dh);
    }
    var fade = g.createLinearGradient(0, IH * .45, 0, IH + 40);
    fade.addColorStop(0, "rgba(10,16,36,0)"); fade.addColorStop(1, "rgba(10,18,36,1)");
    g.fillStyle = fade; g.fillRect(0, 0, TW, IH + 41);
    var top = g.createLinearGradient(0, 0, 0, 220);
    top.addColorStop(0, "rgba(8,14,30,.55)"); top.addColorStop(1, "rgba(8,14,30,0)");
    g.fillStyle = top; g.fillRect(0, 0, TW, 220);
    // 編號
    g.fillStyle = "#e6c98a";
    g.font = "italic 600 150px 'Cormorant Garamond', serif";
    g.textBaseline = "alphabetic";
    g.fillText(String(i + 1).padStart(2, "0"), 70, 190);
    g.font = "700 30px 'Chiron Hei HK', 'Noto Sans TC', sans-serif";
    g.fillStyle = "rgba(245,242,234,.75)";
    g.fillText("政見  ·  " + String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0"), 76, 244);
    // 標題 + 說明
    g.fillStyle = "#f5f2ea";
    g.font = "900 104px 'Chiron Hei HK', 'Noto Sans TC', sans-serif";
    var ty = IH + 60;
    wrap(g, p.title, TW - 150).forEach(function (ln) { g.fillText(ln, 72, ty); ty += 120; });
    g.fillStyle = "#e6c98a"; g.fillRect(74, ty - 70, 90, 5);
    g.font = "400 40px 'Chiron Hei HK', 'Noto Sans TC', sans-serif";
    g.fillStyle = "rgba(245,242,234,.86)";
    ty += 10;
    wrap(g, p.desc, TW - 150).slice(0, 6).forEach(function (ln) { g.fillText(ln, 72, ty); ty += 64; });
    // 最下面的小字（會被花擋住一點點，沒關係）
    g.font = "700 26px 'Chiron Hei HK', 'Noto Sans TC', sans-serif";
    g.fillStyle = "rgba(245,242,234,.5)";
    g.fillText(footer, 72, TH - 110);
    paperGrain(g, TW, TH, .035);
    g.restore();
    return cv;
  }

  // 問題卡片：要和 DOM 的 .platform__zoom 一開始的樣子一樣（交接時才看不出來）
  // 問題卡片：畫出和 DOM 的 .platform__zoom 一模一樣的樣子（背景、星星、字、金邊），交接的時候才看不出來
  // DOM 的背景是「整個畫面」的漸層 + 星星圖案，卡片只看到其中一塊 → 這裡用同樣的座標換算畫出那一塊
  function drawQuestion(q, rect, viewW, viewH, fontPx, stars) {
    var cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    var g = cv.getContext("2d");
    var sx = TW / rect.width, sy = TH / rect.height;
    var R = 18 * sy;
    function outline() {
      g.beginPath();
      g.moveTo(R, 0); g.lineTo(TW - R, 0); g.quadraticCurveTo(TW, 0, TW, R); g.lineTo(TW, TH - R);
      g.quadraticCurveTo(TW, TH, TW - R, TH); g.lineTo(R, TH); g.quadraticCurveTo(0, TH, 0, TH - R); g.lineTo(0, R);
      g.quadraticCurveTo(0, 0, R, 0); g.closePath();
    }
    outline();
    g.save(); g.clip();
    // 畫面座標 → 卡片貼圖座標
    g.save();
    g.scale(sx, sy);
    g.translate(-rect.left, -rect.top);
    g.fillStyle = "#0a1020";
    g.fillRect(rect.left, rect.top, rect.width, rect.height);
    // radial-gradient(120% 90% at 50% 38%, #1e3d72 0%, #122446 45%, #0a1020 100%)
    g.save();
    g.translate(viewW * .5, viewH * .38);
    g.scale(1, (viewH * .9) / (viewW * 1.2));
    var grd = g.createRadialGradient(0, 0, 0, 0, 0, viewW * 1.2);
    grd.addColorStop(0, "#1e3d72"); grd.addColorStop(.45, "#122446"); grd.addColorStop(1, "#0a1020");
    g.fillStyle = grd;
    g.fillRect(-viewW * 2, -viewW * 2, viewW * 4, viewW * 4);
    g.restore();
    if (stars) {
      g.fillStyle = g.createPattern(stars, "repeat");
      g.fillRect(rect.left, rect.top, rect.width, rect.height);
    }
    g.restore();
    g.fillStyle = "#f5f2ea";
    g.textAlign = "center"; g.textBaseline = "middle";
    var fs = fontPx * sy;
    g.font = "900 " + fs + "px 'Chiron Hei HK', 'Noto Sans TC', sans-serif";
    var lines = q.lines, lh = fs * 1.2, y = TH / 2 - (lines.length - 1) * lh / 2 + (q.offsetY || 0) * sy;
    lines.forEach(function (ln) { g.fillText(ln, TW / 2, y); y += lh; });
    g.restore();
    // 金色細邊框（和 DOM 的 rim 一樣）
    outline();
    g.lineWidth = 2.6 * sy;
    g.strokeStyle = "rgba(230,201,138,.9)";
    g.stroke();
    return cv;
  }

  /* 問題卡片：整張都在 shader 裡畫（夜空漸層、會視差的星星、撕紙邊），字是另外一張高解析度的貼圖
     → 推進去就只是鏡頭往前走，不用放大任何 DOM 元素（大面積放大會讓整個畫面閃） */
  var qU = null;
  function drawQuestionText(q) {
    var W = 1536, H = 2304;   // 和卡片一樣 2:3
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    var font = function (px) { return "900 " + px + "px 'Chiron Hei HK', 'Noto Sans TC', sans-serif"; };
    // 用「看得到的筆畫」來量（不是字框）：最寬的一行 = 卡片寬度的 76%
    g.font = font(100);
    var wmax = 1;
    q.lines.forEach(function (ln) { var m = g.measureText(ln); wmax = Math.max(wmax, m.actualBoundingBoxLeft + m.actualBoundingBoxRight); });
    var px = 100 * W * .76 / wmax;
    g.font = font(px);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    var lh = px * 1.24;
    var ms = q.lines.map(function (ln) { return g.measureText(ln); });
    // 整塊字的上下緣（筆畫）→ 放在卡片正中間
    var top = -ms[0].actualBoundingBoxAscent, bot = (q.lines.length - 1) * lh + ms[ms.length - 1].actualBoundingBoxDescent;
    var y0 = H / 2 - (top + bot) / 2;
    g.fillStyle = "#fff";
    q.lines.forEach(function (ln, i) {
      var m = ms[i];
      // 每一行用筆畫置中（「，」「？」的字框很空，用字框置中會看起來歪一邊）
      var x = W / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      g.fillText(ln, x, y0 + i * lh);
    });
    return cv;
  }
  function makeQuestionMesh(q) {
    var t = new THREE.CanvasTexture(drawQuestionText(q));
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.minFilter = THREE.LinearMipmapLinearFilter;
    qU = {
      uTxt: { value: t }, uTear: { value: 0 }, uTextA: { value: 1 }, uZoom: { value: 1 },
      uTime: timeU, uSize: { value: new THREE.Vector2(PANEL_W, PANEL_H) }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: qU, transparent: true,
      extensions: { derivatives: true },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform sampler2D uTxt; uniform float uTear, uTextA, uZoom, uTime; uniform vec2 uSize; varying vec2 vUv;",
        "float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }",
        "float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }",
        "float f1(float x){ return .5 * n1(x) + .3 * n1(x * 2.3 + 7.0) + .2 * n1(x * 5.1 + 3.0); }",
        "vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }",
        "float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
        "  float a = h22(i).x, b = h22(i + vec2(1.0, 0.0)).x, c = h22(i + vec2(0.0, 1.0)).x, d = h22(i + vec2(1.0, 1.0)).x;",
        "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }",
        // 一層星星：越遠的層放大得越少 → 視差
        "float stars(vec2 p, float dens, float sz, float seed){",
        "  vec2 c = floor(p), f = fract(p); vec2 r = h22(c + seed);",
        "  if (r.x > dens) return 0.0;",
        "  vec2 sp = .2 + .6 * h22(c + seed + 3.7); float d = length(f - sp);",
        "  float tw = .65 + .35 * sin(uTime * (1.2 + r.y * 2.5) + r.x * 60.0);",
        "  return (smoothstep(sz, 0.0, d) + smoothstep(sz * 4.0, 0.0, d) * .18) * tw * (.55 + .45 * r.y); }",
        "void main(){",
        "  vec2 P = (vUv - .5) * uSize, hs = uSize * .5;",
        // 撕之前：圓角卡片
        "  float rad = .075; vec2 q = abs(P) - (hs - rad);",
        "  float m0 = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad);",
        // 撕之後：四邊各自被撕掉一點（沿著邊緣起伏，偶爾咬得比較深）
        "  float A = .05;",
        "  float eL = A * (f1(P.y * 11.0 + 1.3) + .9 * pow(n1(P.y * 3.1 + 9.0), 6.0));",
        "  float eR = A * (f1(P.y * 11.0 + 21.7) + .9 * pow(n1(P.y * 3.1 + 2.0), 6.0));",
        "  float eB = A * (f1(P.x * 11.0 + 41.1) + .9 * pow(n1(P.x * 3.1 + 5.0), 6.0));",
        "  float eT = A * (f1(P.x * 11.0 + 61.9) + .9 * pow(n1(P.x * 3.1 + 7.0), 6.0));",
        "  float mT = min(min(P.x + hs.x - eL, hs.x - P.x - eR), min(P.y + hs.y - eB, hs.y - P.y - eT));",
        "  float m = mix(m0, mT, uTear);",
        // 邊：撕之前是細金邊，撕開之後變成寬窄不一的白色紙纖維
        "  float fib = mix(.011, .012 + .03 * f1((P.x - P.y) * 17.0), uTear);",
        "  float aa = fwidth(m) * 1.3;",
        "  float inside = smoothstep(0.0, aa, m);",
        "  if (inside <= 0.0) discard;",
        "  float card = smoothstep(fib, fib + aa, m);",
        // 夜空漸層（和願望區一樣的顏色）
        "  vec2 g = (P - vec2(0.0, hs.y * .24)) / vec2(uSize.x * 1.2, uSize.y * .9);",
        "  float t = clamp(length(g) * 2.0, 0.0, 1.0);",
        "  vec3 c0 = vec3(.118, .239, .447), c1 = vec3(.071, .141, .275), c2 = vec3(.039, .063, .125);",
        "  vec3 col = t < .45 ? mix(c0, c1, t / .45) : mix(c1, c2, (t - .45) / .55);",
        // 淡淡的魔力雲
        "  vec2 pn = P * pow(uZoom, .6);",
        "  float neb = n2(pn * 2.2 + 3.0) * .6 + n2(pn * 5.0) * .4;",
        "  col += vec3(.16, .32, .55) * smoothstep(.45, .95, neb) * .22;",
        // 三層星星：推進去的時候像穿過一片星空
        "  float s = 0.0;",
        "  s += stars(P * pow(uZoom, .25) * 9.0, .34, .09, 1.0);",
        "  s += stars(P * pow(uZoom, .55) * 15.0, .30, .08, 7.0) * .8;",
        "  s += stars(P * pow(uZoom, .85) * 26.0, .26, .07, 13.0) * .6;",
        "  col += vec3(.86, .92, 1.0) * s;",
        // 字
        "  float ta = texture2D(uTxt, vUv).a * uTextA;",
        "  col = mix(col, vec3(.965, .953, .925), ta);",
        "  vec3 rim = mix(vec3(.902, .788, .541), vec3(.937, .910, .863), uTear);",
        "  col = mix(rim, col, card);",
        "  gl_FragColor = vec4(col, inside * mix(.92, 1.0, card));",
        "}"
      ].join("\n")
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), mat);
  }

  function texture(cv) {
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function maskFrom(cv) {   // 背面也要有撕過的形狀
    var m = document.createElement("canvas");
    m.width = 256; m.height = 384;
    var g = m.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 384);
    g.globalCompositeOperation = "source-over";
    g.drawImage(cv, 0, 0, 256, 384);
    var d = g.getImageData(0, 0, 256, 384);
    for (var i = 0; i < d.data.length; i += 4) {
      var a = d.data[i + 3] > 128 ? 255 : 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = a; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return new THREE.CanvasTexture(m);
  }
  function panelGeometry(bend) {
    var geo = new THREE.PlaneGeometry(PANEL_W, PANEL_H, 18, 26);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), u = x / (PANEL_W / 2), v = y / PANEL_H + .5;
      pos.setZ(i, bend * (1 - u * u) + .018 * Math.sin(v * 5 + u * 2) * (1 - v) );
    }
    geo.computeVertexNormals();
    return geo;
  }
  function makePanel(cv, pos, yaw, bend) {
    var geo = panelGeometry(bend);
    var front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture(cv), alphaTest: .5, side: THREE.FrontSide }));
    var back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: lin("#b9b2a4"), alphaMap: maskFrom(cv), alphaTest: .5, side: THREE.BackSide }));
    var grp = new THREE.Group();
    grp.add(front, back);
    grp.position.copy(pos);
    grp.rotation.set(-.03, yaw, 0);
    scene.add(grp);
    return { group: grp, front: front, pos: pos.clone(), yaw: yaw };
  }

  /* ---------------- 天空、地面、花 ---------------- */
  function buildSky() {
    var sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        cTop: { value: new THREE.Color("#050a17") }, cMid: { value: new THREE.Color("#12285a") },
        cHor: { value: new THREE.Color("#4f86cf") }, cGlow: { value: new THREE.Color("#a8d2f6") }, cFog: { value: new THREE.Color(FOG) },
        // 白天：和撕開的那張藍紙一樣的藍
        dHor: { value: new THREE.Color("#9ccaf3") }, dMid: { value: new THREE.Color("#5b9be0") }, dTop: { value: new THREE.Color("#3a74c2") },
        uDay: dayU
      },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 cTop, cMid, cHor, cGlow, cFog, dHor, dMid, dTop; uniform float uDay; varying vec3 vP;" +
        "void main(){ float h = normalize(vP).y;" +
        " vec3 c = mix(cFog, cGlow, smoothstep(-0.005, 0.025, h));" +
        " c = mix(c, cHor, smoothstep(0.02, 0.09, h));" +
        " c = mix(c, cMid, smoothstep(0.06, 0.3, h));" +
        " c = mix(c, cTop, smoothstep(0.3, 0.8, h));" +
        " vec3 d = mix(dHor, dMid, smoothstep(0.0, 0.35, h));" +
        " d = mix(d, dTop, smoothstep(0.35, 0.95, h));" +
        " gl_FragColor = vec4(mix(c, d, uDay), 1.0); }"
    }));
    sky.renderOrder = -2;
    scene.add(sky);
    // 星星（不會動）
    var n = small ? 350 : 700, arr = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, e = Math.asin(rnd(.12, .98)), r = 180;
      arr[i * 3] = Math.cos(a) * Math.cos(e) * r; arr[i * 3 + 1] = Math.sin(e) * r; arr[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: .75, fog: false, depthWrite: false });
    var stars = new THREE.Points(sg, starsMat);
    stars.renderOrder = -1;
    scene.add(stars);
    // 月亮
    var mc = document.createElement("canvas"); mc.width = mc.height = 256;
    var mg = mc.getContext("2d");
    var halo = mg.createRadialGradient(128, 128, 30, 128, 128, 128);
    halo.addColorStop(0, "rgba(220,235,255,.35)"); halo.addColorStop(1, "rgba(220,235,255,0)");
    mg.fillStyle = halo; mg.fillRect(0, 0, 256, 256);
    var disc = mg.createRadialGradient(118, 118, 4, 128, 128, 44);
    disc.addColorStop(0, "#fffdf4"); disc.addColorStop(1, "#dfe6f2");
    mg.fillStyle = disc; mg.beginPath(); mg.arc(128, 128, 42, 0, TAU); mg.fill();
    moonMat = new THREE.SpriteMaterial({ map: texture(mc), fog: false, depthWrite: false, transparent: true });
    var moon = new THREE.Sprite(moonMat);
    moon.scale.set(26, 26, 1);
    moon.position.set(52, 58, -150);
    moon.renderOrder = -1;
    scene.add(moon);
    return [sky, stars, moon];
  }

  function buildGround() {
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#1b3a26"; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 1800; i++) {
      g.fillStyle = Math.random() < .5 ? "rgba(90,140,80,.18)" : "rgba(5,15,10,.25)";
      g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, rnd(1, 5), 0, TAU); g.fill();
    }
    var t = texture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: t }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
  }

  function windMaterial(grows) {
    var m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (grows) m.defines = { GROWS: 1 };
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = timeU;
      shader.uniforms.uBloom = bloomU;
      shader.uniforms.uBloomC = { value: bloomC };
      shader.vertexShader = "uniform float uTime;\nuniform float uBloom;\nuniform vec2 uBloomC;\n" + shader.vertexShader.replace("#include <begin_vertex>", [
        "#include <begin_vertex>",
        "#ifdef USE_INSTANCING",
        "  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);",
        "#else",
        "  vec3 ip = vec3(0.0);",
        "#endif",
        "#ifdef GROWS",
        // 花田魔法：開花的前緣經過的時候，花從地上長出來（稍微彈一下）
        "  float bb = clamp((uBloom - length(ip.xz - uBloomC)) / 5.0, 0.0, 1.0);",
        "  float bm = bb - 1.0;",
        "  transformed *= max(1.0 + 2.7 * bm * bm * bm + 1.7 * bm * bm, 0.0);",
        "#endif",
        "float hgt = max(transformed.y, 0.0);",
        "float wv = sin(uTime * 1.5 + ip.x * 0.45 + ip.z * 0.3) + 0.45 * sin(uTime * 2.6 + ip.z * 0.9 + ip.x * 0.2);",
        "transformed.x += wv * 0.32 * hgt * hgt;",
        "transformed.z += wv * 0.18 * hgt * hgt;"
      ].join("\n"));
    };
    return m;
  }

  // 地上擴散的那一圈光
  // 開花的前緣：地上一條細細的光線（寬度固定，不管圈多大），後面拖一點點淡淡的光
  var ringU = { uR: { value: 0 }, uOp: { value: 0 }, uC: { value: new THREE.Vector2() } };
  function makeRing() {
    ringU.uC.value.copy(bloomC);
    var mat = new THREE.ShaderMaterial({
      uniforms: ringU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: "varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: [
        "uniform float uR, uOp; uniform vec2 uC; varying vec2 vP;",
        "void main(){",
        "  vec2 q = vP - uC; float d = length(q), x = d - uR;",
        "  float line = exp(-x * x / .045);",                              // 細線（約 0.4 單位寬）
        "  float trail = x < 0.0 ? exp(x / 1.6) * .16 : 0.0;",            // 線後面淡淡的光
        "  float a = atan(q.y, q.x);",
        "  float flick = .75 + .25 * sin(a * 23.0 + uR * .9) * sin(a * 7.0 - uR * .5);",
        "  float v = (line * flick + trail) * uOp;",
        "  gl_FragColor = vec4(vec3(.72, .87, 1.0) * v, v);",
        "}"
      ].join("\n")
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(bloomC.x, .05, bloomC.y);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  var clearBoxes = [];
  function blocked(x, z) {
    for (var i = 0; i < clearBoxes.length; i++) {
      var b = clearBoxes[i];
      if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return true;
    }
    return false;
  }
  function scatter(geo, count, clusterShare, spread, scaleRange, grows) {
    var mesh = new THREE.InstancedMesh(geo, windMaterial(grows), count);
    mesh.frustumCulled = false;
    var centers = [];
    for (var c = 0; c < 9; c++) centers.push([rnd(-11, 11), rnd(6, -58)]);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    for (var i = 0; i < count; i++) {
      var x, z, tries = 0;
      do {
        if (Math.random() < clusterShare) {
          var cc = centers[(Math.random() * centers.length) | 0];
          x = cc[0] + gauss() * spread; z = cc[1] + gauss() * spread * 1.4;
        } else { x = rnd(-14, 14); z = rnd(9, -62); }
        tries++;
      } while ((blocked(x, z) || (Math.abs(x) > 8 && Math.random() < .5)) && tries < 12);
      e.set(rnd(-.12, .12), rnd(0, TAU), rnd(-.12, .12));
      q.setFromEuler(e);
      var sc = rnd(scaleRange[0], scaleRange[1]);
      s.set(sc, sc * rnd(.9, 1.12), sc);
      p.set(x, rnd(-.03, 0), z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      var br = rnd(.82, 1.08);
      mesh.setColorAt(i, col.setRGB(br, br, br));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  }

  /* ---------------- 鏡頭路徑 ---------------- */
  function fitDist() {
    var tv = Math.tan(camera.fov * Math.PI / 360), th = tv * camera.aspect;
    var dH = (PANEL_H / 2) / (tv * (small ? .7 : .62));
    var dW = (PANEL_W / 2) / (th * .84);
    return Math.max(dH, dW);
  }
  function computeKeys() {
    var d = fitDist();
    KEYS = [{ pos: new THREE.Vector3(0, 3.6, 9), look: new THREE.Vector3(0, .9, -16) }];
    panels.concat([qPanel]).forEach(function (pn) {
      var n = new THREE.Vector3(Math.sin(pn.yaw), 0, Math.cos(pn.yaw));
      KEYS.push({ pos: pn.pos.clone().addScaledVector(n, d).add(new THREE.Vector3(0, .02, 0)), look: pn.pos.clone() });
    });
  }
  var tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  function cameraAt(p, out, look) {
    var k = 0;
    while (k < STOPS.length - 2 && p > STOPS[k + 1]) k++;
    var a = STOPS[k], b = STOPS[k + 1];
    var t = smooth((p - a - (k ? HOLD : 0)) / Math.max(1e-4, (b - a) - (k ? HOLD : 0) - HOLD));
    var A = KEYS[k], B = KEYS[k + 1];
    out.lerpVectors(A.pos, B.pos, t);
    out.y += Math.sin(t * Math.PI) * (k ? .35 : 0);          // 在兩張海報之間稍微抬高一點，像飄過去
    look.lerpVectors(A.look, B.look, smooth(t * 1.15));
  }
  function applyCamera(time) {
    cameraAt(progress, tmpPos, tmpLook);
    if (ph.swoop < 1) {
      // 高空：先抬頭看天空（+62°），再慢慢往下看花田（-52°），然後俯衝到第一個位置
      var pitch = (62 - 114 * smooth(ph.look)) * Math.PI / 180;
      tmpA.set(AER.x, AER.y + Math.sin(pitch) * 20, AER.z - Math.cos(pitch) * 20);
      var u = smooth(ph.swoop);
      tmpPos.lerpVectors(AER, tmpPos, u);
      tmpLook.lerpVectors(tmpA, tmpLook, u);
    }
    var bob = Math.sin(time * .7) * .012;
    if (zoomS > 1) {
      // 推進問題卡片：鏡頭沿著視線往卡片前進，卡片在畫面上的大小剛好變成 zoomS 倍
      var qk = KEYS[KEYS.length - 1];
      tmpPos.copy(qk.look).add(tmpD.subVectors(qk.pos, qk.look).multiplyScalar(1 / zoomS));
      tmpLook.copy(qk.look);
      bob = 0;
    }
    camera.position.copy(tmpPos);
    camera.position.y += bob;
    camera.lookAt(tmpLook);
  }

  /* ---------------- 投影到畫面 ---------------- */
  var corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function rectOf(group, cam, local) {   // local = true：相對於 canvas 本身（不管現在捲到哪裡）
    var W = canvas.clientWidth, H = canvas.clientHeight, r = local ? { left: 0, top: 0 } : canvas.getBoundingClientRect();
    group.updateMatrixWorld();
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c, i) {
      corners[i].set(c[0] * PANEL_W / 2, c[1] * PANEL_H / 2, 0).applyMatrix4(group.matrixWorld).project(cam);
      var x = (corners[i].x * .5 + .5) * W, y = (-corners[i].y * .5 + .5) * H;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
    return { left: r.left + minX, top: r.top + minY, width: maxX - minX, height: maxY - minY, right: r.left + maxX, bottom: r.top + maxY };
  }

  /* ---------------- 公開的 API ---------------- */
  api.init = function (o) {
    opts = o;
    canvas = o.canvas;
    small = window.innerWidth < 900;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    } catch (e) { api.ok = false; return Promise.reject(e); }
    prMax = pr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.25);
    renderer.setPixelRatio(pr);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    scene = new THREE.Scene();
    // 霧的顏色＝天空地平線的顏色（three r147 的霧是在轉成 sRGB 之後才加上去的，所以這裡不用轉換）
    scene.fog = new THREE.Fog(new THREE.Color(FOG), 14, 64);
    camera = new THREE.PerspectiveCamera(small ? 50 : 40, 1, .05, 450);
    scene.add(new THREE.HemisphereLight(lin("#c8dcff"), lin("#20321f"), .95));
    var moonLight = new THREE.DirectionalLight(lin("#e6eeff"), .55);
    moonLight.position.set(6, 10, 4);
    scene.add(moonLight);

    var skyParts = buildSky();
    buildGround();

    // 海報的位置
    var xo = small ? 1.05 : 1.9;
    var poss = [];
    for (var i = 0; i < 4; i++) poss.push(new THREE.Vector3((i % 2 ? 1 : -1) * xo, PANEL_Y, -6 - i * SPACING));
    var qPos = new THREE.Vector3(0, PANEL_Y, -6 - 4 * SPACING - 3);
    poss.concat([qPos]).forEach(function (p) { clearBoxes.push({ x: p.x, z: p.z, hw: PANEL_W / 2 + .05, hd: .28 }); });
    clearBoxes.push({ x: qPos.x, z: qPos.z + 2.4, hw: PANEL_W / 2 + .5, hd: 2.5 });   // 問題卡片前面留一條小路，鏡頭推進去時不會穿過花
    ring = makeRing();

    // 花
    var loaderDone = new Promise(function (resolve) {
      new THREE.GLTFLoader().parse(b64ToBuffer(window.FLOWERS_GLB), "", function (gltf) {
        var geos = {};
        gltf.scene.traverse(function (o) { if (o.isMesh) geos[o.name] = o.geometry; });
        var k = small ? .45 : 1;
        if (geos.grass) scatter(geos.grass, Math.round(5200 * k), .2, 4, [.9, 1.4]);
        if (geos.moonweed) scatter(geos.moonweed, Math.round(1500 * k), .6, 3.2, [.9, 1.3], true);
        if (geos.daisy) scatter(geos.daisy, Math.round(1000 * k), .6, 2.6, [.9, 1.25], true);
        if (geos.cosmos) scatter(geos.cosmos, Math.round(700 * k), .55, 2.4, [.85, 1.2], true);
        if (geos.bell) scatter(geos.bell, Math.round(700 * k), .6, 2.2, [.9, 1.25], true);
        resolve();
      }, function () { resolve(); });
    });

    // 字型載入之後才能畫海報
    var allText = o.policies.map(function (p) { return p.title + p.desc; }).join("") + o.question.lines.join("") + o.footer + "政見0123456789/·";
    var fontsReady = document.fonts ? Promise.all([
      document.fonts.load("900 100px 'Chiron Hei HK'", allText),
      document.fonts.load("400 40px 'Chiron Hei HK'", allText),
      document.fonts.load("700 30px 'Chiron Hei HK'", allText),
      document.fonts.load("italic 600 150px 'Cormorant Garamond'", "0123456789")
    ]).catch(function () {}) : Promise.resolve();
    var imgs = Promise.all(o.policies.map(function (p) { return loadImage(p.image); }));
    // 頁面用的星星圖案（CSS 變數 --stars 裡的 SVG），問題卡片要用一樣的
    var starsReady = new Promise(function (resolve) {
      var m = /url\(\s*"([^"]+)"\s*\)/.exec(getComputedStyle(document.documentElement).getPropertyValue("--stars") || "");
      if (!m) return resolve(null);
      var im = new Image();
      im.onload = function () { starsImg = im; resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = m[1];
    });

    return Promise.all([fontsReady, imgs, loaderDone, starsReady]).then(function (res) {
      var images = res[1];
      o.policies.slice(0, 4).forEach(function (p, i) {
        var cv = drawPolicy(p, i, o.policies.length, images[i], o.footer, 1234 + i * 77);
        var yaw = (i % 2 ? -1 : 1) * .3;
        var pn = makePanel(cv, poss[i], yaw, .07);
        pn.key = "panel" + i;
        panels.push(pn);
      });
      qPanel = { pos: qPos.clone(), yaw: 0, group: null, key: "q" };
      api.resize();
      renderer.compile(scene, camera);
      ready = true;
      if (wantRun) api.start();   // 段落在初始化完成前就已經在畫面上了
      return api;
    });
  };

  api.resize = function () {
    if (!renderer) return;
    var W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    computeKeys();
    // 問題卡片：依照最後的鏡頭位置，算出它在畫面上的大小，再畫出和 DOM 一樣的樣子
    var qCam = camera.clone();
    qCam.position.copy(KEYS[KEYS.length - 1].pos);
    qCam.lookAt(KEYS[KEYS.length - 1].look);
    qCam.updateMatrixWorld();
    if (!qPanel.group) {
      qPanel.group = new THREE.Group();
      qPanel.group.position.copy(qPanel.pos);
      scene.add(qPanel.group);
    }
    var y0 = qPanel.group.position.y;
    qPanel.group.position.y = PANEL_Y;                 // 用「升起之後」的位置來算
    var rect = rectOf(qPanel.group, qCam, true);
    qPanel.group.position.y = y0;
    api._qRect = rect;
    if (!qPanel.mesh) {
      qPanel.mesh = makeQuestionMesh(opts.question);
      qPanel.group.add(qPanel.mesh);
    }
    updateWorld();
    applyCamera(timeU.value);
    renderer.render(scene, camera);
  };

  api.setProgress = function (p) { progress = Math.max(0, Math.min(1, p)); };
  api.activeIndex = function () {
    var best = 0, bd = 1e9;
    for (var k = 1; k < STOPS.length; k++) { var dd = Math.abs(progress - STOPS[k]); if (dd < bd) { bd = dd; best = k - 1; } }
    return best;
  };
  api.stopAt = function (i) { return STOPS[i + 1]; };   // 第 i 張海報（或問題卡片 i = 4）正對鏡頭時的 progress
  api.panelRect = function (i) {   // i = 0–3：海報；i = 4：問題卡片
    var pn = i < panels.length ? panels[i] : qPanel;
    if (!pn || !camera) return null;
    var r = rectOf(pn.group, camera);
    r.key = pn.key;
    return r;
  };
  api.questionRect = function () { return api._qRect; };
  api.questionTextPx = function () { return qTextPx; };
  api.setPhase = function (o) { for (var k in o) ph[k] = Math.max(0, Math.min(1, o[k])); };
  api.setZoom = function (z) { zoomS = Math.max(1, z); if (qU) qU.uZoom.value = zoomS; };
  api.setCard = function (o) {   // tear：0 → 1 紙邊撕開；text：字的不透明度
    if (!qU) return;
    if (o.tear != null) qU.uTear.value = Math.max(0, Math.min(1, o.tear));
    if (o.text != null) qU.uTextA.value = Math.max(0, Math.min(1, o.text));
  };
  api.setQuestionVisible = function (v) { if (qPanel && qPanel.mesh) qPanel.mesh.visible = !!v; };

  // 用 GSAP 的 ticker 畫（捲動的時間軸更新完之後才畫）→ 3D 畫面和 DOM 卡片同一格更新，不會差一格而抖動
  var useTicker = !!(window.gsap && gsap.ticker);
  function tick() { frame(performance.now()); }
  function frame(now) {
    if (!useTicker) raf = requestAnimationFrame(frame);
    var raw = Math.max(0, now - last);
    var dt = Math.min(.05, raw / 1000);
    last = now;
    adapt(raw);
    timeU.value += dt;
    updateWorld();
    applyCamera(timeU.value);
    renderer.render(scene, camera);
  }
  // 畫面太慢的時候自動降一點解析度（掉格比稍微糊一點更難看），順的時候再慢慢升回去
  var prMax = 1, pr = 1, ema = 16, slow = 0, fast = 0;
  function adapt(ms) {
    if (ms <= 0 || ms > 250) return;          // 分頁在背景、剛開始畫
    ema += (ms - ema) * .08;
    if (ema > 21) { slow++; fast = 0; } else if (ema < 13) { fast++; slow = 0; } else { slow = fast = 0; }
    if (slow > 40 && pr > .7) { pr = Math.max(.7, pr - .15); renderer.setPixelRatio(pr); slow = 0; ema = 16; }
    else if (fast > 240 && pr < prMax) { pr = Math.min(prMax, pr + .1); renderer.setPixelRatio(pr); fast = 0; }
  }
  function updateWorld() {
    var R = ph.bloom * 72;
    bloomU.value = ph.bloom >= 1 ? 999 : R;
    dayU.value = ph.day;
    if (starsMat) starsMat.opacity = .75 * (1 - ph.day);
    if (moonMat) moonMat.opacity = Math.max(0, Math.min(1, (.55 - ph.day) / .45));   // 天真的黑了才出現
    if (ring) {
      ringU.uR.value = R;
      ringU.uOp.value = ph.bloom > 0 && ph.bloom < 1 ? Math.min(1, ph.bloom * 14) * Math.pow(1 - ph.bloom, .6) * .9 : 0;
      ring.visible = ringU.uOp.value > .001;
    }
    // 海報從土裡升起（開花的前緣經過的時候）
    panels.concat(qPanel && qPanel.group ? [qPanel] : []).forEach(function (pn) {
      var d = Math.hypot(pn.pos.x - bloomC.x, pn.pos.z - bloomC.y);
      var rb = ph.bloom >= 1 ? 1 : Math.max(0, Math.min(1, (R - d) / 6));
      pn.group.position.y = PANEL_Y - (1 - backOut(rb)) * (PANEL_Y + PANEL_H / 2 + .3);
    });
  }
  api.start = function () {
    wantRun = true;
    if (started || !ready) return;
    started = true;
    last = performance.now();
    if (useTicker) gsap.ticker.add(tick); else raf = requestAnimationFrame(frame);
  };
  api.stop = function () {
    wantRun = false;
    started = false;
    if (useTicker) gsap.ticker.remove(tick); else cancelAnimationFrame(raf);
  };
})();
