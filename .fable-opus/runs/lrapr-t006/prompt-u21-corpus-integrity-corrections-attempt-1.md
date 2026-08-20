Fable-Opus-Unit: lrapr-t006/u21-corpus-integrity-corrections
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: Corpus-wide integrity corrections touching published evidence and a shared harness defect — a wrong move here compounds the very defects being corrected, and the supersede-chain discipline must be applied exactly across four records and two capability surfaces.

## Goal

Execute the u20a integrity rulings in /Users/jacksm5pro/dev/open-source/versionless (commit `286476d`; u20a's findings are the spec — reproduce them, do not trust them):

1. **Find and fix the latin1 digest defect at its shared source.** The four affected records (`evidence/runs/angular-super-productivity-v2-13-15/u18-era-baseline.json`, `evidence/runs/angular-factoriolab/{m2-era-baseline,m2-migrated-build,m2-build-parity}.json`) were written by cli fixture drivers — find the shared code path that hashed a latin1-decoded string, fix it to hash bytes, and add a regression test (a fixture file with bytes ≥0x80 whose digest must equal sha256(bytes)). If the defect lives in per-record drivers rather than shared code, fix each and say so.
2. **Correction records, supersede-by-reference** (originals immutable): for each affected record, a correction record publishing the raw-correct digests (recomputed from the retained trees where they survive — era caches/manifests; state plainly where a tree no longer exists and the correction is therefore derivational: latin1-injectivity preserves the comparison conclusions, recorded as the basis), the defect description, and the affected-values inventory. The factoriolab witness receipt itself is NOT re-published this unit — record whether its own bound digests are affected (its witness receipt binds build receipts by digest — check WHICH digest values it bound; if it bound the latin1 values, that is a finding for the correction record and the Judge, stated plainly).
3. **Disable font inlining in the Angular target cell** (`packages/frameworks/angular` workspace migration): optimized production builds must not fetch — set the builder's `optimization.fonts.inline: false` generically for the migrated workspace (recorded as a declared difference of the cell: era browsers fetched fonts at RUNTIME from the app's own link; the migrated lane now does the same rather than inlining at build time — behavior-faithful and offline-faithful). Tests per idiom.
4. **Probe all Angular 16 lanes** for the undeclared fetch (read-only): tiny-translator (published — its dist-13 index.html: inlined fonts?), jira-clone, factoriolab (Google Fonts links at all?). Record findings per lane in a locality-findings evidence record under `evidence/runs/` per-app dirs; the rebuild/republish list that follows is the record's output (rebuilds happen in follow-on units, not here).
5. Whole repo gate green; nothing loosened; every correction record carries its reason and basis.

## File contract

- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/frameworks/angular/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `evidence/runs/angular-factoriolab/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `evidence/runs/angular-jira-clone/**`
- `fixtures/**`

## Forbidden moves

- Originals immutable — corrections supersede by reference only; the published witness receipts are NOT re-published this unit; no packages/core/src changes; no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, scripts/**, docs/\*\*.
- No fabricated evidence; derivational corrections state their basis; no network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15 evidence/runs/angular-factoriolab'
```

## Blocked permission

If the defect's source cannot be located (bring the search), a retained tree needed for recomputation is gone AND derivational correction is insufficient for a record (name it), or the probe findings exceed the unit, return status "blocked" with specifics in open_questions instead of improvising.
