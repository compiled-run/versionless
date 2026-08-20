Fable-Opus-Unit: lrapr-t006/u18j-worker-chunks-parity
Fable-Opus-Timeout-Minutes: 35

## Goal

Close the super-productivity web-worker family and complete the cell's build-parity story in /Users/jacksm5pro/dev/open-source/versionless (commit `9c90eb4`; ledger `evidence/runs/angular-super-productivity-v2-13-15/u18i-closure-correction-green.json`; lane GREEN at 58 artifacts; stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app`).

The measured open family: both worker sites use the era string form `new Worker('./lz.worker', {type: 'module'})`, which webpack 5 does not detect — no chunk emits, the build stays green, the workers would 404 at runtime. The derivable shape (from u18i's reading): the workspace declares `webWorkerTsConfig`, each literal resolves to a real `.worker.ts` in the tree, and the options already say `type: 'module'` — the modern form is `new Worker(new URL('./x.worker', import.meta.url), {type: 'module'})`.

1. **Worker-URL capability** in `packages/frameworks/angular`: analyzer-driven rewrite of the era string-form Worker construction to the URL form — provable only when the workspace declares worker support, the specifier resolves to a worker source in the tree, and the constructor shape matches; refusals by name otherwise. Tests per idiom.
2. Apply; rebuild; verify the worker chunks now EMIT (the artifact census must show them); build ×2 deterministic-modulo the known ngsw timestamp.
3. Refresh logical-name parity vs the era lane: the worker chunks should close 4 of the 6 missing names; `polyfills-es5` ×2 remain recorded differences (removed by Angular 13 — a declared difference, not a gap). The u18j record completes the cell's build story: final whole-tree applicationFilesChanged (capability vs accommodation split), the full accommodation inventory carried forward, parity with every asymmetry named.
4. Tests; overfitting guard green; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Accommodations never enter packages/frameworks; no app-name branches; no fabricated evidence; truthful reds; no test weakening. No network expected (record if a consented read is genuinely needed). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If the worker rewrite cannot stay provable (name the site), the chunks still do not emit after the rewrite (bring the builder reading), or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
