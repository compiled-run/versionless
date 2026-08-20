Fable-Opus-Unit: lrapr-t006/u19f-localize-boot-green
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the template-i18n runtime capability, get the tiny-translator migrated lane to a MOUNTING boot, and complete the deferred re-pin work in /Users/jacksm5pro/dev/open-source/versionless (commit `5f76a8d`; red at `evidence/runs/angular-tiny-translator-v0-12-0/u19e-node-core-runtime-globals.json`: `$localize is not defined` at bootstrap; stage at `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app`; boot check exists at `packages/cli/src/witness/angular-tiny-translator-boot-check.ts`).

PM rulings baked in:

1. **Template-i18n runtime capability** in `packages/frameworks/angular`: when the application's templates carry i18n markers (analyzer-detectable) and the target line's AOT emits `$localize` tagged templates, declare `@angular/localize` at the cell's read range (registry-read, consented install VL-LEGACY-CORPUS-2026-08-10, URLs/digests recorded) and add `@angular/localize/init` as a polyfills entry via the existing seam. Refuse when no i18n markers exist (no speculative polyfill). Tests per idiom.
2. Apply; rebuild; **boot check must show mounted + rendered home surface**; if a THIRD global surfaces, that is a blocked-worthy finding (bring it), not an improvise.
3. On a mounting lane: build ×2 deterministic; superseding build record (u17d immutable, superseded by reference); schema bound-receipt digests re-pinned; the era SW-attempting admission encoded (exact 400 + two console errors as the baseline inventory, zero-SW pin becomes the SW-ATTEMPT record, contradicted nonclaim replaced with the truthful era-defect statement).
4. Whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-tiny-translator.ts`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/react/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- u17d immutable; no blanket polyfills; no app-name branches; no fabricated evidence; truthful reds. Network only for the authorized consented install (recorded). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0'
```

## Blocked permission

If a third boot-blocking global surfaces (bring it), the localize install cannot satisfy the cell, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
