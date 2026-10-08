#!/usr/bin/env python3
import hashlib
import json
import os
import re
import time
import unicodedata
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RECIPES_PATH = ROOT / "data" / "recipes.json"
MANIFEST_PATH = ROOT / "data" / "image-manifest.json"
ASSET_DIR = ROOT / "assets" / "recipes"
REPORT_PATH = ROOT / "source-data" / "source-enrichment-followup-report.json"
ASSET_DIR.mkdir(parents=True, exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; ShakerrrReferenceBuilder/1.1; +https://github.com/FusorXE/shakerrr-site)",
    "Accept-Language": "en-US,en;q=0.9",
})

recipes = json.loads(RECIPES_PATH.read_text())
manifest = json.loads(MANIFEST_PATH.read_text())
manifest.setdefault("byRecipe", {})
report = {
    "barsys_discovered": 0,
    "barsys_already_processed": 0,
    "barsys_processed_this_run": [],
    "barsys_remaining_after_run": 0,
    "liquor_versions": [],
    "liquor_images": [],
    "new_recipes": [],
    "errors": [],
}


def norm(value):
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    value = value.replace("&", " and ").replace("’", "'")
    value = re.sub(r"\b(the|cocktail|recipe)\b", " ", value)
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", norm(value)).strip("-")


ALIASES = {
    "pina colada": "pina colada",
    "naked famous": "naked and famous",
    "naked and famous": "naked and famous",
    "dark stormy": "dark n stormy",
    "dark and stormy": "dark n stormy",
    "oaxacan old fashioned": "oaxaca old fashioned",
    "oaxaca old fashioned": "oaxaca old fashioned",
}


def name_key(value):
    n = norm(value)
    return ALIASES.get(n, n)


def find_recipe(name):
    key = name_key(name)
    for recipe in recipes:
        if name_key(recipe.get("name")) == key:
            return recipe
    return None


def make_recipe(name, category="Modern", country=None):
    recipe = {
        "id": slug(name),
        "name": name,
        "category": category,
        "country": country,
        "method": "Build",
        "family": "Other",
        "tags": [],
        "versions": [],
        "image": None,
        "movie": None,
        "collections": [],
        "ingredients": [],
        "instructions": "",
        "note": "",
        "quality": "verified",
    }
    recipes.append(recipe)
    report["new_recipes"].append(name)
    return recipe


def fetch(url, timeout=30):
    response = SESSION.get(url, timeout=timeout, allow_redirects=True)
    response.raise_for_status()
    return response


def soup(url):
    response = fetch(url)
    return BeautifulSoup(response.text, "html.parser"), response.url


def iter_jsonld(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from iter_jsonld(value)
    elif isinstance(node, list):
        for value in node:
            yield from iter_jsonld(value)


def jsonld_recipe(document):
    for tag in document.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or tag.get_text() or "null")
        except Exception:
            continue
        for obj in iter_jsonld(data):
            typ = obj.get("@type")
            types = typ if isinstance(typ, list) else [typ]
            if "Recipe" in types and obj.get("name"):
                return obj
    return None


def instruction_text(value):
    output = []
    def walk(item):
        if isinstance(item, str):
            output.append(item.strip())
        elif isinstance(item, dict):
            if item.get("text"):
                output.append(str(item["text"]).strip())
            elif item.get("name") and item.get("@type") == "HowToStep":
                output.append(str(item["name"]).strip())
            for child in item.get("itemListElement", []) or []:
                walk(child)
        elif isinstance(item, list):
            for child in item:
                walk(child)
    walk(value)
    return " ".join(x for x in output if x)


def parse_ingredient(line):
    line = re.sub(r"\s+", " ", (line or "").strip(" \t\n•-"))
    if not line:
        return None
    match = re.match(
        r"^((?:\d+(?:[./]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]?)(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?\s*(?:oz|ounce(?:s)?|ml|cl|tsp|tbsp|bar ?spoon(?:s)?|dash(?:es)?|drop(?:s)?|cup(?:s)?|part(?:s)?|piece(?:s)?|slice(?:s)?|sprig(?:s)?|leaf|leaves)?)\s+(.+)$",
        line,
        re.I,
    )
    if match:
        return {"amount": match.group(1).strip(), "name": match.group(2).strip()}
    return {"amount": "", "name": line}


def image_from_obj(obj):
    image = (obj or {}).get("image")
    if isinstance(image, str):
        return image
    if isinstance(image, list) and image:
        first = image[0]
        return first if isinstance(first, str) else first.get("url") or first.get("contentUrl")
    if isinstance(image, dict):
        return image.get("url") or image.get("contentUrl")
    return None


def og_image(document):
    tag = document.find("meta", attrs={"property": "og:image"}) or document.find("meta", attrs={"name": "twitter:image"})
    return tag.get("content") if tag else None


def parse_recipe_page(url):
    document, final = soup(url)
    obj = jsonld_recipe(document)
    if not obj:
        return None, document, final
    ingredients = [x for x in (parse_ingredient(v) for v in obj.get("recipeIngredient", []) or []) if x]
    author = obj.get("author")
    author_name = author.get("name", "") if isinstance(author, dict) else ""
    return {
        "name": re.sub(r"\s+Recipe\s*$", "", str(obj.get("name", "")), flags=re.I).strip(),
        "ingredients": ingredients,
        "instructions": instruction_text(obj.get("recipeInstructions")),
        "description": re.sub(r"\s+", " ", BeautifulSoup(str(obj.get("description", "")), "html.parser").get_text(" ")).strip(),
        "author": author_name,
        "image": image_from_obj(obj) or og_image(document),
    }, document, final


def section_after_heading(document, needle):
    heading = next((h for h in document.find_all(re.compile("^h[1-6]$")) if needle.lower() in h.get_text(" ", strip=True).lower()), None)
    if not heading:
        return []
    values = []
    for element in heading.find_all_next():
        if element is heading:
            continue
        if element.name and re.match(r"^h[1-6]$", element.name):
            break
        if element.name in ("li", "p"):
            text = re.sub(r"\s+", " ", element.get_text(" ", strip=True))
            if text and text not in values:
                values.append(text)
    return values


def short_summary(text, max_words=28):
    clean = re.sub(r"\s+", " ", text or "").strip()
    return " ".join(clean.split()[:max_words]).strip()


def add_collection(recipe, collection):
    recipe.setdefault("collections", [])
    if collection and collection not in recipe["collections"]:
        recipe["collections"].append(collection)


def upsert_version(recipe, version):
    versions = recipe.setdefault("versions", [])
    key = version.get("key")
    for index, existing in enumerate(versions):
        if existing.get("key") == key:
            versions[index] = version
            return
    versions.append(version)


def current_candidate(recipe):
    entry = manifest.get("byRecipe", {}).get(recipe.get("id"), {})
    return next((c for c in entry.get("candidates", []) if c.get("path") == recipe.get("image")), None)


def should_replace_primary(recipe, source):
    if not recipe.get("image"):
        return True
    current = current_candidate(recipe)
    if not current:
        return True
    current_source = (current.get("source") or "").lower()
    if current.get("status") == "recipe-matched" or current.get("sharedVisualFrom"):
        return True
    if current.get("status") == "exact-book" or any(word in current_source for word in (
        "essential cocktail", "death & co", "tropical standard", "agave companion", "cocktails from movies", "hollywood"
    )):
        return True
    # Between exact external images, keep the user's preferred current hierarchy unless the new source is Liquor.com.
    return source == "Liquor.com" and "liquor.com" not in current_source and "difford" not in current_source


def unwrap_barsys_image(url):
    if not url:
        return url
    parsed = urlparse(url)
    if parsed.netloc.endswith("api.barsys.com") and parsed.path.endswith("/api/optimizeImage"):
        raw = parse_qs(parsed.query).get("fileUrl", [None])[0]
        if raw:
            return unquote(raw)
    return url


def save_image(recipe, image_url, source, source_url, evidence, prefer=True):
    image_url = unwrap_barsys_image(image_url)
    if not image_url or not image_url.startswith("http"):
        return None
    target = ASSET_DIR / f"{recipe['id']}__{slug(source)[:28]}.webp"
    try:
        response = fetch(image_url, timeout=40)
        image = Image.open(BytesIO(response.content)).convert("RGB")
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=90, method=6)
        body = target.read_bytes()
        relative = str(target.relative_to(ROOT)).replace(os.sep, "/")
        candidate = {
            "id": recipe["id"],
            "source": source,
            "sourceUrl": source_url,
            "evidence": evidence,
            "path": relative,
            "available": True,
            "status": "verified-external",
            "width": image.width,
            "height": image.height,
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
        }
        entry = manifest["byRecipe"].setdefault(recipe["id"], {"name": recipe["name"], "candidates": []})
        entry["name"] = recipe["name"]
        entry.setdefault("candidates", [])
        entry["candidates"] = [c for c in entry["candidates"] if c.get("path") != relative]
        entry["candidates"].append(candidate)
        if prefer and should_replace_primary(recipe, source):
            recipe["image"] = relative
        return relative
    except Exception as exc:
        report["errors"].append(f"image {recipe['name']} <- {image_url}: {exc}")
        return None


def complete_recipe_from_version(recipe, version):
    if not recipe.get("ingredients") and version.get("ingredients"):
        recipe["ingredients"] = version["ingredients"]
    if not recipe.get("instructions") and version.get("instructions"):
        recipe["instructions"] = version["instructions"]
    if not recipe.get("note") and version.get("note"):
        recipe["note"] = version["note"]


# ---------------- Barsys continuation ----------------
def discover_barsys():
    recipe_urls = set()
    mixlist_urls = set()
    for listing in (
        "https://barsys.com/collection-recipes",
        "https://barsys.com/mixlists",
        "https://us.barsys.com/recipes",
        "https://us.barsys.com/mixlists",
    ):
        try:
            document, final = soup(listing)
            for anchor in document.find_all("a", href=True):
                url = urljoin(final, anchor["href"]).split("?")[0].rstrip("/")
                if "/recipe/" in url:
                    recipe_urls.add(url)
                elif "/mixlist/" in url:
                    mixlist_urls.add(url)
            for path in re.findall(r"/(?:recipe|mixlist)/[a-z0-9][a-z0-9-]+", str(document), re.I):
                url = urljoin("https://barsys.com", path).split("?")[0].rstrip("/")
                (recipe_urls if "/recipe/" in path else mixlist_urls).add(url)
        except Exception as exc:
            report["errors"].append(f"Barsys listing {listing}: {exc}")
    try:
        xml = fetch("https://barsys.com/sitemap.xml", 20).text
        locs = re.findall(r"<loc>([^<]+)</loc>", xml)
        all_locs = list(locs)
        child_maps = [x for x in locs if "sitemap" in x and x.endswith(".xml")][:30]
        for child in child_maps:
            try:
                all_locs.extend(re.findall(r"<loc>([^<]+)</loc>", fetch(child, 20).text))
            except Exception as exc:
                report["errors"].append(f"Barsys child sitemap {child}: {exc}")
        for url in all_locs:
            clean = url.split("?")[0].rstrip("/")
            if "/recipe/" in clean:
                recipe_urls.add(clean)
            elif "/mixlist/" in clean:
                mixlist_urls.add(clean)
    except Exception as exc:
        report["errors"].append(f"Barsys sitemap: {exc}")
    return sorted(recipe_urls), sorted(mixlist_urls)


def barsys_processed_urls():
    values = set()
    for recipe in recipes:
        for version in recipe.get("versions", []):
            if version.get("key") == "barsys" and version.get("url"):
                values.add(version["url"].split("?")[0].rstrip("/"))
    return values


def mixlist_context(mixlist_urls):
    by_recipe = {}
    for url in mixlist_urls:
        try:
            document, final = soup(url)
            h1 = document.find("h1")
            title = re.sub(r"\s+", " ", h1.get_text(" ", strip=True) if h1 else url.rsplit("/", 1)[-1].replace("-", " ").title())
            for anchor in document.find_all("a", href=True):
                target = urljoin(final, anchor["href"]).split("?")[0].rstrip("/")
                if "/recipe/" in target:
                    by_recipe.setdefault(target, set()).add(title)
        except Exception as exc:
            report["errors"].append(f"Barsys mixlist {url}: {exc}")
        time.sleep(0.02)
    return by_recipe


def import_one_barsys(url, contexts):
    try:
        parsed, document, final = parse_recipe_page(url)
        h1 = document.find("h1")
        name = re.sub(r"\s+", " ", h1.get_text(" ", strip=True) if h1 else (parsed or {}).get("name", "")).strip()
        if not name or name.lower() in ("barsys", "loading recipes"):
            raise RuntimeError("missing cocktail name")
        if not parsed:
            parsed = {"name": name, "ingredients": [], "instructions": "", "description": "", "author": "", "image": og_image(document)}
        if not parsed.get("ingredients"):
            lines = section_after_heading(document, "What You'll Need")
            parsed["ingredients"] = [x for x in (parse_ingredient(line) for line in lines) if x and not re.search(r"^(ice|glass|garnish|pro tip)\s*:", x["name"], re.I)]
        if not parsed.get("instructions"):
            steps = section_after_heading(document, "How to Make") or section_after_heading(document, "Directions")
            parsed["instructions"] = " ".join(steps[:6])
        about = section_after_heading(document, "About")
        if about and not parsed.get("description"):
            parsed["description"] = " ".join(about[:3])
        parsed["image"] = parsed.get("image") or og_image(document)
        if not parsed.get("ingredients"):
            raise RuntimeError("no ingredients parsed")

        recipe = find_recipe(name) or make_recipe(name)
        collections = sorted(contexts.get(url, set()) | contexts.get(final.split("?")[0].rstrip("/"), set()))
        add_collection(recipe, f"Barsys · {collections[0]}" if collections else "Barsys Recipes")
        for extra in collections[1:]:
            add_collection(recipe, f"Barsys · {extra}")
        image_path = save_image(
            recipe,
            parsed.get("image"),
            "Barsys",
            final,
            f"Exact named-drink photograph on the Barsys recipe page for {recipe['name']}.",
            True,
        )
        context_note = f"Barsys collection: {', '.join(collections[:4])}." if collections else "Barsys published recipe."
        summary = short_summary(parsed.get("description"), 24)
        note = context_note + (f" Source summary: {summary}" if summary else "")
        version = {
            "label": "Barsys Version",
            "key": "barsys",
            "type": "Published Reference",
            "ingredients": parsed["ingredients"],
            "instructions": parsed.get("instructions") or "Follow the linked Barsys source for preparation details.",
            "note": note,
            "creator": parsed.get("author") or "Barsys",
            "usable": bool(parsed.get("instructions")),
            "image": image_path or recipe.get("image"),
            "url": final,
        }
        upsert_version(recipe, version)
        complete_recipe_from_version(recipe, version)
        report["barsys_processed_this_run"].append(recipe["name"])
    except Exception as exc:
        report["errors"].append(f"Barsys recipe {url}: {exc}")


def import_barsys_continuation(limit=320):
    recipe_urls, mixlist_urls = discover_barsys()
    processed = barsys_processed_urls()
    report["barsys_discovered"] = len(recipe_urls)
    report["barsys_already_processed"] = len(processed)
    remaining = [url for url in recipe_urls if url not in processed]
    contexts = mixlist_context(mixlist_urls)
    for url in remaining[:limit]:
        import_one_barsys(url, contexts)
        time.sleep(0.03)
    processed_now = len(report["barsys_processed_this_run"])
    report["barsys_remaining_after_run"] = max(0, len(remaining) - processed_now)


# ---------------- Liquor.com direct-page batch ----------------
LIQUOR_PAGES = {
    "Oaxaca Old Fashioned": "https://www.liquor.com/recipes/oaxacan-old-fashioned/",
    "Mezcal Last Word": "https://www.liquor.com/recipes/trato-hecho/",
    "Mezcal Negroni": "https://www.liquor.com/recipes/mezcal-negroni/",
    "Tia Mia": "https://www.liquor.com/tia-mia-cocktail-recipe-7484869",
    "Mezcal Paloma": "https://www.liquor.com/mezcal-paloma-cocktail-recipe-7484747",
    "Naked & Famous": "https://www.liquor.com/naked-famous-cocktail-recipe-5268208",
    "Mezcal Mule": "https://www.liquor.com/recipes/mezcal-mule/",
    "Smoke Show": "https://www.liquor.com/recipes/smoke-show/",
    "Polar Bear": "https://www.liquor.com/recipes/polar-bear/",
    "Ready Fire Aim": "https://www.liquor.com/recipes/ready-fire-aim/",
    "Smoke Follows Beauty": "https://www.liquor.com/smoke-follows-beauty-cocktail-recipe-5220390",
    "Division Bell": "https://www.liquor.com/division-bell-cocktail-recipe-5270691",
    "Loaded Pistol": "https://www.liquor.com/recipes/loaded-pistol/",
    "Haitian Divorce": "https://www.liquor.com/haitian-divorce-cocktail-recipe-6499854",
    "Smoke on the Water": "https://www.liquor.com/recipes/smoke-on-the-water/",
}

LIQUOR_IMAGES = {
    "Oaxaca Old Fashioned": "https://www.liquor.com/thmb/6VJbIZN6TTquXiuZKj1zEyaVmmU=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/oaxacan-old-fashioned-720x720-primary-06201e25c3094324b4b97449628b4eef.jpg",
    "Mezcal Last Word": "https://www.liquor.com/thmb/fye71cUr9yoPe5Dcq-Txqx2Ilkw=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/trato-hecho-720x720-primary-016ed40631dd488282bacf180b9efa20.jpg",
    "Mezcal Negroni": "https://www.liquor.com/thmb/oecubVgeyfhDd5oTdAFaxMEuJ_Q=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/mezcal-negroni-1500x1500-primary-6f6c472050a949c8a55aa07e1b5a2d1b.jpg",
    "Tia Mia": "https://www.liquor.com/thmb/SaOV9AK0NuEMpKjG7gqXeFvmXEI=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/Tia-Mia-1500x1500-hero-93c14afcb69f46849514488c0bc5560f.jpg",
    "Mezcal Paloma": "https://www.liquor.com/thmb/h8e_79Cj4aksGs_8EU6Wkd6yjew=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/mezcal-paloma-1500x1500-hero-8ea4b529c1994233a6a69b44f39d0ef9.jpg",
    "Naked & Famous": "https://www.liquor.com/thmb/wG7ukvP6jf2k5qhjY1tmxgKLGgE=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/naked-and-famous-720x720-primary-404c2eb76f954670b65ce03cdaefa825.jpg",
    "Mezcal Mule": "https://www.liquor.com/thmb/5FgmCJGDtbS0Py2HXV2KLzNkJm0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/mezcal-mule-720x720-primary-92945f7af1444eaaa8b70f40da119b6c.jpg",
    "Smoke Show": "https://www.liquor.com/thmb/5JZ0aCrk29pXj0syA3_vkXw7eec=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/Smoke-Show-1500x1500-hero-baf4a7077f864733840c14c97920012d.jpg",
    "Polar Bear": "https://www.liquor.com/thmb/w1zZfyTZxsWw4ZK-Y8C7hshDjrk=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/polar-bear-720x720-primary-72c92aaece964aebb42f2dfb935d402f.jpg",
    "Ready Fire Aim": "https://www.liquor.com/thmb/9izREbAHOvNwSvXgsag_YTmZ7BQ=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/ready-fire-aim-720x720-primary-c8366403c4a040dcb82ed434d23ee8a4.jpg",
    "Smoke Follows Beauty": "https://www.liquor.com/thmb/JW_ok--T1g9wX_641Xkm2LHf-Wc=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/smoke-follow-beauty-720x720-primary-d572e7f06c8c4a99a25f0de46d277c86.jpg",
    "Division Bell": "https://www.liquor.com/thmb/QFE-bWyFh6y7L7kJEows-dZ9S2k=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/division-bell-720x720-primary-1490c96136dd4514a9238eb30dde4a79.jpg",
    "Loaded Pistol": "https://www.liquor.com/thmb/n61Fb5eO8stWbyk4XIWF6C9Nry4=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/__opt__aboutcom__coeus__resources__content_migration__liquor__2019__11__25141249__Loaded-Pistol-credit-Arlene-Ibarra_article_720x7201-9bbbf222d7be494ea9f18a857b14579e.jpg",
    "Haitian Divorce": "https://www.liquor.com/thmb/pOLvJZykROC15v2O6bmankxYu-M=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/haitian-divorce-720x720-primary-e32cfdf11f4d4150816c9d5c5391f850.jpg",
    "Smoke on the Water": "https://www.liquor.com/thmb/OUYVoXmezsIZKgbR5ung2MvTe_0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/smoke-on-the-water-720x720-primary-a7c6b92874914d2ab2c34972cf2a013e.jpg",
}


def import_liquor_direct():
    for name, page_url in LIQUOR_PAGES.items():
        parsed = None
        final = page_url
        try:
            parsed, _document, final = parse_recipe_page(page_url)
        except Exception as exc:
            report["errors"].append(f"Liquor page {name}: {exc}")
        recipe = find_recipe(name)
        if recipe is None and parsed and parsed.get("ingredients"):
            recipe = make_recipe(name, category="Mezcal")
        if recipe is None:
            report["errors"].append(f"Liquor unresolved canonical recipe {name}")
            continue
        recipe["category"] = "Mezcal" if recipe.get("category") in (None, "Modern", "Other") else recipe.get("category")
        recipe.setdefault("tags", [])
        if "mezcal" not in recipe["tags"]:
            recipe["tags"].append("mezcal")
        add_collection(recipe, "Liquor.com Mezcal")
        image_url = (parsed or {}).get("image") or LIQUOR_IMAGES.get(name)
        image_path = save_image(
            recipe,
            image_url,
            "Liquor.com",
            final,
            f"Exact named-drink photograph published by Liquor.com for {name}.",
            True,
        )
        if image_path:
            report["liquor_images"].append(name)
        if parsed and parsed.get("ingredients"):
            version = {
                "label": "Liquor.com",
                "key": "liquorcom",
                "type": "Published Reference",
                "ingredients": parsed["ingredients"],
                "instructions": parsed.get("instructions") or "Follow the linked Liquor.com source for preparation details.",
                "note": short_summary(parsed.get("description"), 28),
                "creator": parsed.get("author") or "",
                "usable": bool(parsed.get("instructions")),
                "image": image_path or recipe.get("image"),
                "url": final,
            }
            upsert_version(recipe, version)
            complete_recipe_from_version(recipe, version)
            report["liquor_versions"].append(name)


import_barsys_continuation()
import_liquor_direct()

for recipe in recipes:
    recipe["collections"] = list(dict.fromkeys(recipe.get("collections", [])))
recipes.sort(key=lambda recipe: name_key(recipe.get("name")))
manifest["generated"] = "2026-10-08"
RECIPES_PATH.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n")
MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({
    "barsys_discovered": report["barsys_discovered"],
    "barsys_already_processed": report["barsys_already_processed"],
    "barsys_processed_this_run": len(report["barsys_processed_this_run"]),
    "barsys_remaining_after_run": report["barsys_remaining_after_run"],
    "liquor_versions": len(report["liquor_versions"]),
    "liquor_images": len(report["liquor_images"]),
    "new_recipes": len(report["new_recipes"]),
    "errors": len(report["errors"]),
}, indent=2))
if report["errors"]:
    print("Non-fatal errors:")
    for error in report["errors"][:50]:
        print(" -", error)
