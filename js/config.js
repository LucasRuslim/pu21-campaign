/* =========================================================
   網站內容設定 —— 所有文字都在這裡改，不用碰其他檔案
   方括號 [ ] 裡的是待填內容，記得換成真實資料
   ========================================================= */
window.SITE_CONFIG = {
  teamName: "普二一競選團",
  slogan: "希望大家的意見，可以被學校聽到。",
  // 撕紙段落的大字：參選原因
  reason: "我們希望大家的意見可以被學校聽到，在力所能及的範圍，讓學校變得更好。",
  candidateNumber: "2",           // 候選編號：「請投 2 號」
  voteDate: "[投票日期]",           // 例如 "10月 15日（三）"
  // 願望寄到這兩個信箱（透過 FormSubmit，第一次有人提交時，第一個信箱會收到一封「Activate」確認信，按下去之後才會開始寄）
  wishEmail: { to: "11401031@yh.tp.edu.tw", cc: ["11401036@yh.tp.edu.tw"] },
  accent: "#3f7fcf",              // 主題色：芙莉蓮的魔力藍（可換成校色）

  president: {
    name: "張芝穎",
    className: "",                // 班別（留空就不顯示）
    photo: "assets/president2-cut.webp",   // 已去背的照片（首頁用，底部淡出）
    photoFull: "assets/president2-full.webp",   // 候選人介紹用（底部不淡出，站在畫面最下緣）
    instagram: "ylning.5271",
    intro: "跟 AI 討論政見到半夜（AI 可能比我還熟）。曾經在睡夢中穿越回古代，順便把地理課上完，醒來發現跟課本上一樣（？）",
    points: [
      { title: "特殊專長", desc: "一個問題想出 10 種發展可能；模考題本寫一節課就全班最高（真實性有待確認）" },
      { title: "興趣", desc: "看 Hook（？）、看小說 & 動漫" },
      { title: "綽號", desc: "KIKI AI、古人" },
      { title: "事蹟", desc: "參加科展得名、國中市長獎畢業，喜歡發起各式各樣奇奇怪怪的活動" }
    ]
  },

  vice: {
    name: "陳奕璁",
    className: "",
    photo: "assets/vice2-cut.webp",
    photoFull: "assets/vice2-full.webp",
    instagram: "itchen_7",
    intro: "萬年校排一、考上建中 —— 但吃飯吃很慢。",
    points: [
      { title: "特殊專長", desc: "睡死、吃統餐吃到吐（外加吃飯吃很慢）" },
      { title: "興趣", desc: "籃球、看任何體育競賽" },
      { title: "綽號", desc: "三角形（因為他打三角形的題都會對，根本像咒語）" },
      { title: "事蹟", desc: "考上建中、優良學生第二名、萬年校排一" }
    ]
  },

  // 火牆轉場上出現的三個數字
  facts: [
    { num: "2", label: "號候選人" },
    { num: "10", label: "種發展可能 · 一個問題想出來的" },
    { num: "1", label: "萬年校排" }
  ],

  // 「我們的政綱」—— image：卡片背景圖，focus：圖片裁切時要保留的位置（左右% 上下%）
  platform: [
    { image: "assets/policy-1.webp", focus: "24% 45%", title: "意見箱優化", desc: "實體意見箱繼續使用，並增設線上意見平台，可以看到意見是否受理或被駁回；若有詳細問題需要溝通，可以與學生會帳號聯繫。" },
    { image: "assets/policy-2.webp", focus: "40% 40%", title: "定期聚會", desc: "班級代表定期聚會，提出各班的意見。" },
    { image: "assets/policy-3.webp", focus: "50% 30%", title: "蒐集社團意見", desc: "各社社長定期聚會，蒐集社團需要改善的地方。" },
    { image: "assets/policy-4.webp", focus: "50% 35%", title: "協辦活動", desc: "與學校合作，辦理幼華之星等活動。" }
  ],

  // 社交連結，不需要的可以刪掉整行
  socials: [
    { label: "張芝穎 @ylning.5271", url: "https://www.instagram.com/ylning.5271/" },
    { label: "陳奕璁 @itchen_7", url: "https://www.instagram.com/itchen_7/" }
  ]
};
