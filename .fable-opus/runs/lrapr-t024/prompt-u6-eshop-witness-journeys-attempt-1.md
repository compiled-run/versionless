Fable-Opus-Unit: lrapr-t024/u6-eshop-witness-journeys
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: The holdout's browser-parity gate on a backend-coupled enterprise SPA — the harness surface decision (declared same-origin projection vs live backend vs truthful limitation), measured-not-guessed journey pins on two lanes, pass-twice determinism, and mutation-red/byte-restore must all be honest under falsification discipline; a wrong surface call overclaims the entire holdout.

## Goal

Witness browser-parity for the eShop WebSPA holdout in /Users/jacksm5pro/dev/open-source/versionless (T024; freeze 27741d9c — React `972ca801…` and Angular `4b6e2f44…` subtrees untouchable now; verify before/after). Lanes: era baseline build (u4-of-t023 pattern: `.versionless/work/angular-eshop-webspa/baseline` output) and migrated build (the green 27741d9c-adapter output). NO canonical publish (next unit) — this unit makes the journeys pass honestly on both lanes and records parity/determinism/locality/mutation evidence.

SURFACE DECISION FIRST (measure, then choose the established pattern):

- The SPA boots by fetching `${document.baseURI}Home/Configuration` (backend-rendered by its ASP.NET host) and then talks to .NET microservices. Spawning the real .NET stack is out of scope/off-charter (needs containers).
- The witness framework has TWO established answers: the declared same-origin loopback API projection (used by the corpus vertical whose app talks to a Go backend — study `packages/core/src/receipts/witness-real-app.ts` and the runner's `startStaticServer({api})`), and the mocked-non-loopback-seams policy. Study both, pick per the evidence, and DECLARE the projection on the AppSpec (config payload + the API endpoints the journeys actually reach, measured from the app's own bytes/requests — never invented behavior; the projection must be identical for both lanes so parity stays meaningful).
- Login/identity (IdentityServer redirect) is likely honestly out of surface — if so, record the truthful surface limitation (the Judge pre-approved this) and scope journeys to what the anonymous surface genuinely allows.
  JOURNEYS (3+ where the surface allows, real interactions — click/type/filter/scroll — settled-reaction anchors, never timing): catalog browse with real product rendering, brand/type filter interactions, and whatever else the anonymous surface genuinely supports (measure the live DOM the u19/u20 way: run, correct pins to measured reality, iterate). Pass-twice reseed/determinism per lane (the projection is stateless static + declared payloads, so determinism should be clean — prove it); two-lane normalized behavior digest parity (per-lane declared presentation differences stay out); zero successful non-loopback; no PII.
  MUTATION-RED/BYTE-RESTORE: a deliberate behavior-breaking mutation on the migrated lane (established pattern from the other verticals) makes the parity gate go RED, then byte-identical restoration goes green — record both runs.
  Schema/receipt shapes: add the witness AppSpec/schema for eShop in `packages/core/src/receipts/` + runner wiring in `packages/cli/src/witness/` + drivers in `packages/cli/src/fixture/`, mirroring witness-react-cypress-rwa/witness-real-app patterns, all pins measured. Node-gate tests protect the pins. Evidence to `evidence/runs/angular-eshop-webspa/**` (not the holdout ledger dir — that is the publish unit's).

## File contract

- `packages/core/src/receipts/**`
- `packages/core/src/index.ts`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-eshop-webspa/**`
- `fixtures/angular-eshop-webspa/**`

## Forbidden moves

- NO packages/frameworks/** edits (frozen — a lane break is RED evidence first). No app-source hand edits. No invented API behavior beyond what the app's own bytes/requests define; the projection is declared data, identical across lanes. No timing waits; no test weakening; no PII; loopback only (S3/CDN-style external resources get declared mocked seams). No canonical/holdout receipt publish. Do not touch evidence/runs/holdout-\*/**, evidence/trust/**, packages/trust/**. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes; leave nothing listening.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
sh -c 'ls evidence/runs/angular-eshop-webspa'
```

## Blocked permission

If a real behavioral divergence appears between lanes (RED first with the measurement — the falsification result), the projection cannot be declared without inventing behavior (bring the analysis), determinism fails (bring digests), the mutation gate will not go red (bring the run), or the work exceeds this unit (say which journeys/lanes are green and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
