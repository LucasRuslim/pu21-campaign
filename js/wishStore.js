/* =========================================================
   願望儲存層
   1. 寄到候選人的信箱：透過 FormSubmit（https://formsubmit.co，免費、不用自己架後端）
      收件人在 js/config.js 的 wishEmail 設定。
      第一次有人提交時，FormSubmit 會寄一封「Activate Form」確認信到 wishEmail.to，
      按下確認之後，之後的每一個願望都會直接寄到信箱（副本寄給 wishEmail.cc）。
   2. 同時在這台電腦的 localStorage 留一份備份。

   之後要換成自己的後端：只需要改寫這個檔案的 addWish / getWishes，
   保持回傳 Promise 和同樣的資料格式，其他檔案不用動。

   wish = { id, text, name, className, category, createdAt }
   ========================================================= */
(function () {
  var KEY = "campaign.wishes.v1";
  var COOLDOWN = 15000;   // 同一台電腦兩次提交至少間隔 15 秒（避免連按、洗版）
  var memory = []; // localStorage 不可用時（例如無痕模式）的後備
  var lastSent = 0;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : memory.slice();
    } catch (e) {
      return memory.slice();
    }
  }

  function write(list) {
    memory = list.slice();
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* 存不到就只留在記憶體 */
    }
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fail(msg) {
    var e = new Error(msg);
    e.userMessage = msg;
    return e;
  }

  /* 寄信：FormSubmit 的 AJAX 介面（回傳 JSON，不會跳頁） */
  function sendEmail(wish) {
    var cfg = window.SITE_CONFIG && window.SITE_CONFIG.wishEmail;
    if (!cfg || !cfg.to) return Promise.resolve();   // 沒設定信箱 → 只存本機
    if (!window.fetch) return Promise.reject(fail("你的瀏覽器太舊，無法送出"));
    var when = new Date(wish.createdAt);
    var body = {
      "願望": wish.text,
      "類別": wish.category,
      "名字": wish.name || "（匿名）",
      "班別": wish.className || "（沒填）",
      "時間": when.toLocaleString("zh-TW", { hour12: false }),
      _subject: "【新願望】" + wish.category + "：" + wish.text.slice(0, 24) + (wish.text.length > 24 ? "…" : ""),
      _template: "table",
      _captcha: "false"
    };
    if (cfg.cc && cfg.cc.length) body._cc = cfg.cc.join(",");
    return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cfg.to), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || String(data.success) !== "true") {
          // 還沒按確認信的時候，FormSubmit 會回傳「needs Activation」
          if (/activat/i.test(data.message || "")) throw fail("信箱還在等待確認，請稍後再試");
          throw fail("寄送失敗，請稍後再試");
        }
      });
    }, function () {
      throw fail("網路好像斷了，請稍後再試");
    });
  }

  /** 新增一個願望：寄到候選人的信箱，並在本機留一份。回傳儲存後的完整物件 */
  function addWish(input) {
    var wish = {
      id: makeId(),
      text: String(input.text || "").trim(),
      name: String(input.name || "").trim(),
      className: String(input.className || "").trim(),
      category: input.category || "其他",
      createdAt: new Date().toISOString()
    };
    // 防機器人的隱藏欄位被填了 → 假裝成功，但什麼都不做
    if (input.honey) return Promise.resolve(wish);
    var now = Date.now();
    if (now - lastSent < COOLDOWN) return Promise.reject(fail("太快了！請等幾秒再送下一個願望"));
    lastSent = now;
    return sendEmail(wish).then(function () {
      var list = read();
      list.push(wish);
      write(list);
      return wish;
    }, function (err) {
      lastSent = 0;   // 沒寄成功 → 可以馬上再試
      throw err;
    });
  }

  /** 取得這台電腦送出過的願望（最新的排最前） */
  function getWishes() {
    var list = read().slice().sort(function (a, b) {
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    return Promise.resolve(list);
  }

  window.WishStore = { addWish: addWish, getWishes: getWishes };
})();
