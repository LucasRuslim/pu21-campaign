/* =========================================================
   主程式：填入內容、載入畫面、轉場、捲動動畫、權杖指引
   文字內容請到 js/config.js 修改
   ========================================================= */
(function () {
  var C = window.SITE_CONFIG || {};
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var animate = hasGsap && !reduceMotion;
  var Staff = window.Staff || { ok: false };
  var guide = animate && Staff.ok;
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });   // 手機網址列收合時不要重新計算（會讓畫面跳動）
  }
  if (animate) document.documentElement.classList.add("fx");

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var isDesktop = function () { return window.innerWidth > 900; };
  function get(path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, C);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* =======================================================
     1. 把 config 內容填進頁面
     ======================================================= */
  if (C.accent) document.documentElement.style.setProperty("--mana", C.accent);

  $$("[data-bind]").forEach(function (n) {
    var v = get(n.getAttribute("data-bind"));
    if (v != null) n.textContent = v;
  });
  $$("[data-bind-src]").forEach(function (img) {
    var v = get(img.getAttribute("data-bind-src"));
    if (v) img.src = v;
  });
  $$("[data-bind-alt]").forEach(function (img) {
    var key = img.getAttribute("data-bind-alt");
    var role = key === "president" ? "會長候選人" : "副會長候選人";
    img.alt = role + " " + (get(key + ".name") || "");
  });

  // 候選人：畫面底部巨大的名字（兩份一樣的內容 → 可以無限循環）；名字是實心字，職稱是空心字
  $$("[data-marquee]").forEach(function (track) {
    var key = track.getAttribute("data-marquee");
    var name = get(key + ".name"), role = key === "president" ? "你的會長" : "你的副會長";
    for (var hlf = 0; hlf < 2; hlf++) {
      var half = el("span", "slide__half");
      for (var r = 0; r < 2; r++) {
        half.appendChild(el("span", "w-solid", name));
        half.appendChild(el("span", "sep", "✦"));
        half.appendChild(el("span", "w-line", role));
        half.appendChild(el("span", "sep", "✦"));
      }
      track.appendChild(half);
    }
  });

  // 候選人的 Instagram
  $$("[data-ig]").forEach(function (a) {
    var handle = get(a.getAttribute("data-ig") + ".instagram");
    if (!handle) { a.remove(); return; }
    a.href = "https://www.instagram.com/" + handle + "/";
    a.textContent = "Instagram @" + handle;
  });

  $$("[data-points]").forEach(function (list) {
    (get(list.getAttribute("data-points") + ".points") || []).forEach(function (p) {
      var li = el("li");
      li.appendChild(el("h3", null, p.title));
      li.appendChild(el("p", null, p.desc));
      var rule = el("span", "rule");
      rule.setAttribute("aria-hidden", "true");
      li.appendChild(rule);
      list.appendChild(li);
    });
  });

  var facts = $("#facts");
  (C.facts || []).forEach(function (f) {
    var li = el("li");
    li.appendChild(el("span", "fact__num", f.num));
    li.appendChild(el("span", "fact__label", f.label));
    facts.appendChild(li);
  });

  var track = $("#platformTrack");
  (C.platform || []).forEach(function (p, i) {
    var li = el("li", "platform__card" + (p.image ? " has-img" : ""));
    if (p.image) {
      var img = el("img", "platform__img");
      img.src = p.image;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (p.focus) img.style.objectPosition = p.focus;
      li.appendChild(img);
    }
    li.appendChild(el("span", "platform__num", String(i + 1).padStart(2, "0")));
    var body = el("div");
    body.appendChild(el("h3", null, p.title));
    body.appendChild(el("p", null, p.desc));
    li.appendChild(body);
    track.appendChild(li);
  });
  var cards = $$(".platform__card");

  // 政綱：桌面版用 3D 花田（js/policy3d.js）；不支援 WebGL / 手機 → 原本的卡片
  var P3 = window.Policy3D;
  var use3D = !!(P3 && P3.ok && animate && window.innerWidth > 900);
  var p3Active = 0;
  var p3Targets = [0, 1, 2, 3, 4].map(function (i) {   // 權杖指向用：假的「元素」，位置是 3D 海報投影在畫面上的位置
    return { getBoundingClientRect: function () { return (P3 && P3.panelRect && P3.panelRect(i)) || { left: -9999, top: -9999, width: 0, height: 0, right: -9999, bottom: -9999 }; } };
  });
  if (use3D) {
    document.documentElement.classList.add("p3d");
    // 撕紙那一段搬進 3D 花田的舞台裡：撕開的藍紙之後會往後倒，變成花田上面的天空（同一個連續鏡頭）
    var platPin = $(".platform__pin");
    [".tear__band", ".rip--top", ".rip--bottom"].forEach(function (sel) { platPin.appendChild($(sel)); });
    $(".tear").style.display = "none";
    var p3Title = $(".platform__zoom .portal__title");
    P3.init({
      canvas: $("#platformGL"),
      policies: C.platform || [],
      question: { lines: ["如果我們當選，", "你希望學校有", "什麼改變？"] },
      footer: (C.teamName || "") + "  ·  " + (C.candidateNumber || "") + " 號",
      questionFontPx: function () { return parseFloat(getComputedStyle(p3Title).fontSize) * .5; }
    }).catch(function (err) { console.warn("3D 花田無法載入", err); });
  }

  var socials = $("#socials");
  (C.socials || []).forEach(function (s) {
    var li = el("li");
    var a = el("a", null, s.label);
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    li.appendChild(a);
    socials.appendChild(li);
  });

  /* 逐字拆開（螢幕閱讀器讀隱藏的完整文字） */
  function splitChars(node) {
    var text = node.textContent;
    node.textContent = "";
    node.appendChild(el("span", "sr-only", text));
    var chars = [];
    Array.from(text).forEach(function (ch) {
      var m = el("span", "mask");
      m.setAttribute("aria-hidden", "true");
      var c = el("span", "char", ch === " " ? " " : ch);
      m.appendChild(c);
      node.appendChild(m);
      chars.push(c);
    });
    return chars;
  }
  var heroChars = splitChars($("#heroTitle"));
  var slides = $$(".slide").map(function (s) {
    return {
      root: s,
      bg: $(".slide__bg", s),
      band: $(".slide__band", s),
      nameEl: $("[data-chars]", s),
      name: splitChars($("[data-chars]", s)),
      lines: $$("[data-line]", s),
      points: $$(".slide__stats li", s),
      rules: $$(".slide__stats .rule", s),
      text: $(".slide__text", s),
      photo: $(".slide__photo", s),
      img: $(".slide__photo img", s)
    };
  });
  var factChars = $$(".fact__num").map(splitChars);
  var slideMq = [];

  // 「請投 X 號」逐字建立：捲動時權杖像魔杖一樣揮過去，每個字一個一個出現
  var voteEl = $("#footerVote");
  var voteNum = String(C.candidateNumber || "1");
  voteEl.setAttribute("aria-label", "請投 " + voteNum + " 號");
  var voteChars = [];
  var voteSlot = null;   // 編號那個字（光柱對準它）
  function voteChar(parent, ch, cls) {
    var c = el("span", "char" + (cls ? " " + cls : ""), ch);
    c.setAttribute("aria-hidden", "true");
    parent.appendChild(c);
    voteChars.push(c);
    return c;
  }
  Array.from("請投").forEach(function (ch) { voteChar(voteEl, ch); });
  voteEl.appendChild(document.createTextNode(" "));
  var voteEm = el("em");
  voteEl.appendChild(voteEm);
  Array.from(voteNum).forEach(function (ch) { var c = voteChar(voteEm, ch, "vote-num"); if (!voteSlot) voteSlot = c; });
  voteEm.appendChild(document.createTextNode(" "));
  voteChar(voteEm, "號");

  // 魔杖飛過去的路徑（p：0 → 1）：從畫面左邊外面，弧線掃過文字，飛出畫面右邊
  var swish = { p: 0, x: -9999, y: 0, ang: 0 };
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function sweepPoint(p) {
    var r0 = voteChars[0].getBoundingClientRect();
    var ch = r0.height, W = window.innerWidth;
    var len = ch * 1.45;
    var x0 = -len * 1.1, x1 = W + len * 1.2;              // 起點、終點都在畫面外（整支權杖看不到）
    var yMid = r0.top + ch * .5;
    return {
      x: x0 + (x1 - x0) * p,
      y: yMid + ch * .55 - ch * 1.1 * Math.sin(Math.PI * p)   // 從下面進來、弧線越過文字、往上飛出去
    };
  }
  function computeSwish() {
    var a = sweepPoint(swish.p), b = sweepPoint(Math.min(1, swish.p + .01));
    swish.x = a.x; swish.y = a.y;
    swish.ang = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;   // 杖頭朝著飛行方向
    return swish;
  }

  /* =======================================================
     2. 平滑捲動 (Lenis)
     ======================================================= */
  var lenis = null;
  if (animate && window.Lenis) {
    lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1.1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* =======================================================
     3. 權杖指引：每個段落指向哪裡
        angle：月牙指向的方向（0 右、90 上、-90 下）
     ======================================================= */
  if (guide) {
    Staff.define("loader", { at: [0.5, 0.46], angle: 90, size: 0.74, emphasis: false });
    Staff.define("hero", {
      // 手機：從右下方往上指（不擋住口號）
      el: "#heroCta", anchor: function () { return isDesktop() ? [0.5, 0] : [0.93, 0.95]; },
      angle: function () { return isDesktop() ? -100 : 115; }, gap: 14, size: 0.5
    });
    Staff.define("burn", { el: "#facts", anchor: [0.5, 1], angle: 90, gap: 30, size: 0.5 });
    // 桌面版：從畫面外側指向候選人本人（不擋文字），名字同時劃上底線
    Staff.define("president", {
      el: function () { return isDesktop() ? $(".slide--president .slide__photo img") : $("#presidentName"); },
      anchor: function () { return isDesktop() ? [0.84, 0.1] : [1, 0.5]; },
      angle: function () { return isDesktop() ? 212 : 178; }, gap: 4, size: 0.44, mark: "#presidentName"
    });
    Staff.define("vice", {
      el: function () { return isDesktop() ? $(".slide--vice .slide__photo img") : $("#viceName"); },
      anchor: function () { return isDesktop() ? [0.2, 0.1] : [1, 0.5]; },
      angle: function () { return isDesktop() ? -32 : 178; }, gap: 4, size: 0.44, mark: "#viceName"
    });
    Staff.define("tear", { el: "#tearQuote", anchor: [0.75, 1], angle: 125, gap: 20, size: 0.5 });
    // 藍紙變成天空時，權杖在右邊舉起來指著天空；施展花田魔法時到中間、往下指；推進問題卡片時往下離開畫面
    Staff.define("sky", { at: [0.8, 0.62], angle: 100, size: 0.42, emphasis: false });
    Staff.define("spell", { at: [0.5, 0.24], angle: -90, size: 0.42, emphasis: false });
    Staff.define("away", { at: [0.5, 1.6], angle: 90, size: 0.42, emphasis: false });
    Staff.define("platform", {
      el: function () { return use3D && isDesktop() ? p3Targets[p3Active] : (cards[activeCard] || cards[0]); },
      anchor: function () { return isDesktop() ? [1, 0.5] : [1, 0.15]; },
      angle: function () { return isDesktop() ? 168 : 160; }, gap: 14, size: function () { return use3D && isDesktop() ? .4 : .46; },
      emphasis: false
    });
    Staff.define("portal", {
      el: function () { return $(isDesktop() ? ".platform__zoom .portal__title" : ".portal .portal__title"); },
      anchor: [0.5, 1], angle: 90, gap: 26, size: 0.5, emphasis: false
    });
    // 願望區：指向標題旁邊（不擋住表格），輸入框同時亮起
    Staff.define("wish", { el: "#wishTitle", anchor: [1, 0.55], angle: 176, gap: 24, size: 0.46, mark: "#wishText" });
    // 頁尾：權杖從光柱降下，把寶珠插進插座（到位之後觸發「請投 X 號」）
    // 頁尾：權杖像魔杖一樣跟著捲動揮過文字（寶珠＝杖尖）
    // 頁尾：權杖從左邊快速飛過「請投 2 號」，飛出畫面右邊（寶珠＝杖頭）
    Staff.define("footer", {
      tipAt: function () { var s = computeSwish(); return [s.x, s.y]; },
      angle: function () { return swish.ang; },
      sizePx: function () { return voteChars[0].getBoundingClientRect().height * (isDesktop() ? 1.45 : 1.7); },
      dock: "orb", follow: true, emphasis: false
    });
  }

  /* =======================================================
     4. 開場（hero）
     ======================================================= */
  var hero = {
    bg: $(".hero__bg"),
    eyebrow: $(".hero__eyebrow"),
    persons: $$(".hero__stage .person"),
    plaques: $$(".hero__stage .plaque"),
    foot: $$(".hero__foot [data-hero-fade]"),
    nav: $(".nav")
  };

  if (animate) {
    gsap.set(heroChars, { opacity: 0, scale: .5, yPercent: 30 });
    gsap.set(hero.eyebrow, { opacity: 0, y: 20 });
    gsap.set(hero.persons, { yPercent: 28, opacity: 0 });
    gsap.set(hero.plaques, { opacity: 0, y: 24 });
    gsap.set(hero.foot, { opacity: 0, y: 30 });
    gsap.set(hero.nav, { opacity: 0, y: -20 });
  }

  function playHeroIntro() {
    if (!animate) return;
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(hero.bg, { opacity: 1, duration: 3, ease: "power2.out" }, 0)
      .to(heroChars, { opacity: 1, scale: 1, yPercent: 0, duration: 1.6, stagger: { each: .08, from: "random" } }, .1)
      .to(hero.eyebrow, { opacity: 1, y: 0, duration: 1.6 }, .3)
      .to(hero.persons[0], { yPercent: 0, opacity: 1, duration: 2.2 }, .4)
      .to(hero.persons[1], { yPercent: 0, opacity: 1, duration: 2.2 }, .6)
      .to(hero.plaques, { opacity: 1, y: 0, duration: 1.4, stagger: .15 }, 1.4)
      .to(hero.foot, { opacity: 1, y: 0, duration: 1.4, stagger: .12 }, 1.5)
      .to(hero.nav, { opacity: 1, y: 0, duration: 1.4 }, 1.3);
  }

  /* =======================================================
     5. 載入畫面 → 火牆轉場
     ======================================================= */
  var loader = $("#loader");
  var countEl = $("#loaderCount");
  var barEl = $("#loaderBar");
  var firewall = $("#firewall");
  var ready = false, revealed = false;

  if (!guide) $(".loader__fallback").hidden = false;
  if (guide) Staff.ready(function () { Staff.go("loader"); });

  var pageLoaded = new Promise(function (resolve) {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  });
  var modelLoaded = new Promise(function (resolve) {
    if (!guide) return resolve();
    Staff.ready(resolve);
    setTimeout(resolve, 6000);   // 模型太慢也不要卡住
  });

  function afterReveal() {
    loader.classList.add("is-gone");
    document.body.classList.remove("is-loading");
    window.scrollTo(0, 0);                                   // 一定從最上面開始
    if (lenis) { lenis.scrollTo(0, { immediate: true, force: true }); lenis.start(); }
    if (hasGsap) ScrollTrigger.refresh();
    if (guide) Staff.go("hero");
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (!animate) { afterReveal(); return; }

    var H = window.innerHeight;
    if (guide) Staff.twirl(26);
    gsap.set(firewall, { visibility: "visible", y: H * 1.05, height: H * 2.6 });
    var tl = gsap.timeline();
    tl.to(".loader__count, .loader__bar, .loader__start, .loader__team, .loader__label, .loader__fallback", {
      opacity: 0, y: 20, duration: .5, stagger: .03, ease: "power2.in"
    }, 0)
      .to(firewall, { y: -H * 2.7, duration: 2.8, ease: "power1.inOut" }, .15)
      .add(afterReveal, .15 + 1.4)
      .add(playHeroIntro, .15 + 1.55)
      .set(firewall, { visibility: "hidden" });
  }

  if (!animate) {
    afterReveal();
  } else {
    var prog = { v: 0 };
    var counted = new Promise(function (resolve) {
      gsap.to(prog, {
        v: 100, duration: 3, ease: "power2.inOut",
        onUpdate: function () {
          countEl.textContent = String(Math.floor(prog.v)).padStart(3, "0");
          barEl.style.transform = "scaleX(" + prog.v / 100 + ")";
        },
        onComplete: resolve
      });
    });
    Promise.all([counted, pageLoaded, modelLoaded]).then(function () {
      ready = true;
      loader.classList.add("is-ready");
    });
    loader.addEventListener("click", function () { if (ready) reveal(); });
    document.addEventListener("keydown", function (e) {
      if (ready && !revealed && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        reveal();
      }
    });
  }

  /* =======================================================
     6. 導覽：紅色橫條轉場 + 直接去寫願望
     ======================================================= */
  var wishSection = $("#wish");
  var wishText = $("#wishText");
  var duoPin = null, platformPin = null, platformNavFrac = 0;

  function targetY(id) {
    if (id === "#top") return 0;
    var vh = window.innerHeight;
    if (id === "#president" && duoPin) return duoPin.start + (DUO.PRES_AT - DUO.ENTER) * vh;
    if (id === "#vice" && duoPin) return duoPin.start + (DUO.VICE_AT - DUO.ENTER) * vh;
    if (id === "#platform" && platformPin) return platformPin.start + (platformPin.end - platformPin.start) * (platformNavFrac || 0) + 2;
    var t = $(id);
    if (!t) return null;
    return t.getBoundingClientRect().top + window.scrollY - (id === "#wish" ? 20 : 0);
  }

  // 導覽轉場：權杖從左下揮到右上、飛出畫面，後面拖著天空 + 花瓣蓋住整個畫面 → 換頁 → 天空散開、花瓣落下
  var navSweep = { p: 0 };
  function navTip(p) {
    var W = window.innerWidth, H = window.innerHeight, len = H * .55;
    return [-len * .9 + (W + len * 1.9) * p, H * .74 - H * .5 * p - H * .1 * Math.sin(Math.PI * p)];
  }
  if (guide) {
    Staff.define("navsweep", {
      tipAt: function () { return navTip(navSweep.p); },
      angle: function () {
        var a = navTip(navSweep.p), b = navTip(Math.min(1, navSweep.p + .01));
        return Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180 / Math.PI;
      },
      sizePx: function () { return window.innerHeight * .55; },
      dock: "orb", follow: true, emphasis: false
    });
  }

  var jumping = false, navSweeping = false;   // navSweeping：權杖正在揮過畫面（這時候不要讓其他段落把它叫走）
  function jumpTo(id, then) {
    var y = targetY(id);
    if (y == null) return;
    if (!animate) {
      window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
      if (then) setTimeout(then, reduceMotion ? 0 : 900);
      return;
    }
    if (jumping) return;
    jumping = true;
    var F = window.Flowers && Flowers.ok ? Flowers : null;
    navSweep.p = 0;
    navSweeping = true;
    if (guide) { Staff.go("navsweep"); Staff.snap(); Staff.twirl(24); }
    if (F) F.start();
    var tl = gsap.timeline({ onComplete: function () { jumping = false; } });
    // 1. 權杖揮過去，杖頭經過的地方一朵一朵開出大朵的花
    tl.to(navSweep, {
      p: 1, duration: 1.05, ease: "power1.inOut",
      onUpdate: function () { if (F) F.front(navTip(navSweep.p)[0]); }
    });
    // 等最後的花開完（畫面整個被花蓋住）
    tl.to({}, { duration: .35 });
    // 2. 換頁（所有跟著捲動的動畫直接到位）
    tl.add(function () {
      navSweeping = false;
      if (lenis) lenis.scrollTo(targetY(id), { immediate: true, force: true });
      else window.scrollTo(0, targetY(id));
      ScrollTrigger.update();
      ScrollTrigger.getAll().forEach(function (st) {
        var tw = st.getTween && st.getTween();
        if (tw) tw.progress(1);
      });
      refreshStaffStop();
      if (guide) Staff.enterFromSide();
      if (then) then();
    });
    // 3. 花向外散開，看到新的頁面
    tl.add(function () { if (F) F.scatter(); }, "+=.08")
      .to({}, { duration: 1.3 });
  }
  // 換頁之後，權杖回到那一段該指的地方
  var staffZones = [];
  function refreshStaffStop() {
    if (!guide) return;
    var hit = null;
    staffZones.forEach(function (z) { if (z.st.isActive) hit = z.name; });
    if (hit) Staff.go(hit, true);   // 固定畫面的段落（會長 / 副會長、政綱）在 ScrollTrigger.update() 時已經自己叫過了
  }

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      e.preventDefault();
      if (a.hasAttribute("data-to-wish")) {
        jumpTo("#wish", function () { wishText.focus({ preventScroll: true }); });
      } else {
        jumpTo(id);
      }
    });
  });

  // 浮動「寫願望」按鈕：在首頁按鈕或願望區可見時隱藏
  var floatBtn = $(".float-wish");
  var visible = new Set();
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target);
      });
      floatBtn.classList.toggle("is-hidden", visible.size > 0);
    }, { threshold: 0.1 });
    io.observe($(".hero__actions"));
    io.observe(wishSection);
  }

  function onScrollNav() { hero.nav.classList.toggle("is-scrolled", window.scrollY > 40); }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* =======================================================
     7. 磁吸按鈕（滑鼠拖尾火花在 js/embers.js）
     ======================================================= */
  if (animate && finePointer) {
    $$("[data-magnetic]").forEach(function (btn) {
      var label = $(".btn__label", btn);
      var bx = gsap.quickTo(btn, "x", { duration: .6, ease: "power3.out" });
      var by = gsap.quickTo(btn, "y", { duration: .6, ease: "power3.out" });
      var lx = gsap.quickTo(label, "x", { duration: .6, ease: "power3.out" });
      var ly = gsap.quickTo(label, "y", { duration: .6, ease: "power3.out" });
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        bx(dx * .35); by(dy * .45); lx(dx * .15); ly(dy * .2);
      });
      btn.addEventListener("mouseleave", function () {
        gsap.to([btn, label], { x: 0, y: 0, duration: 1.2, ease: "elastic.out(1, .35)" });
      });
    });
  }

  /* 送出願望：火花爆開，權杖也會轉一圈 */
  window.addEventListener("wish:added", function (e) {
    if (guide) Staff.twirl(20);
    if (window.Embers) Embers.burst(e.detail.x, e.detail.y, 45);
  });

  /* =======================================================
     8. 捲動動畫（只有動畫引擎在跑時）
     ======================================================= */
  var activeCard = 0;
  if (!animate) return;

  gsap.to("#progressBar", {
    scaleX: 1, ease: "none",
    scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: .3 }
  });

  /* ---- hero 捲走：字散開、兩人分開 ---- */
  gsap.timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: .6 } })
    .to(heroChars, {
      yPercent: function () { return -60 - Math.random() * 120; },
      rotate: function () { return (Math.random() - .5) * 40; },
      opacity: 0, ease: "none", stagger: { each: .02, from: "random" }
    }, 0)
    .to(hero.persons[0], { xPercent: -14, scale: .94, ease: "none" }, 0)
    .to(hero.persons[1], { xPercent: 16, scale: .94, ease: "none" }, 0)
    .to(".hero__foot", { opacity: 0, y: -40, ease: "none" }, 0)
    .to(hero.bg, { opacity: .35, ease: "none" }, 0);

  /* ---- 跑馬燈：捲動越快轉得越快 ---- */
  var mq = $("#marquee");
  Array.from(mq.children).forEach(function (n) { mq.appendChild(n.cloneNode(true)); });
  var mqTween = gsap.to(mq, { xPercent: -50, duration: 26, ease: "none", repeat: -1 });
  var skewTo = gsap.quickTo(mq, "skewX", { duration: .5, ease: "power3.out" });
  var dir = 1;
  if (lenis) {
    lenis.on("scroll", function (l) {
      var v = l.velocity || 0;
      if (v !== 0) dir = v > 0 ? 1 : -1;
      gsap.to(mqTween, { timeScale: dir * (1 + Math.min(Math.abs(v) * .25, 6)), duration: .4, overwrite: true });
      skewTo(Math.max(-12, Math.min(12, v * -.6)));
      slideMq.forEach(function (t) { gsap.to(t, { timeScale: 1 + Math.min(Math.abs(v) * .2, 5), duration: .4, overwrite: true }); });
      if (window.Embers) Embers.scroll(v);   // 捲動時的火花
    });
  }

  /* ---- 火牆：從下面燒上來，數字在火上出現，然後燒過去 ---- */
  (function () {
    var wall = $(".burn__wall");
    var H = function () { return window.innerHeight; };
    var allFactChars = [].concat.apply([], factChars);
    gsap.set(allFactChars, { yPercent: 45, opacity: 0 });
    gsap.set(".fact__label", { opacity: 0, y: 20 });
    gsap.timeline({
      scrollTrigger: { trigger: ".burn", start: "top top", end: "+=240%", pin: ".burn__pin", scrub: .6 }
    })
      .fromTo(wall, { y: function () { return H() * 1.02; } }, { y: function () { return -H() * .35; }, ease: "none", duration: 1 })
      .to(allFactChars, { yPercent: 0, opacity: 1, duration: .6, stagger: { each: .04, from: "random" }, ease: "power3.out" }, .75)
      .to(".fact__label", { opacity: 1, y: 0, duration: .5, stagger: .1 }, 1)
      .to({}, { duration: .6 })
      .to(wall, { y: function () { return -H() * 1.8; }, ease: "none", duration: 1.1 });
  })();

  /* ---- 會長 / 副會長 ---- */
  function slideIn(tl, s, at, o) {
    o = o || {};
    var dir = s === slides[0] ? 1 : -1;
    if (!o.noBg) tl.fromTo(s.bg, { opacity: 0 }, { opacity: 1, duration: .7, ease: "power1.out" }, at);
    if (!o.noBand) tl.fromTo(s.band, { xPercent: 10 * dir, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 1, ease: "power2.out" }, at + .05);
    if (!o.noPhoto) tl.fromTo(s.img, { opacity: 0, yPercent: 8, scale: .96 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1, ease: "power2.out" }, at + .1);
    tl.fromTo(s.name, { yPercent: 60, rotation: 8, opacity: 0 }, { yPercent: 0, rotation: 0, opacity: 1, duration: .75, stagger: .07, ease: "back.out(1.6)" }, at + .2)
      .fromTo(s.nameEl, { backgroundSize: "0% 4px" }, { backgroundSize: "100% 4px", duration: .6, ease: "power2.inOut" }, at + .62)
      .fromTo(s.lines, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .07, ease: "power2.out" }, at + .3)
      .fromTo(s.points, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .55, stagger: .08, ease: "power2.out" }, at + .45)
      .fromTo(s.rules, { scaleX: 0 }, { scaleX: 1, duration: .5, stagger: .08, ease: "power2.inOut" }, at + .58);
    return tl;
  }

  // 底部的巨大名字一直移動（會長往左、副會長往右），捲得越快走得越快；只有在這一段畫面上時才動
  slideMq = $$(".slide__track").map(function (tr, i) {
    return gsap.fromTo(tr, { xPercent: i ? -50 : 0 }, { xPercent: i ? 0 : -50, duration: 24, ease: "none", repeat: -1, paused: true });
  });
  ScrollTrigger.create({
    trigger: ".duo", start: "top bottom", end: "bottom top",
    refreshPriority: -1,   // 要在後面建立的固定畫面（pin）之後才計算位置，不然會算錯長度 → 字停住不動
    onToggle: function (self) { slideMq.forEach(function (t) { if (self.isActive) t.play(); else t.pause(); }); }
  });

  var mmDuo = gsap.matchMedia();
  // 時間軸的時間單位＝一個畫面高的捲動距離（從 .duo 頂端在畫面 75% 的位置開始算）
  // PRES_AT / VICE_AT：兩人完整出現的時間點（導覽跳轉用）；SWAP：花海蓋滿畫面、換人的那一刻
  var DUO = { ENTER: .75, PIN: 3.6, PRES_AT: 1.5, VICE_AT: 3.85, SWAP: 2.55 };
  mmDuo.add("(min-width: 901px)", function () {
    var P = slides[0], V = slides[1];
    var ENTER = DUO.ENTER, PIN = DUO.PIN, SWAP = DUO.SWAP, W0 = SWAP - .6, W1 = SWAP + .6;
    var wipe = window.FlowerWipe && FlowerWipe.ok ? FlowerWipe : null;
    // 桌面：人站在畫面最下緣 → 用底部不淡出的版本
    [P, V].forEach(function (s, i) { s.img.src = get((i ? "vice" : "president") + ".photoFull"); });
    gsap.set(V.root, { autoAlpha: 0 });

    // 固定畫面（只負責 pin）
    var pin = ScrollTrigger.create({ trigger: ".duo", start: "top top", end: "+=" + PIN * 100 + "%", pin: ".duo__pin" });

    var idx = $("#duoIndex");
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".duo", start: "top 75%", end: function () { return pin.end; }, scrub: .6, invalidateOnRefresh: true,
        onUpdate: function (self) {
          var second = self.progress * tl.duration() > SWAP;   // 用捲動位置判斷（scrub 的時間會落後）
          idx.textContent = second ? "02" : "01";
          // 用這個時間軸自己的 isActive（pin.isActive 在同一次更新裡可能還沒更新 → 跳轉之後權杖會回不來）
          if (guide && self.isActive && !navSweeping) Staff.go(second ? "vice" : "president");
        }
      },
      // 花海跟著時間軸走（往回捲也會倒著播）
      onUpdate: function () { if (wipe) wipe.scrub((tl.time() - W0) / (W1 - W0)); }
    });
    // 1. 會長進場（畫面捲進來的時候就開始）
    slideIn(tl, P, .05);
    // 2. 停留：鏡頭慢慢推近，底部的名字多走一段
    tl.to(P.img, { scale: 1.06, ease: "none", duration: W0 - 1.15 }, 1.15)
      .to(P.band, { x: -120, ease: "none", duration: W1 - 1.15 }, 1.15);
    // 3. 花海從左邊開過來蓋滿畫面 → 換人 → 花散開
    tl.set(P.root, { autoAlpha: 0 }, SWAP)
      .set(V.root, { autoAlpha: 1 }, SWAP);
    slideIn(tl, V, SWAP + .08, { noBg: true, noBand: true, noPhoto: true });
    // 4. 副會長停留：一樣慢慢推近
    tl.fromTo(V.img, { scale: 1 }, { scale: 1.06, ease: "none", duration: ENTER + PIN - SWAP, immediateRender: false }, SWAP)
      .fromTo(V.band, { x: 0 }, { x: 120, ease: "none", duration: ENTER + PIN - SWAP, immediateRender: false }, SWAP);
    // 5. 離場：還固定在畫面上的時候就淡出成深藍色 → 捲走時不會有一條硬邊切過人和字
    var OUT = ENTER + PIN - .38;
    tl.to(V.text, { y: -40, opacity: 0, duration: .3, ease: "power1.in" }, OUT)
      .to(V.photo, { yPercent: 10, opacity: 0, duration: .34, ease: "power1.in" }, OUT + .02)
      .to(V.band, { opacity: 0, duration: .3, ease: "none" }, OUT + .04)
      .to(V.bg, { opacity: 0, duration: .34, ease: "none" }, OUT + .04);
    tl.to({}, { duration: Math.max(.01, ENTER + PIN - tl.duration()) });
    duoPin = pin;

    // 滑鼠視差：人、字、背景以不同深度跟著滑鼠移動
    var onMove = null;
    if (finePointer) {
      var par = [P, V].map(function (s) {
        var q = function (t, p) { return gsap.quickTo(t, p, { duration: 1.2, ease: "power3.out" }); };
        return { ix: q(s.img, "x"), iy: q(s.img, "y"), tx: q(s.text, "x"), ty: q(s.text, "y"), bx: q(s.bg, "x") };
      });
      onMove = function (e) {
        var px = e.clientX / window.innerWidth - .5, py = e.clientY / window.innerHeight - .5;
        par.forEach(function (o) { o.ix(px * 28); o.iy(py * 10); o.tx(px * -14); o.ty(py * -8); o.bx(px * -36); });
      };
      window.addEventListener("mousemove", onMove, { passive: true });
    }
    return function () {
      duoPin = null;
      if (onMove) window.removeEventListener("mousemove", onMove);
      if (wipe) wipe.scrub(0);
    };
  });
  mmDuo.add("(max-width: 900px)", function () {
    // 手機：照片不會碰到畫面最下緣 → 用底部淡出的版本
    slides.forEach(function (s, i) { s.img.src = get((i ? "vice" : "president") + ".photo"); });
    slides.forEach(function (s) {
      var tl = gsap.timeline({ scrollTrigger: { trigger: s.root, start: "top 70%" } });
      slideIn(tl, s, 0);
      tl.duration(2.2);
    });
  });

  /* ---- 撕紙：黑紙裂開 → 撕成兩半拉開 → 露出口號（桌面 3D 版在 build3D 裡，和花田是同一個鏡頭） ---- */
  if (!use3D) (function () {
    var top = $(".rip--top"), bot = $(".rip--bottom");
    var H = function () { return window.innerHeight; };
    var Wd = function () { return window.innerWidth; };
    gsap.timeline({
      scrollTrigger: {
        trigger: ".tear", start: "top top", end: "+=170%", pin: ".tear__pin", scrub: .6, invalidateOnRefresh: true,
        onUpdate: function (self) { if (guide && self.isActive && self.progress > .42 && !navSweeping) Staff.go("tear"); }
      }
    })
      // 1. 裂痕出現，紙微微被拉緊
      .fromTo(top, { "--fringe": 0 }, { "--fringe": 1, duration: .16, ease: "none" }, 0)
      .fromTo(top, { y: 0, rotation: 0 }, { y: -8, rotation: -.7, duration: .16, ease: "none" }, 0)
      .fromTo(bot, { y: 0, rotation: 0 }, { y: 8, rotation: .5, duration: .16, ease: "none" }, 0)
      // 2. 撕開：越拉越快，上下兩半各自扭開
      .to(top, { y: function () { return -H() * .45; }, x: function () { return -Wd() * .02; }, rotation: -5, duration: .6, ease: "power2.in" }, .16)
      .to(bot, { y: function () { return H() * .45; }, x: function () { return Wd() * .02; }, rotation: 3.5, duration: .6, ease: "power2.in" }, .16)
      // 3. 口號浮現
      .fromTo(".tear__quote", { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: .4, ease: "power2.out" }, .42)
      .fromTo(".tear__kicker", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .3 }, .5)
      .to({}, { duration: .35 });
  })();

  /* ---- 政綱：卡片畫廊 ---- */
  var ghost = $("#platformGhost");
  var pIndex = $("#platformIndex");
  function setActiveCard(i) {
    if (i === activeCard) return;
    activeCard = i;
    var label = String(i + 1).padStart(2, "0");
    pIndex.textContent = label;
    gsap.fromTo(ghost, { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: .8, ease: "power3.out", onStart: function () { ghost.textContent = label; } });
    if (guide && Staff.current() === "platform") Staff.go("platform", true);
  }
  /* 撕紙邊的多邊形：同一組隨機值 → 每一格形狀穩定，不會閃動 */
  function makeTear(seed, M) {
    var sd = seed;
    function rnd() { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }
    function side() {
      var j = [], f = [], a = 0, b = 0;
      for (var i = 0; i < M; i++) {
        a = a * .8 + (rnd() - .5) * 6;                     // 撕痕的起伏
        b = b * .7 + (rnd() - .5) * 6;
        var bite = rnd() < .07 ? (rnd() - .5) * 26 : 0;     // 偶爾撕得比較深
        j.push(a + (rnd() - .5) * 3 + bite);
        f.push(5 + Math.abs(b) * 2 + rnd() * 7);           // 白色紙纖維的寬度
      }
      return { j: j, f: f };
    }
    return [side(), side(), side(), side()];
  }
  /* k：撕紙程度 0 → 1。k = 0 時是普通的圓角卡片（和其他政綱卡片一樣），越捲越變成撕紙邊
     rim：白色紙纖維那一層（k = 0 時只是一條細細的卡片邊框） */
  function tornClip(L, T, R, B, tear, rim, k, rad, amp) {
    var M = tear[0].j.length, pts = [], i, t;
    var r = (rad || 0) * (1 - k);
    var ka = k * (amp == null ? 1 : amp);   // 撕痕的大小（放大的元素用 1/倍率 → 畫面上永遠是一樣大的紙邊）
    function pt(x, y) { pts.push(x.toFixed(1) + "px " + y.toFixed(1) + "px"); }
    function off(side, i) { return rim ? ((1 - k) * 1.2 + k * tear[side].f[i]) * (amp == null ? 1 : amp) : 0; }
    function corner(cx, cy, a0) {
      for (var q = 0; q <= 5; q++) {
        var a = a0 + q / 5 * Math.PI / 2;
        pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    }
    var ro = rim ? (1 - k) * 1.2 : 0;   // 圓角處的邊框寬度
    for (i = 0; i < M; i++) { t = i / (M - 1); pt(L + r + (R - L - 2 * r) * t, T + ka * tear[0].j[i] - off(0, i)); }
    r += ro; corner(R - r + ro, T + r - ro, -Math.PI / 2); r -= ro;
    for (i = 0; i < M; i++) { t = i / (M - 1); pt(R + ka * tear[1].j[i] + off(1, i), T + r + (B - T - 2 * r) * t); }
    r += ro; corner(R - r + ro, B - r + ro, 0); r -= ro;
    for (i = 0; i < M; i++) { t = i / (M - 1); pt(R - r - (R - L - 2 * r) * t, B + ka * tear[2].j[i] + off(2, i)); }
    r += ro; corner(L + r - ro, B - r + ro, Math.PI / 2); r -= ro;
    for (i = 0; i < M; i++) { t = i / (M - 1); pt(L + ka * tear[3].j[i] - off(3, i), B - r - (B - T - 2 * r) * t); }
    r += ro; corner(L + r - ro, T + r - ro, Math.PI); r -= ro;
    return "polygon(" + pts.join(",") + ")";
  }
  // 紙纖維那一層：一開始是卡片的細邊框（藍色，3D 版是金色），撕開時變成白色的紙
  function rimColor(el, k, from) {
    from = from || [79, 143, 216, .55];
    var mix = function (a, b) { return Math.round(a + (b - a) * k); };
    el.style.backgroundColor = "rgba(" + mix(from[0], 239) + "," + mix(from[1], 232) + "," + mix(from[2], 220) + "," + (from[3] + (1 - from[3]) * k).toFixed(2) + ")";
  }
  function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  /* 3D 花田（桌面版，一個連續的鏡頭）：
     A 黑紙撕開，露出藍色和參選原因 → B 藍紙往後倒、字變淡，變成天空 → C 天空變成星空，鏡頭往下看到空的草地
     → D 權杖施展花田魔法：一圈光擴散，花開出來，海報從土裡升起 → E 俯衝進花田 → F 一張一張看海報
     → G 問題卡片：紙邊出現，鏡頭直直推進卡片裡，穿過去就是願望區 */
  function build3D() {
    var zoom = $(".platform__zoom");   // 3D 版只當最後淡成深藍色的遮罩
    var band = $(".tear__band"), ripTop = $(".rip--top"), ripBot = $(".rip--bottom");
    var quote = $(".tear__quote"), kicker = $(".tear__kicker");
    var ph3 = { look: 0, day: 1, bloom: 0, swoop: 0 }, cam = { p: 0 }, zm = { z: 0 };
    var H = function () { return window.innerHeight; }, Wv = function () { return window.innerWidth; };
    // 時間軸上的位置（單位 ≈ 一個畫面的捲動距離）
    var T = { sky: 1.15, night: 1.85, spell: 3.25, swoop: 4.25, posters: 4.95, handoff: 9.15 };
    var lastBloom = 0;
    var pinEl = $(".platform__pin"), lastMask = null;
    function update() {
      // 進場：整段的頂端先羽化（疊在正在淡出的副會長上面），開始撕紙之前羽化就收掉（那時頂端本來就是深藍色，看不出來）
      var e = 1 - smooth01(tl.time() / .12);
      var m = e > .001 ? "linear-gradient(180deg, rgba(0,0,0," + (1 - e).toFixed(3) + ") 0, #000 " + (e * 42).toFixed(1) + "vh)" : "none";
      if (m !== lastMask) { pinEl.style.webkitMaskImage = pinEl.style.maskImage = m; lastMask = m; }
      P3.setPhase(ph3);
      P3.setProgress(cam.p);
      var ai = P3.activeIndex();
      if (ai !== p3Active) { p3Active = ai; if (guide && Staff.current() === "platform") Staff.go("platform", true); }
      setActiveCard(Math.min(ai, 3));
      // 花開始開的那一刻：權杖的寶珠噴出一把光點和花瓣
      if (ph3.bloom > .02 && lastBloom <= .02 && window.Embers) Embers.burst(Wv() / 2, H() * .42, 46);
      lastBloom = ph3.bloom;
      // G：推進問題卡片 —— 全部在 3D 裡：鏡頭往前走、紙邊撕開、星星有深度；最後整片淡成願望區的深藍色
      var rect = P3.questionRect && P3.questionRect();
      if (!rect) return;
      var z = zm.z;
      var sEnd = Math.max(Wv() / rect.width, H() / rect.height) * 1.5;
      P3.setZoom(Math.exp(Math.log(sEnd) * z));          // 等速的放大（每一段捲動放大一樣多倍）
      P3.setCard({ tear: smooth01(z / .16), text: 1 - smooth01((z - .4) / .3) });
      zoom.style.opacity = smooth01((z - .66) / .3).toFixed(3);
    }
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".platform", start: "top top", end: "+=1190%", pin: ".platform__pin", scrub: .8, invalidateOnRefresh: true,
        onToggle: function (self) { if (self.isActive) P3.start(); else P3.stop(); },
        onRefresh: update,
        onUpdate: function (self) {
          if (!guide || !self.isActive || navSweeping) return;
          var t = self.progress * tl.duration();
          var stop = t >= T.handoff ? "away" : t >= T.swoop ? "platform" : t >= T.spell - .15 ? "spell" : t >= T.sky ? "sky" : t >= .42 ? "tear" : null;
          if (stop) Staff.go(stop);
        }
      },
      onUpdate: update
    });
    // A. 黑紙撕開，露出藍色和參選原因
    tl.fromTo(ripTop, { "--fringe": 0 }, { "--fringe": 1, duration: .16, ease: "none" }, 0)
      .fromTo(ripTop, { y: 0, rotation: 0 }, { y: -8, rotation: -.7, duration: .16, ease: "none" }, 0)
      .fromTo(ripBot, { y: 0, rotation: 0 }, { y: 8, rotation: .5, duration: .16, ease: "none" }, 0)
      .to(ripTop, { y: function () { return -H() * .45; }, x: function () { return -Wv() * .02; }, rotation: -5, duration: .6, ease: "power2.in" }, .16)
      .to(ripBot, { y: function () { return H() * .45; }, x: function () { return Wv() * .02; }, rotation: 3.5, duration: .6, ease: "power2.in" }, .16)
      .fromTo(quote, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: .4, ease: "power2.out" }, .42)
      .fromTo(kicker, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .3 }, .5);
    // B. 藍紙往後躺下去，變成頭頂上的天花板＝天空（消失點在地平線，字跟著變扁、往遠處退），字變淡
    //    同時鏡頭開始往下看：紙（天空）往上移，地平線從下面升起來；後面的 3D 天空和紙一模一樣的藍
    tl.to([quote, kicker], { opacity: .4, duration: .3, ease: "power1.out" }, T.sky)
      .to([quote, kicker], { opacity: 0, duration: .5, ease: "power1.in" }, T.sky + .55)
      .to(ripTop, { y: function () { return -H(); }, duration: .45, ease: "power2.in" }, T.sky)
      .to(ripBot, { y: function () { return H(); }, duration: .45, ease: "power2.in" }, T.sky)
      .fromTo(band, { "--soft": 0 }, { "--soft": 1, duration: .6, ease: "power1.out", immediateRender: false }, T.sky)
      .fromTo(band, { rotationX: 0, y: 0, transformOrigin: "50% 0%" },
        { rotationX: -84, duration: 1.1, ease: "power1.inOut", immediateRender: false }, T.sky)
      .to(band, { y: function () { return -H() * .3; }, duration: .8, ease: "power1.in" }, T.sky + .45)
      .to(band, { opacity: 0, duration: .45, ease: "power1.in" }, T.sky + .8);
    // C. 天空變成星空，鏡頭一路往下看，看到一片空的草地
    tl.to(ph3, { look: 1, duration: 1.9, ease: "sine.inOut" }, T.sky + .3)
      .to(ph3, { day: 0, duration: .95, ease: "power1.inOut" }, T.night);
    // D. 花田魔法
    tl.to(ph3, { bloom: 1, duration: .95, ease: "power1.in" }, T.spell)
      .fromTo(".platform__head", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .35, ease: "power2.out" }, T.spell + .1);
    // E. 俯衝進花田
    tl.to(ph3, { swoop: 1, duration: .7, ease: "power1.inOut" }, T.swoop)
      .to(".platform__head", { opacity: 0, y: -50, duration: .4, ease: "power1.in" }, T.swoop + .15);
    // F. 一張一張看海報
    tl.to(cam, { p: 1, ease: "none", duration: 4 }, T.posters)
      .fromTo(".platform__count", { opacity: 0 }, { opacity: 1, duration: .3 }, T.posters)
      .to(".platform__count", { opacity: 0, duration: .3 }, T.posters + 3.75);
    // G. 推進問題卡片
    tl.to(zm, { z: 1, ease: "power1.inOut", duration: 1.7 }, T.handoff)
      .to({}, { duration: .3 });
    platformPin = tl.scrollTrigger;
    platformNavFrac = (T.spell + .82) / tl.duration();   // 導覽「政綱」：跳到花剛開好的時候
    var rt = 0;
    var onResize = function () { clearTimeout(rt); rt = setTimeout(function () { P3.resize(); update(); }, 150); };
    window.addEventListener("resize", onResize);
    update();
    return function () {
      platformPin = null;
      P3.stop();
      window.removeEventListener("resize", onResize);
      zoom.style.opacity = "";
      pinEl.style.webkitMaskImage = pinEl.style.maskImage = "";
    };
  }

  var mmPlat = gsap.matchMedia();
  mmPlat.add("(min-width: 901px)", function () {
    if (use3D) return build3D();
    var n = cards.length;
    var H = function () { return window.innerHeight; };
    var Wv = function () { return window.innerWidth; };
    var cardH = function () { return cards[0].offsetHeight; };
    var cardW = function () { return cards[0].offsetWidth; };
    var step = function () { return cardH() + H() * .06; };
    var first = function () { return (H() - cardH()) / 2; };

    // 「如果我們當選…」是畫廊最後一張（撕紙邊）卡片：跟著其他卡片升上來，然後撕開成全螢幕
    var zoom = $(".platform__zoom"), rim = $(".platform__rim");
    var zTitle = $(".platform__zoom .portal__title"), zEyebrow = $(".platform__zoom .portal__eyebrow");
    var tear = makeTear(7, 56);
    var zs = { open: 0 };
    var qShown = null;

    function shade() {
      var mid = H() / 2;
      var best = 0, bestD = 1e9;
      cards.forEach(function (c, i) {
        var r = c.getBoundingClientRect();
        var d = (r.top + r.height / 2 - mid) / step();
        var ad = Math.min(Math.abs(d), 1.6);
        gsap.set(c, { scale: 1 - ad * .14, opacity: 1 - ad * .55 });
        if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
      });
      setActiveCard(best);

      // 問題卡片 = 虛擬的第 n+1 張卡片
      var ty = gsap.getProperty(track, "y");
      var ch = cardH(), cw = cardW(), e = zs.open, m = 90;
      var qc = ty + n * step() + ch / 2;
      var L0 = (Wv() - cw) / 2, T0 = qc - ch / 2;
      var L = L0 + (-m - L0) * e, T = T0 + (-m - T0) * e;
      var R = (L0 + cw) + (Wv() + m - (L0 + cw)) * e, B = (T0 + ch) + (H() + m - (T0 + ch)) * e;
      var show = T < H() + 40;
      if (show !== qShown) { zoom.style.visibility = rim.style.visibility = show ? "visible" : "hidden"; qShown = show; }
      if (!show) return;
      var k = smooth01(e / .22);          // 開始撕的那一段捲動裡，邊緣從圓角卡片變成撕紙
      zoom.style.clipPath = tornClip(L, T, R, B, tear, false, k, 18);
      rim.style.clipPath = tornClip(L, T, R, B, tear, true, k, 18);
      rimColor(rim, k);
      zTitle.style.transform = "translateY(" + ((qc - mid) * (1 - e)).toFixed(1) + "px) scale(" + (.5 + .5 * e).toFixed(3) + ")";
      zEyebrow.style.opacity = Math.max(0, (e - .45) * 2).toFixed(2);
    }

    var portalAt = 1e9;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".platform", start: "top top", end: function () { return "+=" + (n * 70 + 170) + "%"; },
        pin: ".platform__pin", scrub: .6, invalidateOnRefresh: true, onRefresh: shade,
        onUpdate: function (self) {
          if (guide && self.isActive && !navSweeping) Staff.go(self.progress * tl.duration() >= portalAt ? "portal" : "platform");
        }
      },
      onUpdate: shade   // 每一格都更新（scrub 追趕時也會）
    });
    tl.fromTo(track, { y: function () { return first() + H() * .5; } }, { y: first, ease: "none", duration: .6 })
      .to(track, { y: function () { return first() - (n - 1) * step(); }, ease: "none", duration: n - 1 })
      // 第 4 張往上離開，問題卡片（本來就寫好問題）升到中間
      .to(track, { y: function () { return first() - n * step(); }, ease: "none", duration: 1 })
      .to([".platform__head", ".platform__count", ghost], { opacity: 0, duration: .6 }, "<");
    portalAt = tl.duration() - .4;
    // 然後像撕紙一樣把洞撕開，變成全螢幕，接到願望區
    tl.to({}, { duration: .2 })
      .to(zs, { open: 1, ease: "power2.inOut", duration: 1.2 })
      .to({}, { duration: .3 });
    platformPin = tl.scrollTrigger;
    gsap.from(".platform__head", { y: 60, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".platform", start: "top 60%" } });
    shade();
    return function () {
      platformPin = null;
      gsap.set(cards, { clearProps: "all" });
      zoom.style.clipPath = rim.style.clipPath = zTitle.style.transform = "";
    };
  });
  mmPlat.add("(max-width: 900px)", function () {
    cards.forEach(function (c, i) {
      gsap.from(c, {
        y: 60, rotationX: -20, opacity: 0, duration: 1.3, ease: "expo.out", transformPerspective: 900,
        scrollTrigger: { trigger: c, start: "top 88%", onEnter: function () { setActiveCard(i); }, onEnterBack: function () { setActiveCard(i); } }
      });
    });
  });

  /* ---- 手機版：撕紙邊的問題卡片 → 撕開成全螢幕 → 願望區（桌面版在政綱畫廊裡完成） ---- */
  gsap.matchMedia().add("(max-width: 900px)", function () {
    var card = $(".portal .portal__card"), rim = $(".portal__rim");
    var title = $(".portal .portal__title"), eb = $(".portal .portal__eyebrow");
    var tear = makeTear(11, 44);
    var zs = { open: 0 };
    function draw() {
      var W = window.innerWidth, H = window.innerHeight, e = zs.open, m = 60;
      var L0 = W * .1, R0 = W * .9, T0 = H * .28, B0 = H * .72;
      var L = L0 + (-m - L0) * e, T = T0 + (-m - T0) * e, R = R0 + (W + m - R0) * e, B = B0 + (H + m - B0) * e;
      var k = smooth01(e / .22);
      card.style.clipPath = tornClip(L, T, R, B, tear, false, k, 22);
      rim.style.clipPath = tornClip(L, T, R, B, tear, true, k, 22);
      rimColor(rim, k);
      title.style.transform = "scale(" + (.62 + .38 * e).toFixed(3) + ")";
      eb.style.opacity = Math.max(0, (e - .45) * 2).toFixed(2);
    }
    gsap.timeline({ scrollTrigger: { trigger: ".portal", start: "top top", end: "+=160%", pin: ".portal__pin", scrub: .6 }, onUpdate: draw })
      .to(zs, { open: 1, ease: "power2.inOut", duration: 1 })
      .to({}, { duration: .4 });
    draw();
    return function () { card.style.clipPath = rim.style.clipPath = title.style.transform = ""; };
  });

  /* ---- 願望區 ---- */
  $$("[data-reveal]").forEach(function (n) {
    gsap.from(n, {
      y: 50, opacity: 0, filter: "blur(10px)", duration: 1.4, ease: "expo.out",
      scrollTrigger: { trigger: n, start: "top 88%" },
      onComplete: function () { gsap.set(n, { clearProps: "filter" }); }
    });
  });
  gsap.from(".wish-form", {
    y: 80, opacity: 0, duration: 1.6, ease: "expo.out",
    scrollTrigger: { trigger: ".wish__grid", start: "top 85%" },
    onComplete: function () { gsap.set(".wish-form", { clearProps: "transform" }); }
  });

  /* ---- 頁尾：權杖快速飛過 → 一大串花瓣 → 「請投 2 號」一個字一個字跳出來 ---- */
  function hideVote() {
    gsap.killTweensOf(voteChars);
    gsap.set(voteChars, { opacity: 0, scale: 1.06 });
  }
  hideVote();
  var sweepTween = null, swept = false, waitRaf = 0;
  function sweep() {
    if (swept) return;                // 已經飛過了：往上捲一點再下來不會重播（字不會突然消失）
    swept = true;
    swish.p = 0;
    if (!guide) return fly();
    // 等權杖先滑到畫面左邊外面（最多 0.8 秒），再開始飛 → 不會瞬間消失
    Staff.go("footer");
    var t0 = performance.now();
    cancelAnimationFrame(waitRaf);
    (function wait() {
      if (!swept) return;
      if (Staff.distance() < 40 || performance.now() - t0 > 800) { Staff.snap(); Staff.twirl(22); fly(); }
      else waitRaf = requestAnimationFrame(wait);
    })();
  }
  function fly() {
    if (sweepTween) sweepTween.kill();
    var popped = voteChars.map(function () { return false; });
    var lastTip = null;
    sweepTween = gsap.to(swish, {
      p: 1, duration: 1.35, ease: "power1.inOut",
      onUpdate: function () {
        var s = computeSwish();
        // 杖頭經過的字：跳出來 + 花瓣
        voteChars.forEach(function (c, i) {
          if (popped[i]) return;
          var r = c.getBoundingClientRect();
          if (s.x >= r.left + r.width * .2) {
            popped[i] = true;
            // 一團花蓋住這個字 → 花很快散掉 → 字就在那裡
            if (window.Embers) Embers.bloom(r.left, r.top, r.width, r.height, 36);
            gsap.to(c, { opacity: 1, scale: 1, duration: .45, delay: .12, ease: "power2.out" });
          }
        });
        // 花瓣軌跡（很快就消失）
        if (window.Embers && lastTip) Embers.trail(s.x, s.y, s.x - lastTip[0], s.y - lastTip[1], 7, true);
        lastTip = [s.x, s.y];
      }
    });
  }
  function resetSweep() {           // 字完全離開畫面（在下面）之後才重設，下次捲下來會重播
    swept = false;
    cancelAnimationFrame(waitRaf);
    if (sweepTween) sweepTween.kill();
    swish.p = 0;
    hideVote();
  }
  ScrollTrigger.create({ trigger: voteEl, start: "top 72%", onEnter: sweep });
  ScrollTrigger.create({ trigger: voteEl, start: "top bottom", onLeaveBack: resetSweep });

  /* ---- 權杖跟著段落走 ---- */
  if (guide) {
    var zone = function (trigger, name, start, end) {
      var st = ScrollTrigger.create({
        trigger: trigger, start: start || "top 55%", end: end || "bottom 45%",
        onToggle: function (self) { if (self.isActive && revealed && !navSweeping) Staff.go(name); }
      });
      staffZones.push({ st: st, name: name });
    };
    zone(".hero", "hero", "top top", "bottom 45%");
    zone(".burn", "burn");
    if (isDesktop()) {
      zone(".duo", "president", "top 60%", "top top");
    } else {
      zone(".slide--president", "president");
      zone(".slide--vice", "vice");
    }
    // 撕紙：口號露出來之後才指向它（在撕紙動畫的 onUpdate 裡）
    zone(".platform", "platform", "top 50%", isDesktop() ? "top top" : "bottom 50%");   // 手機：卡片是一般清單，整段都指向中間那張
    if (!isDesktop()) zone(".portal", "portal", "top 50%", "bottom 50%");
    // 願望 → 頁尾在同一個捲動位置交接；權杖提早離開，先滑到畫面左邊外面，準備最後的飛越
    zone(".wish", "wish", "top 45%", "bottom 92%");
    zone(".footer", "footer", "top 92%", "bottom top");
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
