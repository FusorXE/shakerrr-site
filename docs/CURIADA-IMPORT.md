# Reviewed Curiada batches

The initial batch adds eight named cocktails with the image explicitly attached to each Curiada article. Each recipe retains a clickable source, publication date, ingredient quantities, a reviewed preparation, glass and any specified garnish. No creator, country or historical origin is inferred. Curiada's prose descriptions are not imported.

The importer takes only the explicit pages in `source-data/curiada/reviewed-batch.json`, with a maximum of ten per batch. It does not crawl the library. The JSON-LD Recipe name and canonical URL must match the reviewed entry. A fingerprint covers ingredient lines, source directions, named article image and publication date; any change requires review. The reviewed preparation is concise original wording that preserves the source's steps, including adding carbonated ingredients after shaking.

Run from the repository root with Node 20 or newer:

```sh
# Preview selected live sources without changing the catalog.
node scripts/import-curiada.mjs

# Check all selected sources and images, then apply the reviewed batch.
node scripts/import-curiada.mjs --apply
node scripts/catalog-stats.mjs
npm run validate
node --test tests/curiada-import.test.mjs

# Recheck or reapply the already committed batch without network access.
node scripts/import-curiada.mjs --offline
```

The import downloads local WebP images from the named article's Curiada/Shopify CDN URL. It validates their file structure, dimensions and SHA-256 hash before adding verified-external manifest entries. The named source image URL remains in the manifest. All entries pass before catalog writes begin. A failed fetch, unexpected name, changed source fingerprint or invalid image aborts the batch.

Re-running a batch does not duplicate recipes, versions or images. An existing canonical recipe retains its ingredients, instructions, history and default image; only its missing Curiada version and corresponding exact image are added. Names are normalized for duplicate detection, and ambiguous ID/name collisions require an explicit correction. Existing different image bytes are rejected. Only the two catalog files, new recipe images and the import report are written; personal browser data is untouched. Run the existing catalog stats command after a successful batch to refresh counts.

To extend the library, select a new small batch of named pages; inspect each Recipe schema and its image, review the preparation and save the matching source fingerprint and factual snapshot. Do not turn generic descriptions, ingredients' places of manufacture or drink names into origin claims. The eight checked-in entries are examples of the required metadata and evidence, not an automatic approval of other pages.
