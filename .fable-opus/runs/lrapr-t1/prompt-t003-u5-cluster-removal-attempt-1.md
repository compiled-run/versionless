Fable-Opus-Unit: lrapr-t1/t003-u5-cluster-removal
Fable-Opus-Timeout-Minutes: 35

## Goal

Remove six terminal-candidate fixture clusters from /Users/jacksm5pro/dev/open-source/versionless — each is dead per-app code for a migration candidate with terminal/failed evidence, owner-approved for removal (T011 audit map). The previous unit removed 8 standalone dead modules; these six survived only because each is consumed by its own candidate's fixture harness. Remove each WHOLE cluster: the framework module, its cli fixture runner/ingest, their dedicated tests, barrel exports, and any cli.ts/vite.config wiring that exists solely for that cluster.

Clusters (module → known consumers; trace for more before deleting):

1. react-calculator: `packages/frameworks/react/src/react-calculator-migration.ts` + `packages/cli/src/fixture/react-calculator-run.ts`
2. react-graphiql: `packages/frameworks/react/src/react-graphiql-migration.ts` + `packages/cli/src/fixture/react-graphiql-013-run.ts`
3. react-sqlpad: `packages/frameworks/react/src/react-sqlpad-v5-5-0-migration.ts` + `packages/cli/src/fixture/react-sqlpad-v5-5-0-run.ts`
4. react-avataaars: `packages/frameworks/react/src/react-avataaars-react18-migration.ts` + `packages/cli/src/fixture/react-avataaars-compatibility-run.ts`
5. angular-fuxa: `packages/frameworks/angular/src/fuxa-angular14-to16.ts` + `packages/cli/src/fixture/angular-fuxa-target-ingest.ts`
6. angular-contacts: `packages/frameworks/angular/src/angular-contacts-9-to-16.ts` + `packages/cli/src/fixture/angular-contacts-production-ingest.ts` + `packages/cli/test/witness-angular-contacts-run.test.ts` + `packages/cli/test/dashboard-contacts-dependency-preflight.test.ts` (the dashboard half of that test's subject was removed last unit; if any part of it covers a KEEP-list subject, keep that part and say so)

Context that matters: `witness-angular-contacts-run.test.ts` is also the last observed source of gate flakiness (a navigation/fetch race producing `net::ERR_ABORTED` on `GET /api/contacts` roughly once per several full-suite runs). Its removal with the cluster is expected to make the suite stable; your verify block therefore runs the full suite twice back-to-back. If the double run still fails, the failure is in something you did NOT remove — do not chase it; report it and return blocked.

Discipline: trace imports/references for every deletion candidate (exported symbols + filenames across packages/, scripts/, vite.config.ts, cli.ts) BEFORE deleting. Anything with a live consumer outside these six clusters stays, listed in the receipt. None of these six apps is in the canonical corpus (11 verticals / 4 apps: react-boilerplate, angular-phonecat, angular-realworld, killedbygoogle) — if you find evidence to the contrary, stop and return blocked.

STRICT KEEP LIST: everything for react-boilerplate (all variants), angular-realworld, angular-phonecat, killedbygoogle/next; generic React transforms (react-class-lifecycle-to-hooks, react-connect-to-hooks, react-data-flow-connect-to-hooks, react-composed-migration); template-analysis.ts; packages/core, packages/trust, packages/experiments, packages/node-guard; everything under evidence/ and fixtures/ (terminal evidence is append-only and stays); scripts/; docs/.

## File contract

- `packages/frameworks/react/**`
- `packages/frameworks/angular/**`
- `packages/cli/**`
- `vite.config.ts`

## Forbidden moves

- Do not delete or edit anything under evidence/**, fixtures/**, docs/**, scripts/**, packages/core/**, packages/trust/**. Why: evidence is append-only; curation is scoped to dead adapter/fixture code.
- Do not weaken, delete, or skip any test except the six clusters' own dedicated tests. Why: only dead-candidate tests leave, and they leave whole.
- Do not touch the recovery refs; do not commit or stage anything. Why: single-commit boundary at task end, PM-owned.
- Strict TypeScript, magic-regexp, pathe, ufo.
- No network.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
```

trust:verify is deliberately absent: it is red for a pre-existing cause (pre-goal dirty package.json/evidence digests) and is owned by a later evidence-regeneration unit.

## Blocked permission

If a cluster member has a live consumer outside the six clusters, if any of these apps turns out to be referenced by canonical corpus/aggregate evidence, if the double suite run fails in a test you did not remove, or if you would need to write outside the contract, return status "blocked" with specifics in open_questions instead of improvising.
