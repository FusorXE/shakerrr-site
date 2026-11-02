#!/usr/bin/env python3
"""Discover strictly attributed Wikimedia Commons cocktail photo candidates.

Discovery NEVER changes the live photo manifest. A photograph must be visually
reviewed for the exact drink and licensed before being approved separately.
"""
import argparse
import html
from html.parser import HTMLParser
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "ShakerrrPhotoDiscovery/1.0 (https://github.com/FusorXE/shakerrr-site)"
PRIORITY = [
    "daiquiri", "cosmopolitan", "mai-tai", "manhattan", "tom-collins",
    "sidecar", "gimlet", "jungle-bird", "paper-plane", "white-russian",
    "sazerac", "aviation", "zombie", "margarita", "negroni",
    "french-75", "moscow-mule", "dark-and-stormy", "sex-on-the-beach",
    "rum-punch", "mai tai", "bramble", "screwdriver", "sea-breeze",
    "long-island-iced-tea", "gin-and-tonic", "clover-club",
]
BAD_TYPES = re.compile(r"\b(menu|poster|diagram|logo|label|book|recipe card|drawing|illustration|bottle only|packaging)\b", re.I)
ACCEPTABLE_LICENSES = {
    "CC0", "Public domain", "CC BY 4.0", "CC BY 3.0", "CC BY 2.0",
    "CC BY-SA 4.0", "CC BY-SA 3.0", "CC BY-SA 2.0",
}

class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
    def handle_data(self, value):
        self.text.append(value)

def plain(value):
    parser = PlainHTML()
    parser.feed(str(value or ""))
    return html.unescape(" ".join(parser.text)).strip()[:600]

def clean(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()

def meta(info, field):
    return plain((info.get("extmetadata") or {}).get(field, {}).get("value", ""))

def canonical_recipes():
    js = (
        "import fs from 'node:fs';"
        "import {normalizeCatalog} from './src/catalog-model.js';"
        "const data=JSON.parse(fs.readFileSync('data/recipes.json','utf8'));"
        "console.log(JSON.stringify(normalizeCatalog(data).recipes.map(x=>({id:x.id,name:x.name}))));"
    )
    p = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT,
                       text=True, capture_output=True, check=True)
    return json.loads(p.stdout)

def get_images(name):
    args = {
        "action": "query", "format": "json", "generator": "search",
        "gsrnamespace": "6", "gsrlimit": "12",
        "gsrsearch": '"' + name.replace('"', "") + '" filetype:bitmap',
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": "540",
    }
    url = API + "?" + urllib.parse.urlencode(args)
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.load(response).get("query", {}).get("pages", {})
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == 2:
                print(f"Search failed for {name}: {exc}", file=sys.stderr)
                return {}
            time.sleep(2 * (attempt + 1))
    return {}

def score_image(name, page):
    ii = (page.get("imageinfo") or [None])[0]
    if not ii or ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
        return None
    if min(int(ii.get("width", 0)), int(ii.get("height", 0))) < 1000:
        return None
    license_name = meta(ii, "LicenseShortName")
    if license_name not in ACCEPTABLE_LICENSES:
        return None
    title = page.get("title", "").replace("File:", "").rsplit(".", 1)[0]
    photo_desc = meta(ii, "ImageDescription")
    title_clean, name_clean = clean(title), clean(name)
    if not name_clean:
        return None
    if BAD_TYPES.search(title):
        return None
    score = 0
    if name_clean in title_clean:
        score += 65
    elif all(token in title_clean.split() for token in name_clean.split()):
        score += 50
    elif name_clean in clean(photo_desc):
        score += 37
    else:
        return None
    if "cocktail" in title_clean or "drink" in title_clean:
        score += 10
    if "cocktail" in clean(photo_desc):
        score += 6
    if min(ii["width"], ii["height"]) >= 1600:
        score += 7
    image_url = ii.get("url", "")
    if not image_url.startswith("https://upload.wikimedia.org/"):
        return None
    return {
        "title": page.get("title"), "matchScore": score,
        "url": image_url, "preview": ii.get("thumburl", image_url),
        "sourceUrl": ii.get("descriptionurl"),
        "width": ii["width"], "height": ii["height"],
        "license": license_name, "licenseUrl": meta(ii, "LicenseUrl"),
        "artist": meta(ii, "Artist"), "credit": meta(ii, "Credit"),
        "description": photo_desc[:320],
        "reviewStatus": "pending-visual-review",
    }

def run(offset, limit, output):
    live = json.loads((ROOT / "data/web-photos.json").read_text(encoding="utf-8"))
    used = set(live.get("byRecipe", {}))
    catalog = canonical_recipes()
    by_id = {r["id"]: r for r in catalog}
    ordered = []
    for candidate in PRIORITY:
        key = candidate.replace(" ", "-")
        if key in by_id and key not in used:
            ordered.append(by_id[key])
    ordered += sorted((x for x in catalog if x["id"] not in used
                       and x["id"] not in {y["id"] for y in ordered}),
                      key=lambda x: x["name"])
    selected = ordered[offset: offset + limit]
    candidates = []
    for i, recipe in enumerate(selected):
        print(f"[{i+1}/{len(selected)}] {recipe['name']}", flush=True)
        pages = get_images(recipe["name"])
        matches = []
        for page in pages.values():
            item = score_image(recipe["name"], page)
            if item:
                matches.append(item)
        matches.sort(key=lambda x: (-x["matchScore"], x["title"]))
        candidates.append({
            "recipeId": recipe["id"], "recipeName": recipe["name"],
            "choices": matches[:5],
        })
        time.sleep(0.5)  # Respect Wikimedia API request cadence.
    payload = {
        "source": "Wikimedia Commons API", "status": "research-only",
        "policy": "NOT approved for website display. Confirm cocktail, crop, license, attribution before publishing.",
        "offset": offset, "limit": limit,
        "catalogSize": len(catalog),
        "alreadyWebCurated": len(used),
        "reviewed": candidates,
    }
    target = ROOT / output
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
    print(f"Saved {len(candidates)} recipe searches; "
          f"{sum(bool(x['choices']) for x in candidates)} returned eligible photo candidates")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--output", default="data/commons-image-review.json")
    args = parser.parse_args()
    if args.offset < 0 or not 1 <= args.limit <= 25:
        parser.error("offset must be nonnegative and limit 1..25")
    run(args.offset, args.limit, args.output)
