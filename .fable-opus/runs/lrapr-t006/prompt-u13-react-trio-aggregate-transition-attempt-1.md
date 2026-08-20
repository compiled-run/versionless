Fable-Opus-Unit: lrapr-t006/u13-react-trio-aggregate-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the aggregate state transition for ALL THREE new React verticals in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change — the fifth application of the established pattern (h4b `b6ad5cf`, m4 `9228514`, mw2 `57b308a` are templates; batching three cells is new, so the cut line matters). Commit `bc81ec8` era: canonical witness receipts exist for memos (`evidence/runs/witness-react-memos-v0-1-3/`, digest 71964dda), killedbygoogle (`witness-next-killedbygoogle-v3-0-0/`, 660cb502), and LinkFree (`witness-react-linkfree-v0-72-0/`, digest in its receipt).

1. Derived append tools per the established idiom, one per app (factoriolab/jira-clone appends are templates — single-member idiom if the build receipts are sealed inside the witness receipt; verify each receipt's actual binding shape and follow it). Run each append for real, in a declared order (memos → kbg → LinkFree), each refusing anything but its exact predecessor state.
2. `packages/core/src/corpus/conformance.ts`: derived vertical rows + source applications for all three; new kinds per the established naming idiom.
3. `packages/trust/src/`: the three kinds wired; matrix cells derived from conformance rows; counts MEASURED post-append at each step and pinned at the final state (expect roughly 22→25 receipts, 15→18 verticals, 8→11 apps, 20→23 cells — but pin what reality yields and report each step); existing kinds' assertions untouched, nothing loosened. Sensitive-scan trips on any revision → blocked, never worked around.
4. Move every pre-append pin to exact measured final values (pins move, never loosen) across the established change surface; the intermediate staged-copy re-append tests follow the papercups staged-copy pattern for whichever pre-states they pin.
5. Lineage readiness stays honest: all three receipts declare counted:false pending Judge — reactLineage judgeCounting stays 3/4 with the three new cells visible-but-uncounted (verify the coverage shape emits them per the holdouts/judgeCounting precedent: never forced, never hidden).
6. `vp pack` BEFORE `trust:generate` (the established dist-ordering lesson). Whole repo gate green.

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `packages/trust/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`

## Forbidden moves

- No other packages/core/src changes (incl. payment-signals.ts — a scan trip is blocked); no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened; rows derive from receipts; no hand-edited evidence; no forced cells; counted flags untouched.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If any count cannot derive, any pin would loosen, a scan trips, a closed enumeration outside the contract surfaces, or the three-cell batch genuinely exceeds one unit (state which cells landed and the exact cut), return status "blocked" with specifics in open_questions instead of improvising.
