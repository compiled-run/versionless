Fable-Opus-Unit: lrapr-t004/t004-d2-papercups-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Complete the browser-proof gate for the papercups v1.0.0 vertical in /Users/jacksm5pro/dev/open-source/versionless, using the deterministic baseline (webpack 4.42) and migrated (Vite 8) builds produced by the previous unit under `.versionless/work/react-papercups-v1-0-0/` (rebuild them via the existing fixture flow if the work tree is missing).

Required, per the canonical per-application gates in docs/goals/legacy-react-angular-production-readiness/goal.md:

1. Direct Witness browser runs through the local `link:../witness` dependency (never a registry copy): baseline 2/2 and migrated 2/2 production-static passes.
2. At least THREE substantive user journeys with real interactions (click, type, keyboard, hover, scroll where meaningful) and visible state assertions. The app is an operator console expecting a Phoenix API: follow the repo's established stubbed-transport idiom (see `angularRealworldTransport` in `packages/cli/src/witness/real-app-run.ts` — frozen synthetic fixture data served through the app's normal API contract, honestly labeled as evidence data). Extend the witness machinery for papercups in the same fixture-scoped way (the `App` union in real-app-run.ts is app-keyed by design); keep everything in `packages/frameworks/react` application-agnostic.
3. Semantic mutation proof: locate meaningful bytes in the MIGRATED build output, mutate them so a journey assertion goes red, restore byte-identically, rerun green (follow the react-boilerplate byte-mutation idiom, not just a title/bootstrap kill).
4. Service-worker honesty: the CRA baseline emits `service-worker.js`; results must not be masked by SW/cache behavior — follow the react-boilerplate zero-SW enforcement idiom if it applies cleanly, otherwise record SW lifecycle state truthfully in the receipt with an explicit non-masking check.
5. Locality: zero successful non-loopback requests across all runs, recorded.
6. Canonical receipts under `evidence/runs/witness-react-papercups/` (+ updates to `evidence/runs/react-papercups-v1-0-0/` and the aggregate via the existing appendAggregate flow), redacted (no usernames/host paths/secrets), unknowns preserved, no certification language, independent offline verification green.
7. Tests for any new witness capability; whole repo gate stays green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/react-papercups-v1-0-0/**`
- `evidence/runs/witness-react-papercups/**`
- `evidence/runs/aggregate.json`
- `fixtures/react-papercups-v1-0-0/**`

## Forbidden moves

- No changes to packages/frameworks/**, packages/core/**, packages/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*. Why: adapter surface is converging toward freeze; ingest evidence is sealed.
- No fabricated, hand-edited, or replayed-without-running evidence; a journey that cannot pass is a truthful red, not a relabel. No page-load-only "journeys".
- No network at all (the transport stub serves everything; builds exist or rebuild offline from the acquired store). No registry Witness.
- Strict TypeScript, magic-regexp, pathe, ufo. Do not weaken or delete existing tests. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-react-papercups/receipt.json evidence/runs/witness-react-papercups/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the app cannot render three substantive journeys against a truthful stub (report exactly what the surface supports), the SW question cannot be resolved without masking, the builds cannot be rematerialized offline, or Playwright cannot launch, return status "blocked" with specifics in open_questions instead of improvising.
