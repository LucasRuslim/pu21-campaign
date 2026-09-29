#!/usr/bin/env bash
# 影片的工具：Python（numpy/scipy 做音樂、imageio-ffmpeg 壓影片）、three.js（算權杖的 3D 圖）、字型
set -e
cd "$(dirname "$0")"
pip install -q numpy scipy pillow imageio-ffmpeg
npm install --silent
python3 tools/get-fonts.py >/dev/null
# 本機 http server（從 repo 根目錄開，影片頁面要讀 ../../assets）
if ! curl -s -o /dev/null http://127.0.0.1:5173/video/src/index.html; then
  (cd .. && nohup python3 -m http.server 5173 --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1
fi
[ -f build/staff/meta.json ] || node tools/render-staff.mjs
echo "setup done"
