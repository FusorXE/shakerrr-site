#!/usr/bin/env python3
"""Render small contact sheets of persisted cocktail images for visual auditing."""
import json
import pathlib
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "review"
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads((ROOT / "data/web-photos.json").read_text(encoding="utf8"))
photos = []
for recipe_id, record in sorted(data["byRecipe"].items()):
    photo = record["candidates"][0]
    image_path = ROOT / photo.get("path", "")
    if photo["path"].startswith("assets/recipes/web/") and image_path.is_file():
        photos.append((recipe_id, image_path, photo))
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except OSError:
    font = ImageFont.load_default()
for start in range(0, len(photos), 9):
    sheet = Image.new("RGB", (570, 720), "#11141a")
    draw = ImageDraw.Draw(sheet)
    for idx, (recipe_id, image_path, photo) in enumerate(photos[start:start + 9]):
        row, col = divmod(idx, 3)
        x, y = col * 190, row * 240
        try:
            with Image.open(image_path) as source:
                thumb = ImageOps.fit(source.convert("RGB"), (172, 194),
                                     method=Image.Resampling.LANCZOS)
                sheet.paste(thumb, (x + 9, y + 6))
            draw.rectangle([x + 6, y + 200, x + 184, y + 238], fill="#101010")
            draw.text((x + 9, y + 201), recipe_id[:23], font=font, fill="white")
            draw.text((x + 9, y + 216), photo["source"].split(" · ")[0][:20],
                      font=font, fill="#c4a47f")
        except OSError:
            draw.text((x + 12, y + 80), "FAILED: " + recipe_id[:16], font=font,
                      fill="#ff7777")
    target = OUT / f"web-photos-{start // 9 + 1:02d}.jpg"
    sheet.save(target, format="JPEG", quality=56, optimize=True)
    print(f"Contact sheet: {target.relative_to(ROOT)} ({target.stat().st_size:,} bytes)")
