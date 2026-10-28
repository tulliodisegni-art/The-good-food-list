"""Génère les icônes : une plaque de rue bleue avec « GF »."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

def icon(size, path, pad=0.0):
    img = Image.new("RGB", (size, size), "#1d3b78")
    d = ImageDraw.Draw(img)
    m = int(size * (0.12 + pad))
    r = int(size * 0.07)
    d.rounded_rectangle([m, m, size - m, size - m], radius=r, outline="#ffffff", width=max(2, size // 40))
    f = ImageFont.truetype(FONT, int(size * (0.34 - pad)))
    d.text((size / 2, size / 2 - size * 0.03), "GF", font=f, fill="#ffffff", anchor="mm")
    s = ImageFont.truetype(FONT, int(size * (0.075 - pad / 6)))
    d.text((size / 2, size - m - size * 0.11), "PARIS", font=s, fill="#c9d6f0", anchor="mm")
    img.save(path)

OUT.mkdir(exist_ok=True)
icon(192, OUT / "icon-192.png")
icon(512, OUT / "icon-512.png", pad=0.04)
icon(180, OUT / "apple-touch-icon.png")
