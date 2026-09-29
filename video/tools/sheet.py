# 把幾張截圖拼成一張（檢查用）：python3 video/tools/sheet.py out.png cols scale img1 img2 ...
import sys
from PIL import Image, ImageDraw
out, cols, scale, files = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4:]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = int(ims[0].width * scale), int(ims[0].height * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6), (255, 255, 255))
for i, im in enumerate(ims):
    x, y = (i % cols) * (w + 6), (i // cols) * (h + 6)
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    d = ImageDraw.Draw(sheet); d.text((x + 8, y + 6), files[i].split("_")[-1].replace(".png", ""), fill=(255, 80, 80))
sheet.save(out)
