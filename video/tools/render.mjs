// 把 video/src/index.html 一格一格畫出來，接給 ffmpeg 壓成 MP4。
//   node video/tools/render.mjs feed                 → video/build/feed_silent.mp4
//   node video/tools/render.mjs story                → video/build/story_silent.mp4
//   node video/tools/render.mjs feed --stills 0.5,3,8.2   → video/build/stills/feed_3.00.png …
//   加 --from 8 --to 10 只錄一段（檢查用）
// 需要先在 repo 根目錄開 http server：python3 -m http.server 5173 --bind 127.0.0.1
import { createRequire } from "module";
import { spawn, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(here, "..", "build");
fs.mkdirSync(path.join(build, "stills"), { recursive: true });

const args = process.argv.slice(2);
const fmt = args[0] === "story" ? "story" : "feed";
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const base = process.env.BASE || "http://127.0.0.1:5173";
const ffmpeg = process.env.FFMPEG || execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();

const W = 1080, H = fmt === "story" ? 1920 : 1350;
const browser = await chromium.launch({ args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.text()); });
await page.goto(`${base}/video/src/index.html?fmt=${fmt}`);
await page.evaluate(() => window.READY);
const meta = await page.evaluate(() => window.META);
fs.writeFileSync(path.join(build, "timeline.json"), JSON.stringify(meta.T, null, 2));

async function frameAt(t) {
  await page.evaluate((tt) => window.draw(tt), t);
  return page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
}

const stills = opt("--stills");
if (stills) {
  for (const s of stills.split(",")) {
    const t = +s, buf = await frameAt(t);
    const f = path.join(build, "stills", `${fmt}_${t.toFixed(2)}.png`);
    fs.writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
  process.exit(0);
}

const from = +(opt("--from") ?? 0), to = +(opt("--to") ?? meta.DUR);
const out = opt("--out") || path.join(build, `${fmt}_silent${from > 0 || to < meta.DUR ? "_part" : ""}.mp4`);
const ff = spawn(ffmpeg, [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(meta.FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-tune", "film",
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
  "-movflags", "+faststart", out
], { stdio: ["pipe", "inherit", "inherit"] });
const n0 = Math.round(from * meta.FPS), n1 = Math.round(to * meta.FPS);
const t0 = Date.now();
for (let i = n0; i < n1; i++) {
  const buf = await frameAt(i / meta.FPS);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 30 === 0) console.log(`${fmt} frame ${i}/${n1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("wrote", out, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
