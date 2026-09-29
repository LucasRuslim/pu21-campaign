// 把權杖的 3D 模型轉一圈，存成 72 張 PNG（video/build/staff/000.png …），影片裡直接貼圖。
// 用法：node video/tools/render-staff.mjs   （需要先啟動 video/tools/serve.mjs 或任何從 repo 根目錄開的 http server）
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "build", "staff");
fs.mkdirSync(outDir, { recursive: true });

const base = process.env.BASE || "http://127.0.0.1:5173";
const N = +(process.env.N || 72);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 700, height: 2000 } });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(`${base}/video/tools/staff-turntable.html?w=600&h=1900`);
await page.waitForFunction(() => window.meta, null, { timeout: 60000 });
const meta = await page.evaluate(() => window.meta);
fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({ ...meta, frames: N }, null, 2));
console.log("meta", meta);
for (let i = 0; i < N; i++) {
  const url = await page.evaluate((d) => window.renderAngle(d), (i * 360) / N);
  fs.writeFileSync(path.join(outDir, String(i).padStart(3, "0") + ".png"), Buffer.from(url.split(",")[1], "base64"));
}
await browser.close();
console.log("done", N, "frames →", outDir);
