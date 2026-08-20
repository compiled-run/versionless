Fable-Opus-Unit: lrapr-t006/u24-angular-two-aggregate-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the aggregate/conformance/trust transition for the two Angular cohort-two verticals in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change — the established d7/h4b/m4/u13 pattern (u13's three-cell React-trio transition, commit `ffe4ce3`, is the closest template). Commit `c609eb1`: canonical witness receipts exist for tiny-translator (`evidence/runs/witness-angular-tiny-translator-v0-12-0/`, digest 65b0a976) and super-productivity (`evidence/runs/witness-angular-super-productivity-v2-13-15/`, digest 5d8ed797).

1. Derived append tools per the established idiom (one per cell; verify each witness receipt's actual binding shape and follow it — single-member for a receipt that seals its build receipts, like the factoriolab/jira-clone Angular precedent). Run each append for real in a declared order (tiny-translator → super-productivity), each refusing anything but its exact predecessor state.
2. `packages/core/src/corpus/conformance.ts`: derived vertical rows + source applications for both; new kinds per the established Angular naming idiom (`angular-tiny-translator-browser-proof`, `angular-super-productivity-browser-proof` or the repo's exact shape).
3. `packages/trust/src/`: the two kinds wired; matrix cells derived; counts MEASURED post-append at each step and pinned at the final state (expect roughly 25→27 receipts, 18→20 verticals, 10→12 apps, 23→25 cells — pin what reality yields, report each step); existing kinds untouched, nothing loosened. Sensitive-scan trips on any revision → blocked. (tiny-translator revision `08dcacf6…`, super-productivity `2943c5c4…` — both should pass the existing generic admission.)
4. Move every pre-append pin to exact measured final values (pins move, never loosen) across the established change surface; staged-copy re-append tests per the papercups pattern.
5. angularLineage readiness: both receipts declare counted:false pending Judge — angularLineage judgeCounting stays 2/4 with the two new cells visible-but-uncounted (the judgeCounting/holdouts precedent: never forced, never hidden).
6. `vp pack` BEFORE `trust:generate`. Whole repo gate green.

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

If any count cannot derive, any pin would loosen, a scan trips, a closed enumeration outside the contract surfaces, or the two-cell batch exceeds one unit (state which cells landed and the cut), return status "blocked" with specifics in open_questions instead of improvising.
