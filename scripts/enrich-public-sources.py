#!/usr/bin/env python3
import hashlib
import json
import os
import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO

ROOT = Path(__file__).resolve().parents[1]
RECIPES_PATH = ROOT / "data" / "recipes.json"
MANIFEST_PATH = ROOT / "data" / "image-manifest.json"
ASSET_DIR = ROOT / "assets" / "recipes"
ASSET_DIR.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (compatible; ShakerrrReferenceBuilder/1.0; +https://github.com/FusorXE/shakerrr-site)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

recipes = json.loads(RECIPES_PATH.read_text())
manifest = json.loads(MANIFEST_PATH.read_text())
manifest.setdefault("byRecipe", {})
report = {"new": [], "enriched": [], "images": [], "versions": [], "skipped": [], "errors": []}


def norm(value):
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    value = value.replace("&", " and ").replace("’", "'")
    value = re.sub(r"\b(the|cocktail|recipe)\b", " ", value)
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", norm(value)).strip("-")


def find_recipe(name):
    n = norm(name)
    aliases = {
        "pina coladas": "pina colada",
        "mojitos": "mojito",
        "mint juleps": "mint julep",
        "black and white russians": "black russian",
        "dark and stormy": "dark n stormy",
        "earl grey bees knees": "earl grey bee s knees",
    }
    n = aliases.get(n, n)
    for r in recipes:
        rn = norm(r.get("name"))
        if rn == n or aliases.get(rn, rn) == n:
            return r
    return None


def fetch(url, timeout=25):
    r = SESSION.get(url, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    return r


def soup(url):
    r = fetch(url)
    return BeautifulSoup(r.text, "html.parser"), r.url


def iter_jsonld(node):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from iter_jsonld(v)
    elif isinstance(node, list):
        for v in node:
            yield from iter_jsonld(v)


def jsonld_recipe(s):
    for tag in s.find_all("script", attrs={"type": "application/ld+json"}):
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
    out = []
    def walk(v):
        if isinstance(v, str):
            out.append(v.strip())
        elif isinstance(v, dict):
            if v.get("text"):
                out.append(str(v["text"]).strip())
            elif v.get("name") and v.get("@type") == "HowToStep":
                out.append(str(v["name"]).strip())
            for x in v.get("itemListElement", []) or []:
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)
    walk(value)
    return " ".join(x for x in out if x)


def image_from_jsonld(obj):
    image = obj.get("image") if obj else None
    if isinstance(image, str):
        return image
    if isinstance(image, list) and image:
        first = image[0]
        return first if isinstance(first, str) else first.get("url")
    if isinstance(image, dict):
        return image.get("url") or image.get("contentUrl")
    return None


def og_image(s):
    tag = s.find("meta", attrs={"property": "og:image"}) or s.find("meta", attrs={"name": "twitter:image"})
    return tag.get("content") if tag else None


def parse_ingredient(line):
    line = re.sub(r"\s+", " ", (line or "").strip(" \t\n•-"))
    if not line:
        return None
    m = re.match(r"^((?:\d+(?:[./]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]?)(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?\s*(?:oz|ounce(?:s)?|ml|cl|tsp|tbsp|bar ?spoon(?:s)?|dash(?:es)?|drop(?:s)?|cup(?:s)?|part(?:s)?|piece(?:s)?|slice(?:s)?|sprig(?:s)?|leaf|leaves)?)\s+(.+)$", line, re.I)
    if m:
        return {"amount": m.group(1).strip(), "name": m.group(2).strip()}
    return {"amount": "", "name": line}


def parsed_jsonld(url):
    s, final = soup(url)
    obj = jsonld_recipe(s)
    if not obj:
        return None, s, final
    ingredients = [x for x in (parse_ingredient(v) for v in obj.get("recipeIngredient", []) or []) if x]
    return {
        "name": re.sub(r"\s+Recipe\s*$", "", obj.get("name", ""), flags=re.I).strip(),
        "ingredients": ingredients,
        "instructions": instruction_text(obj.get("recipeInstructions")),
        "image": image_from_jsonld(obj) or og_image(s),
        "description": re.sub(r"\s+", " ", BeautifulSoup(str(obj.get("description", "")), "html.parser").get_text(" ")).strip(),
        "author": (obj.get("author") or {}).get("name", "") if isinstance(obj.get("author"), dict) else "",
    }, s, final


def section_after_heading(s, label):
    h = next((x for x in s.find_all(re.compile("^h[1-6]$")) if label.lower() in x.get_text(" ", strip=True).lower()), None)
    if not h:
        return []
    out = []
    for el in h.find_all_next():
        if el is h:
            continue
        if el.name and re.match(r"^h[1-6]$", el.name):
            break
        if el.name in ("li", "p"):
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            if text and text not in out:
                out.append(text)
    return out


def short_excerpt(text, words=20):
    clean = re.sub(r"\s+", " ", text or "").strip()
    return " ".join(clean.split()[:words]).strip()


def add_collection(recipe, collection):
    recipe.setdefault("collections", [])
    if collection and collection not in recipe["collections"]:
        recipe["collections"].append(collection)


def upsert_version(recipe, version):
    versions = recipe.setdefault("versions", [])
    key = version.get("key")
    idx = next((i for i, v in enumerate(versions) if v.get("key") == key), None)
    if idx is None:
        versions.append(version)
    else:
        versions[idx] = version
    report["versions"].append(f"{recipe['name']} :: {version['label']}")


def make_recipe(name, country=None, category="Modern", family="Other", method="Build"):
    r = {
        "id": slug(name), "name": name, "category": category, "country": country,
        "method": method, "family": family, "tags": [], "versions": [], "image": None,
        "movie": None, "collections": [], "ingredients": [], "instructions": "",
        "note": "", "quality": "verified"
    }
    recipes.append(r)
    report["new"].append(name)
    return r


def should_replace_primary(recipe):
    if not recipe.get("image"):
        return True
    entry = manifest.get("byRecipe", {}).get(recipe.get("id"), {})
    current = next((c for c in entry.get("candidates", []) if c.get("path") == recipe.get("image")), None)
    if not current:
        return True
    source = (current.get("source") or "").lower()
    if current.get("status") == "recipe-matched" or current.get("sharedVisualFrom"):
        return True
    if current.get("status") == "exact-book" or any(x in source for x in ("essential cocktail", "death & co", "tropical standard", "agave companion", "cocktails from movies", "hollywood")):
        return True
    return False


def store_image(recipe, image_url, source, source_url, evidence, prefer=True):
    if not image_url or not image_url.startswith("http"):
        return None
    ext = f"{recipe['id']}__{slug(source)[:28]}.webp"
    path = ASSET_DIR / ext
    try:
        data = fetch(image_url, timeout=35).content
        im = Image.open(BytesIO(data)).convert("RGB")
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        im.save(path, "WEBP", quality=90, method=6)
        b = path.read_bytes()
        candidate = {
            "id": recipe["id"], "source": source, "sourceUrl": source_url,
            "evidence": evidence, "path": str(path.relative_to(ROOT)).replace(os.sep, "/"),
            "available": True, "status": "verified-external", "width": im.width,
            "height": im.height, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()
        }
        entry = manifest["byRecipe"].setdefault(recipe["id"], {"name": recipe["name"], "candidates": []})
        entry["name"] = recipe["name"]
        entry.setdefault("candidates", [])
        entry["candidates"] = [c for c in entry["candidates"] if c.get("path") != candidate["path"]]
        entry["candidates"].append(candidate)
        if prefer and should_replace_primary(recipe):
            recipe["image"] = candidate["path"]
        report["images"].append(f"{recipe['name']} <- {source}")
        return candidate["path"]
    except Exception as e:
        report["errors"].append(f"image {recipe['name']} {image_url}: {e}")
        return None


def apply_version(recipe, parsed, source_label, key, source_url, collection, country=None, image_url=None, note="", type_label="Published Reference", prefer_image=True):
    if not parsed or not parsed.get("ingredients"):
        report["skipped"].append(f"No complete parsed recipe: {source_url}")
        return
    if country and not recipe.get("country"):
        recipe["country"] = country
    add_collection(recipe, collection)
    img = store_image(recipe, image_url or parsed.get("image"), source_label, source_url, f"Exact named-drink photograph on the {source_label} source page for {recipe['name']}.", prefer_image)
    version = {
        "label": source_label if source_label != "Barsys" else "Barsys Version",
        "key": key, "type": type_label, "ingredients": parsed["ingredients"],
        "instructions": parsed.get("instructions") or "Follow the linked published source for preparation details.",
        "note": note or short_excerpt(parsed.get("description"), 20), "creator": parsed.get("author") or "",
        "usable": bool(parsed.get("instructions")), "image": img or recipe.get("image"), "url": source_url,
    }
    upsert_version(recipe, version)
    if not recipe.get("ingredients"):
        recipe["ingredients"] = version["ingredients"]
    if not recipe.get("instructions"):
        recipe["instructions"] = version["instructions"]
    if not recipe.get("note") and version.get("note"):
        recipe["note"] = version["note"]
    report["enriched"].append(recipe["name"])


# ---------- Barsys ----------
def discover_barsys_urls():
    recipe_urls, mixlist_urls = set(), set()
    seeds = [
        "https://barsys.com/recipe/painkiller", "https://barsys.com/recipe/manhattan",
        "https://barsys.com/recipe/long-island-iced-tea", "https://barsys.com/recipe/teremana-old-fashioned",
        "https://barsys.com/recipe/avo-colada", "https://barsys.com/recipe/emerald-margarita",
        "https://barsys.com/recipe/peach-tea-press", "https://barsys.com/recipe/fairway-half-half",
        "https://barsys.com/recipe/cosmopolitan", "https://barsys.com/recipe/margarita",
        "https://barsys.com/recipe/classic-mojito", "https://barsys.com/recipe/the-afters",
        "https://barsys.com/recipe/the-bottom-line", "https://barsys.com/recipe/metropolitan",
        "https://barsys.com/recipe/citrus-sunset-bliss", "https://barsys.com/recipe/calibration-complete",
        "https://barsys.com/recipe/cold-fashioned", "https://barsys.com/recipe/babes-and-brawn",
    ]
    recipe_urls.update(seeds)
    mixlist_urls.update([
        "https://barsys.com/mixlist/the-signature-mixlist", "https://barsys.com/mixlist/party-kit",
        "https://barsys.com/mixlist/barsys-360-cocktails-and-cupid-starter-kit",
    ])
    try:
        xml = fetch("https://barsys.com/sitemap.xml", 20).text
        locs = re.findall(r"<loc>([^<]+)</loc>", xml)
        child_maps = [x for x in locs if "sitemap" in x and x.endswith(".xml")][:20]
        all_locs = list(locs)
        for sm in child_maps:
            try:
                all_locs.extend(re.findall(r"<loc>([^<]+)</loc>", fetch(sm, 20).text))
            except Exception:
                pass
        recipe_urls.update(x for x in all_locs if "/recipe/" in x)
        mixlist_urls.update(x for x in all_locs if "/mixlist/" in x)
    except Exception as e:
        report["errors"].append(f"Barsys sitemap: {e}")
    for listing in ("https://barsys.com/collection-recipes", "https://barsys.com/mixlists", "https://us.barsys.com/recipes", "https://us.barsys.com/mixlists"):
        try:
            s, final = soup(listing)
            for a in s.find_all("a", href=True):
                u = urljoin(final, a["href"])
                if "/recipe/" in u: recipe_urls.add(u)
                if "/mixlist/" in u: mixlist_urls.add(u)
            raw = str(s)
            for p in re.findall(r"/(?:recipe|mixlist)/[a-z0-9][a-z0-9-]+", raw, re.I):
                u = urljoin("https://barsys.com", p)
                (recipe_urls if "/recipe/" in p else mixlist_urls).add(u)
        except Exception as e:
            report["errors"].append(f"Barsys listing {listing}: {e}")
    return sorted(recipe_urls), sorted(mixlist_urls)


def parse_barsys_recipe(url, mixlists_by_url):
    try:
        parsed, s, final = parsed_jsonld(url)
        h1 = s.find("h1")
        name = re.sub(r"\s+", " ", h1.get_text(" ", strip=True) if h1 else (parsed or {}).get("name", "")).strip()
        if not name or name.lower() in ("barsys", "loading recipes"):
            return
        need = section_after_heading(s, "What You'll Need")
        if not parsed or not parsed.get("ingredients"):
            ingredients = []
            for line in need:
                if re.search(r"^(ice|glass|garnish|pro tip)\s*:", line, re.I):
                    continue
                x = parse_ingredient(line)
                if x: ingredients.append(x)
            parsed = parsed or {"name": name}
            parsed["ingredients"] = ingredients
        about = section_after_heading(s, "About")
        if not parsed.get("description") and about:
            parsed["description"] = " ".join(about[:3])
        instructions = section_after_heading(s, "How to Make") or section_after_heading(s, "Directions")
        if not parsed.get("instructions") and instructions:
            parsed["instructions"] = " ".join(instructions[:5])
        parsed["image"] = parsed.get("image") or og_image(s)
        recipe = find_recipe(name) or make_recipe(name, category="Modern")
        contexts = sorted(mixlists_by_url.get(final, set()) | mixlists_by_url.get(url, set()))
        collection = f"Barsys · {contexts[0]}" if contexts else "Barsys Recipes"
        note = ""
        if contexts:
            note = f"Barsys collection: {', '.join(contexts[:3])}."
        excerpt = short_excerpt(parsed.get("description"), 18)
        if excerpt:
            note += (" " if note else "") + f"Barsys source excerpt: “{excerpt}”"
        apply_version(recipe, parsed, "Barsys", "barsys", final, collection, image_url=parsed.get("image"), note=note)
        for c in contexts[1:]:
            add_collection(recipe, f"Barsys · {c}")
    except Exception as e:
        report["errors"].append(f"Barsys recipe {url}: {e}")


def import_barsys():
    recipe_urls, mixlist_urls = discover_barsys_urls()
    mixlists_by_url = {}
    for url in mixlist_urls[:60]:
        try:
            s, final = soup(url)
            h1 = s.find("h1")
            title = re.sub(r"\s+", " ", h1.get_text(" ", strip=True) if h1 else url.rsplit("/",1)[-1].replace("-"," ").title()).strip()
            for a in s.find_all("a", href=True):
                u = urljoin(final, a["href"])
                if "/recipe/" in u:
                    recipe_urls.append(u)
                    mixlists_by_url.setdefault(u, set()).add(title)
        except Exception as e:
            report["errors"].append(f"Barsys mixlist {url}: {e}")
    seen = set()
    for url in recipe_urls:
        clean = url.split("?")[0].rstrip("/")
        if clean in seen: continue
        seen.add(clean)
        parse_barsys_recipe(clean, mixlists_by_url)
        if len(seen) >= 120: break
        time.sleep(0.04)


# ---------- Delish world article ----------
DELISH_ARTICLE = "https://www.delish.com/cooking/recipe-ideas/g43829678/world-cocktail-recipes/"
DELISH_FALLBACK = [
    ("Brazil","Caipirinha"),("France","Sidecar"),("Jamaica","Rum Punch"),("Spain","Kalimotxo"),
    ("Japan","Midori Sour"),("Singapore","Singapore Sling"),("Belgium","Black Russian"),("Mexico","Paloma"),
    ("United States","Mai Tai"),("Italy","Americano"),("United States","Bourbon Peach Iced Tea"),
    ("Puerto Rico","Piña Colada"),("United States","Rum Runner"),("United States","Long Island Iced Tea"),
    ("Cuba","Mojito"),("United Kingdom","Pimm's Cup"),("Bermuda","Dark & Stormy"),("Germany","Spezi-Meister"),
    ("United States","Mint Julep"),("Australia","Lemon, Lime, & Bitters Tom Collins")
]


def import_delish():
    try:
        s, final = soup(DELISH_ARTICLE)
    except Exception as e:
        report["errors"].append(f"Delish article: {e}")
        return
    discovered = []
    country_map = {"Hawaii":"United States","American South":"United States","Florida":"United States","New York":"United States","Kentucky":"United States","England":"United Kingdom"}
    for h in s.find_all(["h2","h3"]):
        txt = re.sub(r"^\d+\s*", "", h.get_text(" ", strip=True)).strip()
        if ":" not in txt: continue
        destination, cocktail = [x.strip() for x in txt.split(":",1)]
        if not cocktail or len(cocktail) > 70: continue
        country = country_map.get(destination, destination)
        link = None
        image = None
        for el in h.find_all_next(limit=20):
            if el is not h and el.name in ("h2","h3"): break
            if el.name == "a" and el.get("href") and "recipe" in el.get_text(" ", strip=True).lower():
                link = urljoin(final, el["href"])
            if el.name == "img" and not image:
                image = el.get("src") or el.get("data-src") or el.get("data-lazy-src")
        discovered.append((country, cocktail, link, image))
    if not discovered:
        discovered = [(c,n,None,None) for c,n in DELISH_FALLBACK]
    for country, name, link, image in discovered:
        canonical_name = {"Piña Coladas":"Piña Colada","Mojitos":"Mojito","Mint Juleps":"Mint Julep","Black (& White) Russians":"Black Russian"}.get(name, name)
        recipe = find_recipe(canonical_name)
        parsed = None
        if link:
            try:
                parsed, rs, link = parsed_jsonld(link)
            except Exception as e:
                report["errors"].append(f"Delish recipe {canonical_name}: {e}")
        if recipe is None and parsed and parsed.get("ingredients"):
            recipe = make_recipe(canonical_name, country=country, category="International")
        if recipe is None:
            report["skipped"].append(f"Delish unresolved {canonical_name}")
            continue
        if not recipe.get("country") or recipe.get("country") == "United States" and country not in ("United States",):
            recipe["country"] = country
        add_collection(recipe, "Delish World Cocktails")
        exact_image = (parsed or {}).get("image") or image
        if parsed and parsed.get("ingredients"):
            apply_version(recipe, parsed, "Delish Version", "delish", link or DELISH_ARTICLE, "Delish World Cocktails", country=country, image_url=exact_image, note=f"Featured by Delish in its international cocktail collection for {country}.")
        elif exact_image:
            store_image(recipe, exact_image, "Delish", DELISH_ARTICLE, f"Exact {recipe['name']} photograph in Delish's international cocktail collection.", True)


# ---------- Liquor.com mezcal list ----------
LIQUOR_LIST = "https://www.liquor.com/mezcal-cocktail-recipes-7484752"
LIQUOR_NAMES = ["Oaxaca Old Fashioned","Mezcal Last Word","Mezcal Negroni","Tia Mia","Mezcal Paloma","Naked & Famous","Mezcal Mule","Smoke Show","Polar Bear","Ready Fire Aim","Smoke Follows Beauty","Division Bell","Loaded Pistol","Haitian Divorce","Smoke on the Water"]


def import_liquor():
    try:
        s, final = soup(LIQUOR_LIST)
    except Exception as e:
        report["errors"].append(f"Liquor list: {e}")
        return
    for name in LIQUOR_NAMES:
        link = None
        for a in s.find_all("a", href=True):
            t = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
            if norm(t) == norm(name) or norm(name) in norm(t):
                u = urljoin(final, a["href"])
                if "liquor.com" in urlparse(u).netloc:
                    link = u; break
        if not link:
            report["skipped"].append(f"Liquor link not found {name}")
            continue
        try:
            parsed, rs, link = parsed_jsonld(link)
            if not parsed: raise RuntimeError("no Recipe JSON-LD")
            recipe = find_recipe(name) or make_recipe(name, category="Mezcal")
            recipe["category"] = "Mezcal"
            recipe.setdefault("tags", [])
            if "mezcal" not in recipe["tags"]: recipe["tags"].append("mezcal")
            apply_version(recipe, parsed, "Liquor.com", "liquorcom", link, "Liquor.com Mezcal", image_url=parsed.get("image"), note=short_excerpt(parsed.get("description"), 20), prefer_image=True)
        except Exception as e:
            report["errors"].append(f"Liquor {name}: {e}")


# ---------- Explicit Hong Kong / BVI / Brazil ----------
JETSET = "https://www.jetsetchristina.com/drinking-around-the-world-20-of-the-best-travel-inspired-cocktail-recipes-drinks-original/"

def import_explicit_world():
    # Victoria Chow / The Woods Earl Grey Bee's Knees, exact spec published in JetsetChristina.
    name = "Earl Grey Bee's Knees"
    r = find_recipe(name) or make_recipe(name, country="Hong Kong", category="International", family="Sour", method="Shake")
    r["country"] = "Hong Kong"
    parsed = {"ingredients":[{"amount":"60 ml","name":"Earl Grey tea-infused gin"},{"amount":"30 ml","name":"Honey syrup"},{"amount":"20 ml","name":"Fresh lemon juice"}],"instructions":"Shake all ingredients with ice. Strain into a chilled coupe and garnish with lemon peel.","description":"Victoria Chow of The Woods selected this Earl Grey Bee's Knees to represent Hong Kong, connecting the city's high-tea tradition with the Prohibition-era sour.","author":"Victoria Chow"}
    try:
        s, _ = soup(JETSET)
        heading = next((h for h in s.find_all(["h2","h3"]) if "earl grey" in h.get_text(" ", strip=True).lower()), None)
        img = None
        if heading:
            for el in heading.find_all_next(limit=15):
                if el.name in ("h2","h3") and el is not heading: break
                if el.name == "img":
                    img = el.get("src") or el.get("data-src");
                    if img: break
        parsed["image"] = img
    except Exception: pass
    apply_version(r, parsed, "The Woods / JetsetChristina", "jetset-hk", JETSET, "World Travel Cocktails", country="Hong Kong", image_url=parsed.get("image"), note=parsed["description"])
    # Ensure existing Painkiller and Caipirinha carry requested destinations even if their better web image comes from Barsys/Delish.
    p = find_recipe("Painkiller")
    if p:
        p["country"] = "British Virgin Islands"; add_collection(p, "World Travel Cocktails")
    c = find_recipe("Caipirinha")
    if c:
        c["country"] = "Brazil"; add_collection(c, "World Travel Cocktails")


# ---------- Turkey ----------
PANNING = "https://www.panningtheglobe.com/swinging-sultan-cocktail/"
RAKI_SOURCE = "https://shop.kochdichturkisch.de/2022/08/raki-cocktails-raki-kokteylleri/"

def manual_turkish(name, ingredients, instructions, note, key, source, creator="", image=None, usable=True):
    r = find_recipe(name) or make_recipe(name, country="Turkey", category="International", family="Other", method="Build")
    r["country"] = "Turkey"
    r.setdefault("tags", [])
    for tag in ("turkey","turkish"):
        if tag not in r["tags"]: r["tags"].append(tag)
    add_collection(r, "Turkish Cocktails")
    parsed = {"ingredients":ingredients,"instructions":instructions,"description":note,"author":creator,"image":image}
    apply_version(r, parsed, creator or "Published Turkish Reference", key, source, "Turkish Cocktails", country="Turkey", image_url=image, note=note)
    return r


def import_turkey():
    try:
        parsed, s, final = parsed_jsonld(PANNING)
        if parsed:
            r = find_recipe("Swinging Sultan") or make_recipe("Swinging Sultan", country="Turkey", category="International", family="Sour", method="Shake")
            r["country"] = "Turkey"
            apply_version(r, parsed, "Panning The Globe", "panning-swinging-sultan", final, "Turkish Cocktails", country="Turkey", image_url=parsed.get("image"), note="A Turkish-style Cosmopolitan created after a trip to Istanbul, finished with a light raki mist.")
    except Exception as e:
        report["errors"].append(f"Swinging Sultan: {e}")
    # Source-backed modern raki recipes from KochDichTürkisch.
    turkish = [
        ("Taze Egeli (Fresh Aegean)", [{"amount":"30 ml","name":"Rakı"},{"amount":"100 ml","name":"Schweppes Wild Berry or tonic with berry juice"},{"amount":"","name":"Crushed ice or ice cubes"}], "Add rakı to a glass, fill with ice, top with Wild Berry soda, garnish with mixed berries and an orange slice, and stir gently.", "A light modern rakı highball presented by KochDichTürkisch as an Aegean-style summer drink."),
        ("Ak Harami (White Robber)", [{"amount":"50 ml","name":"Rakı"},{"amount":"200 ml","name":"Lemon soda"},{"amount":"1–2 splashes","name":"Grenadine"},{"amount":"","name":"Ice"}], "Build rakı and lemon soda over ice, add grenadine gently, and garnish with mint, pomegranate and lemon.", "A modern rakı aperitif from KochDichTürkisch."),
        ("Chilexi", [{"amount":"20 ml","name":"Lime juice"},{"amount":"5–6","name":"Strawberries"},{"amount":"40 ml","name":"Rakı"},{"amount":"20 ml","name":"Orange liqueur"},{"amount":"4 cubes","name":"Crushed ice"}], "Blend lime juice, strawberries, rakı, orange liqueur and crushed ice. Serve cold with a lime garnish.", "A strawberry-forward modern rakı cocktail from KochDichTürkisch."),
        ("Turkish Screwdriver (Rakı-O)", [{"amount":"30 ml","name":"Rakı"},{"amount":"70 ml","name":"Orange juice"},{"amount":"","name":"Crushed ice or ice cubes"}], "Build rakı and orange juice over ice, stir, and garnish with orange and mint.", "A Turkish screwdriver variation using rakı in place of vodka."),
    ]
    for name, ing, ins, note in turkish:
        manual_turkish(name, ing, ins, note, "kochdich-raki", RAKI_SOURCE, creator="KochDichTürkisch")
    # Mardini is intentionally preserved as a verified profile, not a fabricated measured spec.
    name = "Mardini"
    r = find_recipe(name) or make_recipe(name, country="Turkey", category="Modern", family="Sour", method="Shake")
    r["country"] = "Turkey"; add_collection(r, "Fahri Konsolos")
    ingredients = [{"amount":"","name":"Beefeater gin"},{"amount":"","name":"House-made sumac syrup"},{"amount":"","name":"Urfa pomegranate molasses"},{"amount":"","name":"Lemon"},{"amount":"","name":"Crisped parsley garnish"}]
    v = {"label":"Fahri Konsolos Profile","key":"fahri-mardini","type":"Creator / Bar Profile","ingredients":ingredients,"instructions":"Exact published proportions were not available from the accessible sources. Do not treat this profile as a measured house spec.","note":"Fahri Konsolos in Kadıköy is documented serving Mardini with gin, sumac, pomegranate molasses, lemon and parsley. Exact ratios are intentionally not invented.","creator":"Fahri Konsolos","usable":False,"image":None,"url":"https://www.instagram.com/fahrikonsolosluk/?hl=en"}
    upsert_version(r, v)
    r["ingredients"] = ingredients
    r["instructions"] = v["instructions"]
    r["note"] = v["note"]


# ---------- Finalize ----------
def patch_app_regions_and_collection_copy():
    p = ROOT / "app.js"
    text = p.read_text()
    additions = {
        '  Barbados: "Caribbean",': '  Barbados: "Caribbean",\n  Belgium: "Western Europe",',
        '  France: "Western Europe",': '  France: "Western Europe",\n  Germany: "Western Europe",',
        '  Italy: "Mediterranean",': '  Hong Kong: "East Asia",\n  Italy: "Mediterranean",\n  Jamaica: "Caribbean",',
        '  Portugal: "Mediterranean",': '  Portugal: "Mediterranean",\n  "Puerto Rico": "Caribbean",',
        '  Thailand: "Southeast Asia",': '  Thailand: "Southeast Asia",\n  Turkey: "Mediterranean",',
    }
    for old, new in additions.items():
        if new.split("\n")[-1].strip() not in text and old in text:
            text = text.replace(old, new, 1)
    old = 'BOOK_DESCRIPTIONS[state.book] || "Recipe collection"'
    new = 'BOOK_DESCRIPTIONS[state.book] || (state.book.startsWith("Barsys ·") ? "Barsys mixlist with source-backed recipes, context and exact drink photography." : "Recipe collection")'
    text = text.replace(old, new)
    old2 = 'BOOK_DESCRIPTIONS[c] || "Recipe collection"'
    new2 = 'BOOK_DESCRIPTIONS[c] || (c.startsWith("Barsys ·") ? "Barsys mixlist with source-backed recipes, context and exact drink photography." : "Recipe collection")'
    text = text.replace(old2, new2)
    p.write_text(text)


import_barsys()
import_delish()
import_liquor()
import_explicit_world()
import_turkey()
patch_app_regions_and_collection_copy()

# Keep deterministic ordering and remove duplicate collection labels.
for r in recipes:
    r["collections"] = list(dict.fromkeys(r.get("collections", [])))
recipes.sort(key=lambda r: norm(r.get("name")))
manifest["generated"] = "2026-10-08"
RECIPES_PATH.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n")
MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
(Path(ROOT / "source-data" / "source-enrichment-20261008-report.json")).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({k: len(v) for k,v in report.items()}, indent=2))
if report["errors"]:
    print("Non-fatal source errors:")
    for e in report["errors"][:30]: print(" -", e)
