# 2 號 普二一競選團 · 學生會選舉網站

會長候選人 **張芝穎**、副會長候選人 **陳奕璁** 的競選網站。

純 HTML / CSS / JavaScript，沒有建置步驟，直接用 GitHub Pages 發佈。
（GSAP、Lenis、three.js 從 CDN 載入。）

## 要改內容

所有文字都在 **`js/config.js`**：名字、介紹、政見、投票日期（`voteDate`）、IG 連結、收願望的信箱（`wishEmail`）。

## 願望寄到信箱

同學在「寫下你的願望」送出的內容，會透過 [FormSubmit](https://formsubmit.co) 寄到 `js/config.js` 裡 `wishEmail` 設定的信箱：

- `to`：主要收件人
- `cc`：副本

**第一次有人送出願望時**，FormSubmit 會寄一封「Activate Form」的確認信到 `to` 的信箱，
**按下信裡的確認按鈕**之後，之後每一個願望才會真的寄出。（沒確認之前，網站會顯示「信箱還在等待確認」。）

寄信的程式都在 `js/wishStore.js`；之後要換成自己的後端，只改這個檔案就好。

## 3D 模型

`blender/` 裡的 Python 腳本用 Blender 產生權杖和花的模型（`assets/*.glb` 和 `js/*-model.js`）。
要改模型請改腳本再重新執行，不要直接改產生出來的檔案。

## 3D 花田（政綱）

電腦和手機都會先檢查硬體（`js/policy3d.js` 的 `checkHardware`）：跑得動就用 3D 花田，跑不動就用一般的政綱卡片。
會被判定「跑不動」的：沒有用到顯示卡（軟體繪圖）、開了省流量模式、手機記憶體少於 4 GB、入門級的手機顯示晶片，
或是上次在這台裝置上即使降到最低解析度還是很卡（會記在瀏覽器裡，下次直接用卡片）。

測試用：網址加 `?3d=on` 強制開、`?3d=off` 強制關（`?3d=on` 也會清掉「上次太慢」的紀錄）。
瀏覽器的 Console 會寫出這次為什麼開 / 關。

## 在自己電腦上預覽

```bash
python -m http.server 5173
```

然後打開 http://localhost:5173
