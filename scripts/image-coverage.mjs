import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditImages } from './validate-images.mjs';

// Usage: node scripts/image-coverage.mjs [output-directory]
// Default reports stay outside version-controlled catalog data.
const output = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'shakerrr-image-coverage'));
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

try {
  const audit = auditImages({ checkMeta: true });
  fs.mkdirSync(output, { recursive: true });
  const report = {
    generated: new Date().toISOString(),
    definition: 'A covered canonical recipe selects a verified available manifest candidate whose local WebP structure, dimensions and SHA-256 match. Counts are calculated from the current catalog and files, not historical staging claims.',
    counts: audit.counts,
    validationErrors: audit.errors,
    warnings: audit.warnings,
    unresolvedCanonicalRecipeIds: audit.unresolved.map((recipe) => recipe.id),
  };
  fs.writeFileSync(path.join(output, 'image-coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(output, 'unresolved-canonical-recipes.json'), `${JSON.stringify(audit.unresolved, null, 2)}\n`);
  const fields = ['id', 'name', 'category', 'collections', 'reason'];
  const lines = [fields.join(','), ...audit.unresolved.map((recipe) => fields.map((field) => csv(Array.isArray(recipe[field]) ? recipe[field].join(' | ') : recipe[field])).join(','))];
  fs.writeFileSync(path.join(output, 'unresolved-canonical-recipes.csv'), `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ output, counts: audit.counts, validationErrors: audit.errors.length, warnings: audit.warnings.length }, null, 2));
  if (audit.errors.length) process.exitCode = 1;
} catch (error) {
  console.error(`Image coverage report failed: ${error.message}`);
  process.exitCode = 1;
}
