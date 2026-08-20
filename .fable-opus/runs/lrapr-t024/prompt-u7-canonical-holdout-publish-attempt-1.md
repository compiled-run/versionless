Fable-Opus-Unit: lrapr-t024/u7-canonical-holdout-publish
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: The canonical holdout publication is the goal's central claims artifact — the ledger transition from witness-pending to its passed state must use exactly the honest vocabulary, keep every historical RED byte-immutable, carry the truthful surface scope, and survive independent offline verification; an overclaim here corrupts the entire oracle.

## Goal

Publish the eShop WebSPA holdout canonically in /Users/jacksm5pro/dev/open-source/versionless (T024's final stage; freeze 27741d9c — React `972ca80155bbc2a6eb3779943cd481b71d35e803` / Angular `4b6e2f4494d98582e4fe9b420c2b412059dc0720` untouchable, verify before/after). The witness evidence is sealed at `evidence/runs/angular-eshop-webspa/` (u6, commit d140a53: parity 585ae9ec across 4 runs, per-lane determinism, mutation-red/byte-restore, successfulNonLoopback 0, honest out-of-surface records).

1. UPDATE THE HOLDOUT LEDGER ENTRY (`packages/core/src/receipts/holdout-angular-eshop-webspa.ts` + `evidence/runs/holdout-angular-eshop-webspa/receipt.json`): transition from `migrated-build-green-witness-pending` to the honest passed state — the vocabulary must state exactly what is proven: gate zero via the T022 overturn; install RED under f1a63359 retained as history; migrated build GREEN x2 byte-identical under the authorized reopen; re-frozen at 27741d9c with the witness run POST-freeze under byte-identical adapter output; witness parity/determinism/mutation/locality GREEN with the journey scope truthfully bounded (anonymous catalog surface; identity/basket/orders/campaigns out-of-surface; SignalR not-reached; text-entry/drag not-tested). The four anti-overclaim mutation guards must be UPDATED to protect the new honest state (refusing RED-erasure, scope-inflation, witness-overclaim beyond the recorded legs, and reopen-hiding) — never deleted. Whether `countedInLineageNumerator` flips is NOT yours: leave it false with a note that counting is the Judge's (the established counting-is-a-separate-layer discipline).
2. sha256-bind the new receipt to the sealed witness evidence files; canonical digest; the pigallery2 entry and React holdout receipt stay byte-identical.
3. conformance cross-checks updated; trust artifacts regenerated OFFLINE; `trust:verify --offline` valid; report renders the eShop entry by its own honest sentence (witness-passed-on-bounded-surface, not a generic "passed").
4. Offline independent verification: `receipt:verify` on the updated holdout receipt from a clean process.
5. Board note `docs/goals/legacy-react-angular-production-readiness/notes/t024-canonical-publish.md` summarizing the full T024 chain with commit refs.

## File contract

- `packages/trust/**`
- `packages/core/src/receipts/**`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/test/**`
- `evidence/trust/**`
- `evidence/runs/aggregate.json`
- `evidence/runs/holdout-angular-eshop-webspa/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- NO packages/frameworks/\*\* edits; no witness re-runs (the sealed evidence is the input); never touch pigallery2/React receipts or any sealed witness file; no counting flip; no overclaim vocabulary; no guard deletion; no hand-edits to generator-owned artifacts; no test weakening. Offline. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts receipt:verify evidence/runs/holdout-angular-eshop-webspa/receipt.json
```

## Blocked permission

If the honest passed-state vocabulary cannot be expressed without overclaiming (bring the options), a guard cannot be updated without weakening (bring it), or any verify fails after clean regeneration (bring the mismatch), return status "blocked" with specifics in open_questions instead of improvising.
