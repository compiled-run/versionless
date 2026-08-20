Fable-Opus-Unit: lrapr-t010/u3-trust-regen-at-head
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the two PM rulings from the T010-u2 findings (commit 298348e) in /Users/jacksm5pro/dev/open-source/versionless, restoring a fully green gate suite at HEAD. Freeze `27741d9c` — React `972ca80155bbc2a6eb3779943cd481b71d35e803` / Angular `4b6e2f4494d98582e4fe9b420c2b412059dc0720` — byte-untouchable, verify before/after.

1. TRUST REGENERATION AT HEAD (PM-authorized; precedents T019-u2/T023-u1/T024-u5/T009-u1): run `pnpm exec vp pack` (deterministic; builds HEAD's dist), then the offline trust generator (`VERSIONLESS_NETWORK_MODE=offline ... trust:generate --offline --policy trust/policy.json --output evidence/trust/current`) so provenance.json attests the dist HEAD actually produces. Confirm: the deterministic core stays `656e861a…` (it must not move — if it moves, STOP and report); the outer digest + provenance move as expected; the enterprise artifacts re-derive; `trust:verify --offline` valid; the 3 previously-red operator-flows tests green.
2. FMT DEVIATION RECORD: add a declared-deviation record to the release-candidate evidence (`evidence/runs/clean-checkout-2026-08-14/fmt-deviation.json` + a section in the goal note): the `vp fmt --list-different` inventory (249 files with the per-directory counts from the u2 receipt: 89 packages/cli/src, 74 packages/frameworks/angular, 36 packages/cli/test, 18 packages/core/src, 17 packages/core/test, 8 packages/frameworks/react, 5 packages/trust/src, 2 packages/trust/test), the ruling (82 files inside frozen subtrees — reformatting would break the freeze composite and the sealed byte-identity chains; cosmetic-only; format epoch deferred to tranche-two), and the honest gate status (vp fmt not green at HEAD; recorded, not hidden). Do NOT reformat anything.
3. Update `evidence/runs/clean-checkout-2026-08-14/summary.json` gates block to the final state: every gate's true value (fmt: declared-deviation; everything else green after regeneration). Re-run the full serialized gate suite to confirm: tsc, vp lint, vp pack (second run byte-stable), vp test --project node, receipt/corpus/trust verifies, report:enterprise --verify-only.

## File contract

- `evidence/trust/**`
- `evidence/runs/clean-checkout-2026-08-14/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- No product/package source changes; no reformatting; no frozen-subtree bytes; no sealed-receipt (evidence/runs/holdout-\*, evidence/runs/angular-eshop-webspa, aggregate) changes; no hand-edits to generator-owned artifacts. Offline. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
sh -c 'node -e "const r=require(\"./evidence/runs/clean-checkout-2026-08-14/summary.json\"); if(!r.gates||!r.gates.finalState) throw new Error(\"no final gates\"); console.log(\"gates final:\", JSON.stringify(r.gates.finalState).slice(0,220))"'
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
```

## Blocked permission

If the deterministic core moves under regeneration (STOP — bring both values), vp pack is not byte-stable across two runs (bring the diff), the operator-flows tests stay red for a non-provenance cause (name it), or anything else needs a source change, return status "blocked" with specifics in open_questions instead of improvising.
