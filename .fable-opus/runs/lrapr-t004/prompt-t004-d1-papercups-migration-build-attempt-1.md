Fable-Opus-Unit: lrapr-t004/t004-d1-papercups-migration-build
Fable-Opus-Timeout-Minutes: 35

## Goal

Prove reusable CRA-to-Vite migration capability on the papercups ingest, through the build stage (browser journeys are a later unit). In /Users/jacksm5pro/dev/open-source/versionless:

1. Materialize the verified papercups v1.0.0 source (archive digest sha256 f8a6576c0399e1eca5e1936a9e5e5b311798cccf3cb7c6fcce0cecbf8b46ea8f per `evidence/ingests/react-papercups-v1-0-0/source.json`) into the canonical work area (`.versionless/work/react-papercups-v1-0-0/…`), following the repo's existing work-tree conventions (see how react-boilerplate verticals structure baseline/target). The app is the React/TS operator console under `assets/` (CRA react-scripts 3.4.1, webpack 4.42.0, React 16.13.1).
2. Baseline: install dependencies and produce the webpack production build twice; require deterministic results per the repo's existing build-profile idiom. Dependency acquisition is permitted under consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`, recorded (registry URLs + lockfile integrity); everything else offline.
3. Migration: produce a Vite 8 target build via the REUSABLE React adapter in `packages/frameworks/react` — extend it generically where CRA 3.4 shapes require it (public/ handling, %PUBLIC_URL%, jsx in .js/.tsx, env vars, svgr, absolute imports — whatever this app actually exercises). The existing adapter was proven on react-boilerplate (webpack 4.30, no CRA); generalizing it to CRA is the point of this unit. NO papercups-named branches, hashes, or exact-string matches in exported product APIs — fixture-scoped orchestration lives in packages/cli fixture code, wired via the existing generic legacy-candidate machinery where sensible.
4. Build the migrated target twice; require deterministic results. Record honest parity signals at build level (artifact inventory, entry html, chunk digests) — do not claim behavioral parity; that is the Witness unit's job.
5. Emit canonical evidence under `evidence/runs/react-papercups-v1-0-0/` following existing receipt shapes (build-profile, run receipt with unknown/not-tested states preserved for browser gates), plus tests for any new adapter capability (each new exported adapter capability needs a unit test, and remember the two-independent-apps cross-proof rule means these capabilities should be written generically enough to apply to mycrypto later).

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/**`
- `packages/cli/test/**`
- `evidence/runs/react-papercups-v1-0-0/**`
- `fixtures/react-papercups-v1-0-0/**`
- `vite.config.ts`

## Forbidden moves

- No app-name/revision/exact-source-string branching in exported product APIs (packages/frameworks/react public surface). Why: reusable capability is the product; overfitting is the documented failure mode of the prior 4-day run.
- Do not modify evidence/ingests/**, other evidence/runs/** directories, packages/core/**, packages/trust/**, scripts/**, docs/**. Why: ingest evidence is sealed; core/trust untouched this unit.
- Do not weaken or delete existing tests; strict TypeScript, magic-regexp, pathe, ufo.
- Network only for the consented dependency acquisition step, recorded; no other network.
- Do not commit or stage anything (PM commits the coherent slice).
- If the CRA generalization demands changes that would break the react-boilerplate vertical, stop — that regression is a blocked condition, not a trade.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-papercups-v1-0-0/'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the CRA build cannot be made deterministic, the adapter generalization would require app-named product branches, the react-boilerplate vertical would regress, dependency acquisition fails, or the work exceeds this unit (report exactly where you stopped and what remains), return status "blocked" with specifics in open_questions instead of improvising. Partial honest progress with a clear cut line is a legitimate blocked outcome.
