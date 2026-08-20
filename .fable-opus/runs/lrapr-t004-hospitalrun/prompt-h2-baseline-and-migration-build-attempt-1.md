Fable-Opus-Unit: lrapr-t004-hospitalrun/h2-baseline-and-migration-build
Fable-Opus-Timeout-Minutes: 35

## Goal

Give the HospitalRun vertical (ingested at commit 0c2b4f3, slug `react-hospitalrun`, HospitalRun/hospitalrun-frontend v2.0.0-alpha.7) a truthful baseline and a Vite 8 migration build in /Users/jacksm5pro/dev/open-source/versionless.

1. **Era-labeled compatibility baseline.** Upstream committed no lockfile, and today's floating resolution breaks the build (present-day `@types/babel__traverse` / `@types/lodash` vs pinned typescript 3.8.3 — see `evidence/ingests/react-hospitalrun/baseline-attempt.json`). Construct an explicitly-labeled compatibility resolution: pin the minimal set of drifted packages to versions released on or before the tag date (2020-11-07; use registry time metadata, record each pin with its publish date and reason), producing a resolution that installs and builds under the declared-era cell (Node 12.14.1 x64 under Rosetta 2 — runtime already verified on this host; consented registry fetches allowed and ledgered). Build twice, require deterministic inventories per the build-profile idiom. The charter allows an "authentic or explicitly labeled compatibility baseline" — label it exactly that; never present it as the upstream-committed state. If pinning snowballs beyond ~a dozen packages, stop and report rather than pinning the world.
2. **Vite 8 migration build** via the generic CRA adapter (`packages/frameworks/react/src/react-cra-vite-adapter.ts`, proven on papercups): this is the CRA capabilities' required second independent application. Extend the adapter GENERICALLY where HospitalRun's shapes demand (it may exercise svgr, jsx-in-.js, absolute imports, CRA env vars, i18n asset handling — implement only what this app actually needs, app-agnostically, with unit tests; the overfitting guard idiom from papercups applies: no app names in the reusable surface). Zero application-source edits is the target; if an edit is unavoidable, it must go through a reusable, tested transform, not a hand patch. Build the target twice, deterministic, on the workspace's modern Node.
3. Record honest build-level parity (shared outputs, baseline-only outputs incl. any service worker, target-only outputs) under `evidence/runs/react-hospitalrun/` per the papercups idiom; browser gates stay not-run. Fixture-scoped orchestration + tests per idiom (`react-hospitalrun-vite8.ts` style, with the app-name guard on the reusable surface).
4. Whole repo gate green.

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/**`
- `packages/cli/test/**`
- `evidence/runs/react-hospitalrun/**`
- `evidence/ingests/react-hospitalrun/**`
- `fixtures/react-hospitalrun/**`
- `vite.config.ts`

## Forbidden moves

- No app-name/revision/exact-string branching in the exported reusable React surface. Why: overfitting is the documented failure mode; the guard test must stay green.
- No changes to packages/core/**, packages/trust/**, evidence/runs/aggregate.json, evidence/trust/**, other evidence dirs, scripts/**, docs/\*\*.
- Network only for consented registry fetches (era-pin resolution + installs), ledgered; nothing else.
- Do not delete or rewrite prior truthful evidence — append. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-hospitalrun/'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the era-pin set snowballs past ~a dozen packages, a native dep cannot build under the Rosetta cell, the migration demands an app-named branch or a non-reusable hand patch, or determinism fails, return status "blocked" with truthful evidence recorded and specifics in open_questions. Partial honest progress with a clear cut line is a legitimate blocked outcome.
