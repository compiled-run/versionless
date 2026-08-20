Fable-Opus-Unit: lrapr-t006/u19b-host-mechanisms-schema
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the two witness host mechanisms and the tiny-translator core schema in /Users/jacksm5pro/dev/open-source/versionless — re-cut (1 of 3) from u19's zero-write block (commit `b5d6aa3`). NO journeys, NO publish.

PM rulings baked in:

1. **File-input load mechanism**: expose Playwright `setInputFiles` through the host/PageHandle surface as a per-AppSpec OPT-IN (a spec declares its file-input surface; specs that don't are provably untouched). The mechanism records what was loaded (fixture path, bytes sha256) in the run evidence.
2. **Download-capture mechanism**: `acceptDownloads: true` on the context ONLY when the AppSpec opts in; a `capturedDownloads()` readback of suggestedFilename/bytes/sha256, ledgered per download. Same opt-in discipline.
3. Both mechanisms are generic (no app names), tested per idiom (positive with a synthetic fixture; negative: non-opted spec's context provably lacks acceptDownloads and the files surface). The full suite green is the regression proof — the opt-in construction makes the eleven existing verticals untouched by design.
4. **Core schema** `packages/core/src/receipts/witness-angular-tiny-translator.ts` per the established idiom: pinned source identity, bound build receipts (canonical roots: baseline `rebuild-1`, migrated `dist-7`, each recording its ×2 sibling's byte-identity), PER-LANE mocked-seam lists (baseline: fonts.googleapis.com icon stylesheet; migrated: fonts.gstatic.com woff2 + preconnect — the critters-inlining divergence recorded as a declared difference), the two distinct mat-icon degradations as per-lane assertions, file-input-load and download-capture evidence slots, localStorage persistence evidence, rendered-style probes with eleven-major-lift declared differences, scroll/absence, route shape, mutation proof slot, accommodation framing: 0 manual-migration-steps with the 9-file/5-capability inventory referenced and the FileReader-service parity assertion named as an explicit journey obligation. Parser/renderer/verifier/aggregate member, barrel-exported.
5. Tests per idiom (schema round-trip; mechanism positives/negatives); whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-tiny-translator.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/cli/src/fixture/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/**.
- Additive-only to pinned evidence surfaces (existing verticals' receipts and verifiers stay green untouched); no app names in reusable surfaces beyond closed lists; key.pem nowhere.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the opt-in construction cannot keep existing verticals provably untouched (name the seam), the schema cannot express a ruled fact, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
