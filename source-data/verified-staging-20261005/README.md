# Verified staging integration — 2026-10-05

Baseline: `971a7402b027510232348acbb63cd1b3b416ae78` on `reconstruct-shakerrr-20260928`.

The canonical authority is `data/recipes.json`: **398 recipes**. After integration,
**183 recipes (46.0%) have committed images; 215 remain unresolved**. This adds
115 covered recipes to the previous 68. There are 207 verified image candidates:
72 existing source photographs reused and 135 new WebP files copied unchanged.
No images were extracted or sourced from the web in this integration.

## Why the earlier estimate of 235 covered recipes was wrong

The original mapping package matched 262 staged files to 235 IDs, but 55 of those
files target 53 obsolete, empty image-manifest keys that are not canonical recipes.
Those 55 rows were excluded. The valid subset initially covers 182 canonical IDs.
One audited correction maps the Hollywood **Simple Manhattan** image to the exact
existing `simple-manhattan` record (Titanic), instead of the broad `manhattan`
record (whose movie version references The Nutty Professor). That gives 183.
No canonical recipe was added, renamed, deleted, or merged to fit the images.

All **31 originally unmatched titles remain untouched**, even where subsequent
review may be possible. Their assets remain in the recovered extraction pack,
alongside the 55 rows excluded here; none was copied into production assets.

## Evidence and accounting

- `integration-report.json`: authoritative decisions, counts, mapping correction,
  input CSV hashes, and each reused/copied asset's committed SHA-256.
- `integration-decisions.csv`: one outcome for every one of the 293 staged files.
- `unresolved-canonical-recipes.csv` / `.json`: exact sorted list of 215 current
  canonical recipes without a validated image.
- `image-coverage-report.json`: regenerated coverage and integrity audit.
- Original mapping and verification CSVs, rejected candidate list and summaries
  are preserved verbatim. **`mapping_summary.json` is the historical estimate,
  not the final coverage result.** The corrected integration report supersedes it.

Each accepted manifest candidate preserves original source/book/page/evidence.
Nested `stagingProvenance` retains the original verification and mapping rows,
including staged file, hash, dimensions, title, confidence and verification method.
For reused photographs, existing asset metadata remains unchanged. In particular,
the Essential Cocktail Book staging `printedPage` refers to the recipe page while
some committed records use the facing photograph's printed page; both remain
available in their original contexts.

Deduplication checks all committed WebP hashes (including unmanifested files), then
exact canonical ID + source + photo PDF page, or printed page for EPUB images.
The 72 reused photographs have different encodings from staging, so matching only
file hashes would have duplicated them. Existing primary images and existing
source-version images remain unchanged. New version image paths are attached only
to matching sources; Hollywood Cocktails maps to the catalog's Cocktails from Movies
label. Original recipe content is unchanged apart from image paths.

Original recovered archive checksums:

- `shakerrr_verified_extraction_pack.zip`: `94059c616f959010d569bfa944eecdf167580b63dc3919aa171d3b1bc629f85a`
- `shakerrr_mapping_pack.zip`: `8700dded61ca4f6a0bcec94e266c4e3c2ed5caaf4f18ff5d011511492e50a570`

## Validation and regeneration

`npm run validate` verifies catalog structure, image membership/provenance, local
WebP structure and dimensions, SHA-256, metadata counts, and regression tests.
`npm test` includes browser decoding of every available image and UI checks for
Negroni and Simple Manhattan. All staging images are also fully decoded by Pillow
before the importer makes changes. Run `npm run catalog:stats` to recalculate
metadata, and `npm run images:coverage -- source-data/verified-staging-20261005` to
regenerate the unresolved list and coverage report.

The importer defaults to a dry run and requires Pillow. Reproduction against the
baseline commit uses `scripts/integrate-verified-staging.py --staging <extracted-pack>
--mapping <mapping-directory> --date 2026-10-05 --base-commit
971a7402b027510232348acbb63cd1b3b416ae78 --apply`, followed by the commands above.
The integration report is a snapshot of that baseline-to-checkpoint operation.

The 67 existing empty, noncanonical manifest keys are retained as historical
warnings; candidates on any noncanonical key are now validation errors.
