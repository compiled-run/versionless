Fable-Opus-Unit: lrapr-t004/t004-d4-papercups-journeys
Fable-Opus-Timeout-Minutes: 35

## Goal

Complete the papercups v1.0.0 browser-proof vertical in /Users/jacksm5pro/dev/open-source/versionless. All infrastructure exists as of commit 19874ea: deterministic baseline (webpack 4.42) and migrated (Vite 8) builds under `.versionless/work/react-papercups-v1-0-0/` (rebuild offline via the existing fixture flow if missing), the loopback API projection (`papercups-projection.ts`), the Phoenix socket stub (`phoenix-socket.ts`), the `AppSpec.loopback()` wiring, and papercups registered in `WITNESS_REAL_APP_NAMES` with an explicitly not-yet-implemented journey slot.

Deliver:

1. Implement the real papercups journey in `real-app-run.ts`: at least THREE substantive journeys with visible state assertions — (a) sign-in: type credentials, submit, assert route change to `/conversations/all` and console render; (b) inbox triage: navigate all → prioritized → closed, asserting each category's distinct visible conversation text from the frozen projection; (c) reply round-trip: type a reply, send, assert the message appears via the Phoenix `shout` echo. Include hover and scroll where meaningful. Zero console errors, zero page errors, zero failed requests (the socket stub exists precisely so the WebSocket cannot 404).
2. Run baseline 2/2 and migrated 2/2 production-static passes through the local `link:../witness`.
3. Zero-SW enforcement per the react-boilerplate idiom (the app calls `serviceWorker.unregister()`; assert zero SW lifecycle events and no CacheStorage masking).
4. Semantic mutation proof on the MIGRATED build: locate meaningful bytes (e.g. a visible conversation/category string in the bundle), mutate so a journey assertion goes red, restore byte-identically, rerun green — following the react-boilerplate byte-mutation idiom.
5. Locality: zero successful non-loopback requests across all runs.
6. Canonical receipts at `evidence/runs/witness-react-papercups/receipt.{json,md}`, updates under `evidence/runs/react-papercups-v1-0-0/`, aggregate updated via the existing appendAggregate flow. Redacted, unknowns preserved, self-limiting language (one app does not establish generic support), no certification claims.
7. Fixture-scoped run orchestration + tests per repo idiom; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/react-papercups-v1-0-0/**`
- `evidence/runs/witness-react-papercups/**`
- `evidence/runs/aggregate.json`
- `fixtures/react-papercups-v1-0-0/**`

## Forbidden moves

- No packages/frameworks/**, packages/core/**, packages/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\* writes. Why: adapter freeze is approaching; core registration is done; evidence outside this vertical is sealed.
- No fabricated or hand-edited evidence; a red journey is a truthful red. No page-load-only journeys. No SW/cache masking.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-react-papercups/receipt.json evidence/runs/witness-react-papercups/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
```

## Blocked permission

If a journey cannot pass truthfully (report the exact assertion and browser state), the builds cannot be rematerialized offline, Playwright cannot launch, or the mutation cannot find meaningful bytes without app-name product branching, return status "blocked" with specifics in open_questions instead of improvising.
