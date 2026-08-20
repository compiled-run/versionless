Fable-Opus-Unit: lrapr-t006/u19-tiny-translator-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the tiny-translator vertical in /Users/jacksm5pro/dev/open-source/versionless — the first Angular cohort-two witness cell (Angular 5→16.2, the .angular-cli.json band). Commit `b5d6aa3` era: both lanes complete (era baseline via the plain `ng build --prod --aot` variant, u17d migrated lane green with logical-name parity; regenerate offline via the committed fixture flows; caches at `.versionless/cache/angular-tiny-translator-v0-12-0-*`; stage at `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app`).

App facts (ingest `evidence/ingests/angular-tiny-translator-v0-12-0/`): localStorage-only persistence; core flow entirely local — create project → load XLIFF via a FileReader file input → edit/filter/mark translation units → download the result; `fonts.googleapis.com/icon?family=Material+Icons` requested unconditionally from index.html (block per the mocked-seam idiom, query-free; mat-icon degrades to ligature text — assert the degradation truthfully); an optional GitHub-download feature exists per the scout but the ingest CORRECTED that (no such feature at this pin — do not journey it); the parity story uses the PLAIN variant (no ngsw — record SW absence truthfully in both lanes); committed key.pem never enters evidence.

Deliver:

1. tiny-translator in `WITNESS_REAL_APP_NAMES` (framework 'angular') + journey in `real-app-run.ts` + dedicated runner per the factoriolab idiom (the established generic mechanisms all apply: exact inventories, cancelled-duplicate category if it fires, measured scroll/absence, rendered-style probes, mocked-seam inventory).
2. Journeys on BOTH lanes: (a) create a translation project via the app's own form with a synthetic XLIFF fixture file loaded through the real file input (a small fixture-scoped .xlf with clearly-fake units — the FileReader path is the app's genuine input surface); (b) edit a translation unit with typed content, mark state changes (translated/reviewed flags), and filter narrowing + restore; (c) download the translated file via the app's own export and verify the emitted bytes carry the typed translation (the download is the app's real output surface — capture it through the browser's own download event); (d) hover where meaningful; measured scroll or absence; the mat-icon ligature degradation asserted under the blocked font seam; localStorage persistence across reload asserted.
3. Rendered-style probes across lanes (Material 5-RC theming vs Material 16 is the style arbitration — pick stable structural probes and record honest differences as declared, this is an ELEVEN-major lift); exact inventories; zero successful non-loopback.
4. Baseline 2/2 + migrated 2/2; semantic byte-mutation (visible string → red → byte-identical restore → green).
5. Core schema `packages/core/src/receipts/witness-angular-tiny-translator.ts` per idiom, barrel-exported; canonical receipts `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}` + artifacts under `evidence/runs/angular-tiny-translator-v0-12-0/`; redacted, unknowns preserved, `counted: false` pending Judge; the 19-step-equivalent accommodation inventory for THIS cell (u17 series had capability-only edits — confirm and state the accommodation count truthfully) referenced in the receipt.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate/conformance/trust.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-tiny-translator.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `evidence/runs/witness-angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Behavioral differences between an eleven-major Material lift's lanes are recorded truthfully, never normalized to force parity; a REAL rendered-behavior break is red evidence, not a styling note.
- No fabricated evidence; inventories exact; key.pem nowhere; no app names in reusable surfaces beyond closed lists. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (a real behavioral break across the eleven-major lift is RED EVIDENCE — record it first), the download capture needs a generic mechanism the witness host lacks (name it), a closed enumeration outside the contract blocks receipts, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
