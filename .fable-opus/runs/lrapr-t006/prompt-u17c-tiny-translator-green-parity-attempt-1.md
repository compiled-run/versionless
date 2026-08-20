Fable-Opus-Unit: lrapr-t006/u17c-tiny-translator-green-parity
Fable-Opus-Timeout-Minutes: 35

## Goal

Take the tiny-translator migrated lane from its itemized RED to a deterministic green build with parity in /Users/jacksm5pro/dev/open-source/versionless. Commit `0667e15` era: the four demand families are itemized in `evidence/runs/angular-tiny-translator-v0-12-0/u17b-migrated-lane.json`; the staged closure lives at `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app` (node_modules installed, offline-ready).

PM-ruled capability shapes (baked in):

1. **Material barrel split — a closure-reading capability** (the exports-map-resolver idiom): read the INSTALLED @angular/material 16 package's own type/export surface to map each of the 20 barrel symbols to its secondary entry point; rewrite imports binding-resolved; refuse symbols the installed surface does not map. Never a memorized table. The NG2003/NG6001 injection-token errors are expected consequences — verify they clear with the barrel fix rather than treating them separately.
2. **node-util in browser code — two capabilities**: (a) an analyzer-driven call-site transform for the 16 application modules importing `format` from 'util' (rewrite to a semantics-preserving local/idiomatic form the analyzer can prove — refuse call shapes it cannot); (b) a DECLARED dependency-scoped browser shim for ngx-i18nsupport-lib's own internal `util` imports (the CRA node-core idiom: explicit, recorded, dependency-scoped, never global).
3. **RxJS prototype-patch migration**: the 37 `.map()`/`.catch()` (etc.) call sites move to `pipe(...)` binding-resolved — all-or-nothing per module, refusal over half-edits, the patch-import removal only firing where every dependent call site in that module was moved.
4. Then: production build ×2 deterministic; build-level parity vs the era lane per the established idiom (the plain-variant story from u17); truthful final `applicationFilesChanged` with digests; any residual demands itemized honestly if the build stays red (that is still a completed outcome — bring the new list).
5. Tests per idiom for each capability (positives + refusal negatives); overfitting guard green; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; key.pem never enters evidence/fixtures; no fabricated evidence; truthful reds; no test weakening. Network only if a consented install is genuinely needed (record). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0'
```

## Blocked permission

If a demand cannot be met by a generic transform (name the construct), determinism fails, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
