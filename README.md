# Shakerrr

Shakerrr is MJ's static GitHub Pages cocktail reference application.

## Canonical repository
This repository is the production source of truth. `FusorXE/SHAKER` is historical reference material only; production has no runtime dependency on it.

## Catalog
The legacy reconstruction baseline listed 398 recovery records, but the live canonical normalization currently produces **354 recipe cards**. `node scripts/audit-web-photo-coverage.mjs` derives that count from the actual current `data/recipes.json`, and writes `data/web-photo-coverage.json`; don't confuse it with historical recovery counts.

## Product areas
Discover, Cocktails, Atlas with regions/countries, My Bar, Families, Books, Movies, Mezcal, Amaro, Saved, Ingredients and Swap Lab.

## Versions
Book/reference versions stay distinct. Personal and social versions never overwrite canonical published specs.

## Images
Premium website photography is now the default visual direction. `data/web-photos.json` contains independently curated photo records, creator/source/license metadata, and local WebP paths under `assets/recipes/web/`. `scripts/persist-web-photos.py` and `.github/workflows/persist-web-photos.yml` save up to 10 verified web images per batch into the repository.

`data/image-manifest.json` retains legacy book-derived image provenance. The display pipeline prioritizes curated web images and temporarily falls back to book images only when no web replacement exists. Recipe versions and book bibliographies remain independent of photography. The recipe detail page shows on-photo annotations based on the active recipe version, not baked into the photo.

As of November 1, 2026, the curated manifest contains **42 unique website-photo records**, of which **38 match actual canonical recipe cards**. Four orphan image keys (`espresso-martini`, `mimosa`, `tequila-sunrise`, `sazerac`) are not counted as website coverage. The exact persisted-file count changes as GitHub Actions completes, and must be read from `data/web-photo-coverage.json`, not inferred from the manifest.

Photo discovery is source-by-source: `scripts/discover-commons-photos.py` queries Wikimedia Commons for cocktail-name matches, correct photo dimensions and permissible licenses, with category fallback; `scripts/discover-openverse-photos.py` queries the official Openverse API as an additional experimental source. Neither research queue directly publishes images; the true cocktail, source-page rights, crop, attribution and contact sheets must pass review before a candidate can be published. `scripts/build-photo-review.py` produces contact sheets under `assets/review/` from the actual committed WebP files. The Pexels terms do not authorize unrestricted systematic bulk copying, so Pexels pages are individually selected.

We still need to replace hundreds of book photos before retiring the legacy fallback. A visually wrong or weak photo should not be published just to increase coverage.

The 2026-10-05 verified staging checkpoint covers 183 of 398 canonical recipes
(46.0%), with 215 unresolved. See [the integration audit](source-data/verified-staging-20261005/README.md)
for provenance, corrected mapping accounting, and the exact unresolved list.

## Personal data
Favorites, My Bar, personal/social recipes, preferences and custom photos stay private in browser storage. Tools provides versioned Export/Import backup. No GitHub write token is exposed client-side.

## Offline and tests
A service worker caches the core UI/catalog after a successful load. `npm run validate` checks catalog integrity. `npm test` runs Playwright browser smoke tests. GitHub Actions runs on the reconstruction branch, pull requests and main.
