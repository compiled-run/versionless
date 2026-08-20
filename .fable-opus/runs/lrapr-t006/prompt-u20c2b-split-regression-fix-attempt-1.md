Fable-Opus-Unit: lrapr-t006/u20c2b-split-regression-fix
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: A runtime regression across the migration whose fix must be a generic reusable capability, not an app patch — mis-attributing or over-fitting it corrupts the adapter, and the input-setter timing semantics between Angular 8 and 16 must be read from the framework, not assumed.

## Goal

Root-cause fully and repair the super-productivity migrated lane's per-load runtime regression in /Users/jacksm5pro/dev/open-source/versionless (commit `a1c427c`; the finding: `TypeError: Cannot read properties of undefined (reading 'classList')` in `set splitPos` at `src/app/pages/work-view/split/split.component.ts`, 1 page error + 2 console errors per document load in the migrated lane, 0 in era; the u20c2a receipt characterizes it as an `@Input() set splitPos` calling renderer `addClass` against an undefined element ref under Angular 16 input-setter timing).

FIRST confirm the cause mechanically (the u19i discipline — do not trust the characterization): read `split.component.ts` in the stage/source tree; read what Angular 8 vs Angular 16 actually changed about input-setter invocation order relative to `@ViewChild`/element availability (the framework source in the installed closures is the authority — Angular 16's `ɵɵproperty`/setter timing vs Angular 8's). Attribute to exactly one of: (a) a genuine framework behavior change the migration must accommodate; (b) an app-latent bug exposed (the u19i pattern — the setter always assumed a timing the era happened to provide); (c) our own transform altered something. Prove it with the bundle/source evidence.

Then repair per the cause:

- If (a) or (b): a GENERIC reusable capability in `packages/frameworks/angular` (the forms-legacy-CVA precedent: analyzer-detectable shape — an `@Input` setter dereferencing a `@ViewChild`/element member that Angular 16's setter timing may not have populated yet — guarded by the vendor's own mechanism or a minimal provider/config the target line supports; refuse shapes the analyzer cannot prove). App source stays as its authors wrote it. Tests: positive on the split shape, refusal negatives.
- If (c): fix our transform + regression test.
  Record the analyzer-detectable signature honestly; if the only correct fix is app-source-specific (no generic form exists), that is a blocked-worthy finding — bring it, do not app-patch in product code.

Then: apply, rebuild ×2 (offline-guarded per u23, deterministic-modulo the recorded Sass-random files), superseding build record over u23; **behavior check**: the split.component error is GONE — migrated lane produces 0 page errors on load, matching era (the settled-reaction discriminator). The two declared style differences (u20c2a's header-icon/body font-family) stay as recorded declared differences.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No app-source patches in product code; no packages/core/src changes; no packages/frameworks/react/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Prior records immutable; no fabricated evidence; the cause must be mechanical; truthful reds. No network except the offline-guarded rebuild's own (none expected). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If the only correct repair is app-source-specific with no generic capability form (bring the analysis), the cause cannot be attributed mechanically, or the rebuild goes red for a new reason, return status "blocked" with specifics in open_questions instead of improvising.
