# 從 Google Fonts 下載影片用的字型（完整的 TTF）到 video/src/fonts/
import os, re, subprocess
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "src", "fonts")
os.makedirs(out, exist_ok=True)
url = ("https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&family=Chiron+Hei+HK:wght@900"
       "&family=Cormorant+Garamond:ital,wght@1,600&family=LXGW+WenKai+TC:wght@700&family=Noto+Sans+TC:wght@500;700")
css = subprocess.run(["curl", "-sS", url], check=True, capture_output=True, text=True).stdout
for b in re.findall(r"@font-face \{(.*?)\}", css, re.S):
    fam = re.search(r"font-family: '(.*?)'", b).group(1)
    w = re.search(r"font-weight: (\d+)", b).group(1)
    it = "i" if "italic" in re.search(r"font-style: (\w+)", b).group(1) else ""
    src = re.search(r"url\((.*?)\)", b).group(1)
    fn = os.path.join(out, f"{fam.replace(' ', '')}-{w}{it}.ttf")
    if not os.path.exists(fn):
        subprocess.run(["curl", "-sS", "-o", fn, src], check=True)
    print(fn)
