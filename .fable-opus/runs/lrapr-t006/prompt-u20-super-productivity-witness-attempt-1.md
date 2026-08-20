Fable-Opus-Unit: lrapr-t006/u20-super-productivity-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the super-productivity vertical in /Users/jacksm5pro/dev/open-source/versionless — the final Angular witness cell (Angular 8→16.2, pre-Ivy origin). Commit `286476d` era: build story complete (u18-series: 62-artifact migrated lane with worker chunks, deterministic-modulo the recorded Sass-random files; era lane deterministic-modulo the same; 19 manual-migration-steps + 1 payload accommodation inventory recorded; lanes regenerable offline via the committed u18 fixture flows; caches at `.versionless/cache/angular-super-productivity-v2-13-15-*`, stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app`).

App facts (ingest + u18 records): all state local (localStorage/IndexedDB — verify which); zero backend; ngsw service worker in BOTH lanes (the era lane emits ngsw; the migrated lane also emits it — check the artifact census; the SW non-masking discipline applies with whatever reality shows per lane); unconditional Google Fonts egress from index.html + ngsw prefetch (block per the mocked-seam idiom, per-lane); Electron never in scope; optional Jira/Google integrations off by default (their egress destinations recorded at ingest — block fail-fast if any fires); Sass-random confetti = the known nondeterministic files (excluded from byte parity by the standing ruling; witness behavior is the arbiter).

Deliver:

1. super-productivity in `WITNESS_REAL_APP_NAMES` (framework 'angular') + journey in `real-app-run.ts` + dedicated runner per idiom. If drag is claimed, `WITNESS_REAL_APP_DRAG_SURFACES` gains its second member (the jira-clone precedent — drag stays hard-refused elsewhere).
2. Journeys on BOTH lanes: (a) create a task with typed content, assert it renders; (b) drag-reorder two tasks with real pointer gestures, assert settled order (the app's headline surface); (c) start/stop time tracking with the settled state asserted (anchor on the app's own reaction, never timing — the play/pause control state and tracked-time rendering); (d) project switch + settings change (e.g. dark theme toggle with a rendered-style probe proving it) + keyboard shortcut where meaningful; (e) persistence across reload (localStorage/IndexedDB — assert the created task survives); measured scroll or absence per surface.
3. Rendered-style probes across lanes; exact per-lane inventories (console, failed requests, cancelled-duplicate category if it fires); SW state recorded truthfully per lane under the non-masking discipline; zero successful non-loopback.
4. Baseline 2/2 + migrated 2/2; semantic byte-mutation red → byte-identical restore → green.
5. Core schema `packages/core/src/receipts/witness-angular-super-productivity.ts` per idiom, barrel-exported; canonical receipts at `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.{json,md}` + artifacts; the 19+1 accommodation inventory referenced in the receipt (the honest manual-steps story); redacted, unknowns preserved, `counted: false`.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate/conformance/trust.

This is a BIG app (494 source files) — if the honest cut line exceeds the unit, the mw1c/d/e split precedent applies: state exactly what lands (schema+wiring / journey+runner / publish) and cut there.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `evidence/runs/witness-angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds (a real behavioral break across the lift is RED evidence first); inventories exact; no app names in reusable surfaces beyond closed lists. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (RED first), the SW census contradicts the packet (bring it), a closed enumeration outside the contract blocks receipts, or the work exceeds this unit (cut per the mw1 split precedent), return status "blocked" with specifics in open_questions instead of improvising.
