#!/usr/bin/env python3
"""Persist up to ten individually curated website photographs as optimized WebP."""
import io
import json
import pathlib
import time
import urllib.error
import urllib.request
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "web-photos.json"
OUT = ROOT / "assets" / "recipes" / "web"
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads(CATALOG.read_text(encoding="utf-8"))
candidates = []
for recipe_id, record in data["byRecipe"].items():
    for photo in record.get("candidates", []):
        if photo.get("status") == "web-curated" and not photo.get("path", "").startswith("assets/"):
            candidates.append((recipe_id, photo))
if len(candidates) > 10:
    raise SystemExit(f"Only 10 pending images per batch are allowed, found {len(candidates)}")
processed = 0
failures = []
for recipe_id, photo in candidates:
    url = photo["originalUrl"]
    if not (url.startswith("https://images.pexels.com/photos/") or
            url.startswith("https://upload.wikimedia.org/wikipedia/commons/")):
        raise SystemExit(f"Unapproved image host for {recipe_id}")
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Shakerrr/1.0 image-curation"})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    if not response.headers.get("content-type", "").startswith("image/"):
                        raise ValueError("non-image response")
                    image_bytes = response.read(24_000_001)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as retry_error:
                if attempt == 4 or (isinstance(retry_error, urllib.error.HTTPError)
                                    and retry_error.code not in (429, 500, 502, 503, 504)):
                    raise
                time.sleep(3 * (attempt + 1))
        if not (10000 < len(image_bytes) < 24_000_000):
            raise ValueError("unexpected image size")
        with Image.open(io.BytesIO(image_bytes)) as raw:
            if raw.width < 900 or raw.height < 900:
                raise ValueError("source photo too small")
            im = ImageOps.exif_transpose(raw).convert("RGB")
            im = ImageOps.fit(im, (1200, 1500), method=Image.Resampling.LANCZOS, centering=(.5, .44))
            path = OUT / (recipe_id + ".webp")
            im.save(path, format="WEBP", quality=84, method=6)
            im.close()
        photo["path"] = path.relative_to(ROOT).as_posix()
        photo["width"], photo["height"] = 1200, 1500
        processed += 1
        print(f"{recipe_id}: saved {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")
        time.sleep(1.3)
    except Exception as exc:
        print(f"{recipe_id}: NOT persisted ({exc})", flush=True)
        failures.append({"recipeId": recipe_id, "error": str(exc), "image": photo.get("sourceUrl")})
report = ROOT / "data" / "web-photo-download-failures.json"
report.write_text(json.dumps({"failures": failures, "processed": processed}, indent=2) + "\n",
                  encoding="utf-8")
if processed:
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
else:
    print("No image assets persisted; web-photo URLs remain as originally curated.")
