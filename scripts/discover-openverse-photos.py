#!/usr/bin/env python3
"""Find licensed cocktail photo candidates across Openverse providers.

Search only. No photos are published or downloaded without source and visual review.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]
API = "https://api.openverse.org/v1/images/"
AGENT = "ShakerrrPhotoResearch/1.0 (https://github.com/FusorXE/shakerrr-site)"
LICENSES = {"cc0", "pdm", "by", "by-sa"}
BAD = re.compile(r"\b(city|cityscape|skyline|magazine|logo|recipe card|bottle|menu|illustration|poster|motorcycle|skull|costume|bird species)\b", re.I)
DRINK = re.compile(r"\b(cocktail|coctail|mixed drink|drinks|beverage|bartending)\b", re.I)
PRIORITY = ["mai-tai", "dark-and-stormy", "bramble", "bees-knees", "bellini",
            "blood-and-sand", "bamboo", "bijou", "black-velvet", "batanga",
            "pisco-sour", "gimlet", "negroni", "daiquiri", "clover-club"]
def clean(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()
def canonical():
    js = ("import fs from 'node:fs';"
          "import {normalizeCatalog} from './src/catalog-model.js';"
          "const d=JSON.parse(fs.readFileSync('data/recipes.json','utf8'));"
          "console.log(JSON.stringify(normalizeCatalog(d).recipes.map(x=>({id:x.id,name:x.name}))));")
    return json.loads(subprocess.run(
        ["node", "--input-type=module", "-e", js],
        cwd=ROOT, text=True, capture_output=True, check=True).stdout)
def search(name):
    params = {
        "q": name + " cocktail",
        "license": "cc0,pdm,by,by-sa",
        "page_size": "16",
        "filter_dead": "true",
    }
    request = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                     headers={"User-Agent": AGENT, "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=28) as response:
                return json.load(response).get("results", [])
        except (TimeoutError, urllib.error.HTTPError, urllib.error.URLError) as error:
            print(f"Openverse search {name}: {error}", file=sys.stderr)
            if attempt == 2 or isinstance(error, urllib.error.HTTPError) and error.code not in (429, 500, 502, 503, 504):
                return []
            time.sleep(5 * (attempt + 1))
    return []
def candidate(name, row):
    title = str(row.get("title") or "")
    tags = " ".join(str(x.get("name") or "") for x in row.get("tags") or [])
    lookup = clean(title + " " + tags)
    wanted = clean(name)
    if not wanted or row.get("license") not in LICENSES:
        return None
    if row.get("source") in ("pexels", "unsplash"):
        return None
    if row.get("category") not in ("photograph", None):
        return None
    if BAD.search(title) or not DRINK.search(title + " " + tags):
        return None
    if int(row.get("width") or 0) < 1200 or int(row.get("height") or 0) < 1200:
        return None
    title_clean = clean(title)
    if wanted in title_clean:
        score = 72
    elif wanted in lookup:
        score = 48
    elif all(t in lookup.split() for t in wanted.split()):
        score = 37
    else:
        return None
    if DRINK.search(title):
        score += 10
    if min(row["width"], row["height"]) >= 1600:
        score += 5
    original = row.get("url") or ""
    source = row.get("foreign_landing_url") or ""
    if not original.startswith("https://") or not source.startswith("https://"):
        return None
    code = row["license"].upper().replace("BY", "BY")
    version = row.get("license_version") or ""
    label = ("CC0" if code == "CC0" else "Public domain" if code == "PDM"
             else "CC " + code + " " + version)
    return {
        "title": title[:150], "matchScore": score,
        "url": original, "preview": row.get("thumbnail"),
        "sourceUrl": source, "source": row.get("source"),
        "creator": row.get("creator"), "license": label,
        "licenseUrl": row.get("license_url"), "attribution": row.get("attribution"),
        "width": row["width"], "height": row["height"],
        "reviewStatus": "pending-source-license-and-visual-review",
    }
def run(offset, limit):
    web = json.loads((ROOT / "data/web-photos.json").read_text(encoding="utf8"))
    used = set(web.get("byRecipe", {}))
    commons_path = ROOT / "data/commons-image-review.json"
    commons = json.loads(commons_path.read_text(encoding="utf8")) if commons_path.exists() else {}
    has_commons = {r["recipeId"] for r in commons.get("reviewed", []) if r.get("choices")}
    catalog = canonical()
    available = {x["id"]: x for x in catalog if x["id"] not in used}
    ordered = []
    for slug in PRIORITY:
        if slug in available:
            ordered.append(available.pop(slug))
    others = sorted(available.values(), key=lambda x: (x["id"] in has_commons, x["name"]))
    ordered.extend(others)
    chosen = ordered[offset:offset + limit]
    records = []
    for i, recipe in enumerate(chosen):
        print(f"Openverse [{i + 1}/{len(chosen)}]: {recipe['name']}", flush=True)
        images = [x for x in (candidate(recipe["name"], obj) for obj in search(recipe["name"])) if x]
        images.sort(key=lambda x: (-x["matchScore"], x["title"]))
        records.append({"recipeId": recipe["id"], "recipeName": recipe["name"], "choices": images[:5]})
        time.sleep(3.2)  # Anonymous rate cap: maximum about 20 requests/minute.
    output = ROOT / "data/openverse-image-review.json"
    output.write_text(json.dumps({
        "source": "Openverse open-licensed media API", "status": "research-only",
        "policy": "Verify original source, actual CC terms and visible drink before importing.",
        "catalogSize": len(catalog), "alreadyWebCurated": len(used),
        "searched": records,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(f"Openverse: {len(records)} searched; {sum(bool(x['choices']) for x in records)} with candidates")
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--limit", type=int, default=24)
    args = p.parse_args()
    if args.offset < 0 or not 1 <= args.limit <= 50:
        p.error("offset >= 0 and limit in 1..50 required")
    run(args.offset, args.limit)
