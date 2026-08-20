Fable-Opus-Unit: lrapr-t004/t004-d5-papercups-receipts
Fable-Opus-Timeout-Minutes: 35

## Goal

Finish the papercups v1.0.0 browser-proof vertical in /Users/jacksm5pro/dev/open-source/versionless. The journeys are already implemented and proven green on both lanes (`executeReactPapercupsWitnessRun` in `packages/cli/src/witness/real-app-run.ts`, uncommitted working-tree state — keep it). Remaining work, with PM rulings from the prior blocked unit baked in:

1. **Core receipt schema** (allowance granted): add `packages/core/src/receipts/witness-react-papercups.ts` following the existing witness receipt schema idiom (see witness-react-boilerplate / witness-angular-realworld modules), wired per idiom.
2. **Aggregate conformance** (allowance granted, strengthening only): extend `deriveCorpusTransactionState` in `packages/core/src/corpus/conformance.ts` with the new exact composition after `witness-react-papercups` joins the aggregate — the new derived state must pin the NEW exact member count and ordered path list at least as strictly as the current `react-zero-sw-reconciliation` state pins the old one. Loosening any assertion is forbidden.
3. **Mutation proof** on the MIGRATED build: locate meaningful visible bytes in the bundle (e.g. a category/conversation string), mutate → journey assertion red, restore byte-identically → green rerun, per the react-boilerplate byte-mutation idiom.
4. **Zero-SW enforcement** per the react-boilerplate idiom (app calls serviceWorker.unregister(); assert zero SW lifecycle events, no CacheStorage masking).
5. Run baseline 2/2 and migrated 2/2 through local link:../witness; emit canonical receipts at `evidence/runs/witness-react-papercups/receipt.{json,md}` and updates under `evidence/runs/react-papercups-v1-0-0/`; append the aggregate via the existing flow. The receipt must record the measured scroll surface limitation truthfully (scrollHeight === clientHeight everywhere at 1280×720 — scroll omitted as not meaningful; PM-accepted). Redacted, unknowns preserved, self-limiting language, no certification claims.
6. **Trust regeneration**: the aggregate change shifts provenance digests, so regenerate `evidence/trust/current` via the canonical offline command (`VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`) — no hand edits, counts must move only as receipts justify (React lineage may gain the papercups cell only if the canonical flow derives it; do not force numbers).
7. Tests for the new schema and conformance state; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/**`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `evidence/runs/react-papercups-v1-0-0/**`
- `evidence/runs/witness-react-papercups/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`
- `fixtures/react-papercups-v1-0-0/**`

## Forbidden moves

- No packages/frameworks/**, packages/trust/** (the trust PACKAGE code — regenerating evidence/trust/current output is required), evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/** writes.
- No loosened assertion anywhere in conformance or schemas; no fabricated or hand-edited evidence; a red journey is a truthful red; no SW/cache masking.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-react-papercups/receipt.json evidence/runs/witness-react-papercups/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If the mutation cannot find meaningful bytes without app-name product branching, a journey goes truthfully red, the conformance extension cannot be written without loosening an assertion, or trust regeneration moves counts in a way receipts do not justify, return status "blocked" with specifics in open_questions instead of improvising.
