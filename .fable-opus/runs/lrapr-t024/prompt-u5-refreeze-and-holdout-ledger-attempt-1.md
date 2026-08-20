Fable-Opus-Unit: lrapr-t024/u5-refreeze-and-holdout-ledger
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: A third freeze supersession plus dual holdout-ledger publication where the pigallery2 RED must stay byte-immutable while the eShop measured state is published honestly (green migrated build under the reopened adapter, witness not yet run) — precision over what is and is not claimed is the entire value of these surfaces.

## Goal

Stage: re-freeze after the T024 chase and publish the Angular holdout ledger honestly, in /Users/jacksm5pro/dev/open-source/versionless. NO witness journeys yet (next unit). Mirror the T019-u1 and T023-u1 patterns exactly.

1. RE-FREEZE: recompute the composite at HEAD over the five subtrees. React MUST still be `972ca80155bbc2a6eb3779943cd481b71d35e803`; Angular has legitimately moved (T024 authorized reopen). Update `packages/trust/src/freeze.ts` (composite, commit, subtree oids) + append the supersession record (chain d9f75ef6 -> 5de7df56 -> 4df7bc96 -> f1a63359 -> NEW) citing the authorized T024 reopen (9 new capabilities/rules from the eShop chase: silence-defect reporting, community readings, superseded-era-lockfile, workspace-script-flags, use-position-symbol-successor, removed-static-module-method, rxjs-prototype-patch + tilde-sass composition, http-client-call-surface, package-exports republishedSubpath). All new capabilities stay single-app/experimental in the freeze's experimental list. `buildAdapterFreezeRecord()` must validate.
2. HOLDOUT LEDGER: extend the Angular holdout ledger surface (the T023-u1 `holdout-angular-pigallery2` pattern) with the eShop entry: a derived receipt module + `evidence/runs/holdout-angular-eshop-webspa/receipt.json` sha256-bound to the sealed ingest/migration evidence, recording HONESTLY: gate-zero passed via the T022 overturn ruling; RED at install under frozen f1a63359 (the T023-u5 event — that record stands); then GREEN migrated build x2 byte-identical under the AUTHORIZED T024 reopen (the new fingerprint); witness journeys NOT yet run — the entry's outcome field must say exactly what is proven (migrated-build-green-witness-pending or the ledger's closest honest state), countedInLineageNumerator: false. pigallery2's entry stays byte-identical.
3. conformance cross-checks + trust surfaces updated; regenerate trust artifacts OFFLINE; `trust:verify --offline` valid; the report carries the new composite + both Angular holdout entries + the boundary (5-of-6 prevalence + population statement) unchanged.

## File contract

- `packages/trust/**`
- `packages/core/src/receipts/**`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/test/**`
- `packages/cli/src/fixture/**`
- `evidence/trust/**`
- `evidence/runs/aggregate.json`
- `evidence/runs/holdout-angular-eshop-webspa/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- NO packages/frameworks/\*\* edits (the freeze records; it does not move). No witness work. Never touch pigallery2's receipt bytes, the React holdout receipt, or any sealed record. No overclaim: the eShop entry must NOT read as a passed holdout (witness pending; the RED-under-f1a63359 stands as history). No hand-edits to generator-owned artifacts. No test weakening. Offline. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-INTACT'
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
sh -c 'node -e "const r=require(\"./evidence/runs/holdout-angular-eshop-webspa/receipt.json\"); if(!r) throw new Error(\"missing\"); console.log(\"eshop ledger entry present\")"'
```

## Blocked permission

If the composite does not validate (bring numbers), the honest eShop outcome state has no existing ledger vocabulary (bring the options — do not invent an overclaiming one), or trust:verify fails after clean regeneration (bring the mismatch), return status "blocked" with specifics in open_questions instead of improvising.
