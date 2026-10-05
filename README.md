# Shakerrr

Shakerrr is MJ's static GitHub Pages cocktail reference application.

## Canonical repository
This repository is the production source of truth. `FusorXE/SHAKER` is historical reference material only; production has no runtime dependency on it.

## Catalog
The reconstruction branch currently contains 398 canonical recovery records derived from the legacy 606-row extraction. This is a validated recovery baseline, not a target or final release count. The final catalog count must be source-driven from the Project books and review pipeline.

## Product areas
Discover, Cocktails, Atlas with regions/countries, My Bar, Families, Books, Movies, Mezcal, Amaro, Saved, Ingredients and Swap Lab.

## Versions
Book/reference versions stay distinct. Personal and social versions never overwrite canonical published specs.

## Images
`data/image-manifest.json` records catalog image mappings. Historical paths whose binary assets were never committed remain marked unavailable until exact authorized book or verified catalog images are extracted and committed. Missing is preferred over a wrong cocktail image.

The 2026-10-05 verified staging checkpoint covers 183 of 398 canonical recipes
(46.0%), with 215 unresolved. See [the integration audit](source-data/verified-staging-20261005/README.md)
for provenance, corrected mapping accounting, and the exact unresolved list.

## Personal data
Favorites, My Bar, personal/social recipes, preferences and custom photos stay private in browser storage. Tools provides versioned Export/Import backup. No GitHub write token is exposed client-side.

## Offline and tests
A service worker caches the core UI/catalog after a successful load. `npm run validate` checks catalog integrity. `npm test` runs Playwright browser smoke tests. GitHub Actions runs on the reconstruction branch, pull requests and main.
