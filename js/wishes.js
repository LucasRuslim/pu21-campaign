/* =========================================================
   願望表單（只負責收集，不公開顯示其他人的願望）
   只透過 window.WishStore 存取資料（見 js/wishStore.js）
   ========================================================= */
(function () {
  var CATEGORIES = ["學術", "活動", "設施", "福利", "其他"];
  var MAX = 200;
  var THANKS = ["收到了！謝謝你的願望 ✦", "記下了，我們會努力 ✦", "你的聲音我們聽到了 ✦"];

  var form = document.getElementById("wishForm");
  var text = document.getElementById("wishText");
  var nameInput = document.getElementById("wishName");
  var classInput = document.getElementById("wishClass");
  var count = document.getElementById("wishCount");
  var error = document.getElementById("wishError");
  var submit = document.getElementById("wishSubmit");
  var thanks = document.getElementById("wishThanks");
  var chips = document.getElementById("categoryChips");

  /* ---------- 類別選擇 ---------- */
  CATEGORIES.forEach(function (cat) {
    var label = document.createElement("label");
    label.className = "chip";
    var input = document.createElement("input");
    input.type = "radio";
    input.name = "category";
    input.value = cat;
    if (cat === "其他") input.checked = true;
    var span = document.createElement("span");
    span.textContent = cat;
    label.appendChild(input);
    label.appendChild(span);
    chips.appendChild(label);
  });

  /* ---------- 字數 ---------- */
  function updateCount() {
    var n = text.value.length;
    count.textContent = n + " / " + MAX;
    count.classList.toggle("is-near", n >= MAX - 20);
  }
  text.addEventListener("input", function () {
    updateCount();
    if (text.value.trim()) setError("");
  });

  function setError(msg) {
    error.textContent = msg;
    text.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  /* ---------- 提交 ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = text.value.trim();
    if (!value) {
      setError("請先寫下你的願望");
      text.focus();
      return;
    }
    if (value.length > MAX) {
      setError("最多 " + MAX + " 字");
      text.focus();
      return;
    }

    var checked = form.querySelector('input[name="category"]:checked');
    submit.disabled = true;

    window.WishStore.addWish({
      text: value,
      name: nameInput.value,
      className: classInput.value,
      category: checked ? checked.value : "其他",
      honey: (document.getElementById("wishHoney") || {}).value
    }).then(function () {
      text.value = "";
      updateCount();
      setError("");

      thanks.classList.remove("is-show");
      void thanks.offsetWidth; // 重新觸發動畫
      thanks.textContent = THANKS[Math.floor(Math.random() * THANKS.length)];
      thanks.classList.add("is-show");

      var r = submit.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent("wish:added", {
        detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }));
    }).catch(function (err) {
      setError(err && err.userMessage ? err.userMessage : "提交失敗，請稍後再試");
    }).then(function () {
      submit.disabled = false;
    });
  });

  updateCount();
})();
