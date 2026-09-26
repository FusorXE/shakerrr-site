# Shakerrr

Shakerrr is MJ's static GitHub Pages cocktail reference application.

## Canonical repository
This repository is the production source of truth. `FusorXE/SHAKER` is historical reference material only; production has no runtime dependency on it.

## Catalog
The September 25, 2026 rebuild replaces browser-side OCR filtering with 399 source-cleaned canonical recipes from the legacy 606-row extraction. Git history preserves the legacy data.

## Product areas
Discover, Cocktails, Atlas with regions/countries, My Bar, Families, Books, Movies, Mezcal, Amaro, Saved, Ingredients and Swap Lab.

## Versions
Book/reference versions stay distinct. Personal and social versions never overwrite canonical published specs.

## Images
`data/image-manifest.json` records historical catalog image mappings. The old deployment referenced `assets/recipes/*` files that were never committed, so those paths are marked unavailable rather than counted as image coverage. The UI prefers a committed exact asset when one exists, then exact-name/strict external matching, then a clearly labeled placeholder.

## Personal data
Favorites, My Bar, personal/social recipes, preferences and custom photos stay private in browser storage. Tools provides versioned Export/Import backup. No GitHub write token is exposed client-side.

## Offline and tests
A service worker caches the core UI/catalog after a successful load. `npm run validate` checks catalog integrity. `npm test` runs Playwright browser smoke tests. GitHub Actions runs both on the working branch, pull requests and main.
