"""Import an audited extraction pack without extracting or re-encoding any images.

Requires Pillow for full WebP decoding. Defaults to a dry run; pass --apply to
write the reviewed plan. recipes.json is the only authority for canonical IDs.
"""
import argparse
import copy
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil

from PIL import Image


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def number(value):
    parsed = float(value) if value else float("nan")
    return int(parsed) if math.isfinite(parsed) else None


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staging", type=Path, required=True)
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--date", required=True)
    parser.add_argument("--base-commit", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    recipes = json.loads(Path("data/recipes.json").read_text())
    manifest = json.loads(Path("data/image-manifest.json").read_text())
    by_id = {r["id"]: r for r in recipes}
    original_recipes = copy.deepcopy(recipes)
    original_candidates = copy.deepcopy(manifest["byRecipe"])
    verification = rows(args.staging / "verified_extraction_manifest.csv")
    mapping = rows(args.mapping / "staging_to_canonical_mapping.csv")
    by_file = {r["file"]: r for r in verification}
    assert len(by_file) == len(verification) == len(mapping), "Duplicate/missing staging records"
    assert {r["file"] for r in mapping} == set(by_file), "Mapping and extraction inventory differ"
    books = {"Agave Companion": "01", "Essential Cocktail Book": "02",
             "Tropical Standard": "03", "Essential Cocktails 2021": "04",
             "Hollywood Cocktails": "05", "Death & Co": "06"}
    before = {r["id"] for r in recipes if r.get("image")}
    all_assets = {}
    for asset in sorted(Path("assets").rglob("*.webp")):
        all_assets.setdefault(digest(asset), str(asset))
    decisions, copies, corrections = [], [], []

    for mapped in mapping:
        verified = by_file[mapped["file"]]
        assert verified["normalizedTitle"] == mapped["stagingNormalizedTitle"]
        source_path = (args.staging / verified["file"]).resolve()
        assert source_path.is_relative_to(args.staging.resolve()), "Unsafe staging path"
        assert source_path.suffix == ".webp" and source_path.stat().st_size > 0
        assert digest(source_path) == verified["sha256"] == mapped["sha256"], verified["file"]
        assert source_path.stat().st_size == number(verified["bytes"])
        for key in ("source", "sourceTitle", "confidence", "verificationMethod"):
            assert verified[key] == mapped[key], f"Mapping changed verification field {key}"
        for key in ("recipePdfPage", "photoPdfPage", "printedPage", "width", "height"):
            assert number(verified[key]) == number(mapped[key]), f"Mapping changed verification field {key}"
        assert verified["confidence"] == "A" and verified["verificationMethod"].strip()
        with Image.open(source_path) as image:
            assert image.format == "WEBP"
            image.load()
            width, height = image.size
        for key, measured in (("width", width), ("height", height)):
            assert not verified[key] or number(verified[key]) == measured, (verified["file"], key)
        target = mapped["canonicalId"]
        decision = {"file": mapped["file"], "source": verified["source"],
                    "sourceTitle": verified["sourceTitle"], "originalCanonicalId": target or None,
                    "canonicalId": None, "stagingSha256": verified["sha256"]}
        if mapped["mappingStatus"] == "no_current_canonical_target":
            decision["action"] = "retained_original_unmatched"
            decisions.append(decision)
            continue
        if target not in by_id:
            decision.update(action="rejected_stale_manifest_target",
                            reason="Target is an obsolete manifest key, absent from canonical recipes.json.")
            decisions.append(decision)
            continue
        assert mapped["mappingStatus"] in ("exact_normalized_id", "alias_or_source_version")
        # Explicit audited correction: this distinct Titanic drink already has
        # its own canonical entry. Never apply fuzzy or automatic title remaps.
        if verified["source"] == "Hollywood Cocktails" and verified["normalizedTitle"] == "simple-manhattan":
            assert target == "manhattan" and by_id["simple-manhattan"]["name"] == "Simple Manhattan"
            target = "simple-manhattan"
            corrections.append({"file": mapped["file"], "from": "manhattan", "to": target,
                                "reason": "Exact existing canonical title Simple Manhattan; its movie record references Titanic. The Manhattan movie version references The Nutty Professor."})
        decision["canonicalId"] = target
        record = manifest["byRecipe"].setdefault(target, {"name": by_id[target]["name"], "candidates": []})
        candidates = record["candidates"]
        photo_page = number(verified["photoPdfPage"])
        printed_page = number(verified["printedPage"])
        # Same source photograph may be encoded at different resolutions. A
        # byte hash alone would re-add every one of the 72 existing candidates.
        duplicate = next((c for c in candidates if c.get("available") and
                          c.get("status") == "exact-book" and c.get("source") == verified["source"] and
                          ((photo_page and c.get("pdfPage") == photo_page) or
                           (not photo_page and printed_page and c.get("printedPage") == printed_page))), None)
        provenance = {"verification": verified, "mapping": mapped}
        if duplicate:
            path = duplicate["path"]
            assert digest(Path(path)) == duplicate["sha256"], "Existing asset hash mismatch"
            staged = duplicate.setdefault("stagingProvenance", [])
            if provenance not in staged:
                staged.append(provenance)
            decision.update(action="reused_source_page", path=path, committedSha256=duplicate["sha256"])
        else:
            existing_path = all_assets.get(verified["sha256"])
            path = existing_path or f"assets/recipes/{source_path.name}"
            if not existing_path:
                assert not Path(path).exists(), f"Refusing to overwrite {path}"
                copies.append((source_path, Path(path)))
                all_assets[verified["sha256"]] = path
            candidate = {"id": target, "book": books[verified["source"]], "source": verified["source"],
                         "sourceTitle": verified["sourceTitle"], "path": path, "available": True,
                         "status": "exact-book", "evidence": verified["verificationMethod"],
                         "width": width, "height": height, "sha256": verified["sha256"],
                         "stagingProvenance": [provenance]}
            for key, value in (("pdfPage", photo_page), ("recipePdfPage", number(verified["recipePdfPage"])),
                               ("printedPage", printed_page), ("sourceYear", number(verified["sourceYear"]))):
                if value is not None:
                    candidate[key] = value
            candidate["page"] = printed_page or photo_page
            candidates.append(candidate)
            decision.update(action="reused_exact_bytes" if existing_path else "copied_verified_webp",
                            path=path, committedSha256=verified["sha256"])
        decisions.append(decision)
        if not by_id[target].get("image"):
            by_id[target]["image"] = candidates[0]["path"]
        version_label = "Cocktails from Movies" if verified["source"] == "Hollywood Cocktails" else verified["source"]
        for version in by_id[target].get("versions", []):
            if version.get("label") == version_label and not version.get("image"):
                version["image"] = path

    # Assert recipe content and every prior candidate's metadata remain intact.
    def without_images(value):
        if isinstance(value, dict):
            return {k: without_images(v) for k, v in value.items() if k != "image"}
        if isinstance(value, list):
            return [without_images(v) for v in value]
        return value
    assert without_images(recipes) == without_images(original_recipes)
    for key, old_record in original_candidates.items():
        for old, current in zip(old_record["candidates"], manifest["byRecipe"][key]["candidates"]):
            assert all(current[k] == v for k, v in old.items()), (key, "Existing provenance changed")
    after = {r["id"] for r in recipes if r.get("image")}
    counts = {"canonicalRecipes": len(recipes), "beforeCommittedImageRecipes": len(before),
              "verifiedStagingFiles": len(verification), "acceptedStagingFiles": sum(d["canonicalId"] is not None for d in decisions),
              "copiedWebpFiles": len(copies), "reusedSourcePageFiles": sum(d["action"] == "reused_source_page" for d in decisions),
              "reusedExactByteFiles": sum(d["action"] == "reused_exact_bytes" for d in decisions),
              "originalUnmatchedFilesRetained": sum(d["action"] == "retained_original_unmatched" for d in decisions),
              "staleTargetFilesExcluded": sum(d["action"] == "rejected_stale_manifest_target" for d in decisions),
              "newlyCoveredRecipes": len(after - before), "committedImageRecipes": len(after),
              "missingImageRecipes": len(recipes) - len(after), "imageCoveragePercent": round(100 * len(after) / len(recipes), 1)}
    report = {"date": args.date, "baseCommit": args.base_commit, "counts": counts,
              "inputSha256": {"mappingCsv": digest(args.mapping / "staging_to_canonical_mapping.csv"),
                              "verificationCsv": digest(args.staging / "verified_extraction_manifest.csv")},
              "mappingCorrections": corrections, "decisions": decisions}
    print(json.dumps({"apply": args.apply, "counts": counts, "mappingCorrections": corrections}, indent=2))
    if not args.apply:
        return
    for source, destination in copies:
        shutil.copyfile(source, destination)
        assert digest(source) == digest(destination)
    manifest["generated"] = args.date
    write_json(Path("data/recipes.json"), recipes)
    write_json(Path("data/image-manifest.json"), manifest)
    output = Path("source-data/verified-staging-20261005")
    output.mkdir(parents=True, exist_ok=True)
    for filename in ("staging_to_canonical_mapping.csv", "staged_titles_without_current_canonical_target.csv", "mapping_summary.json"):
        shutil.copyfile(args.mapping / filename, output / filename)
    for filename in ("verified_extraction_manifest.csv", "rejected_candidates.csv", "verification_summary.json"):
        shutil.copyfile(args.staging / filename, output / filename)
    write_json(output / "integration-report.json", report)
    fields = ["file", "source", "sourceTitle", "originalCanonicalId", "canonicalId", "action", "path", "reason"]
    with (output / "integration-decisions.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(decisions)


if __name__ == "__main__":
    run()
