Fable-Opus-Unit: lrapr-t010/u1-clean-checkout-holdout-reexecution
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: The clean-checkout reproduction is the goal's independent-verifiability claim made real — a fresh tree, offline, must reproduce the gates and both holdouts' live browser results under the recorded freeze; distinguishing genuine reproduction failures from environment/staging artifacts without patching evidence is the high-judgment part.

## Goal

T010 core (T025-amended) in /Users/jacksm5pro/dev/open-source/versionless: from a CLEAN CHECKOUT and offline post-ingest environment, reproduce the repository gates and FRESH LIVE browser re-execution of BOTH holdouts under freeze `27741d9c` (React `972ca80155bbc2a6eb3779943cd481b71d35e803` / Angular `4b6e2f4494d98582e4fe9b420c2b412059dc0720`), closing the T019 parity-gate fidelity caveat. The full 10-app portfolio rerun is the NEXT unit.

1. CLEAN CHECKOUT: create a fresh `git worktree` at current HEAD (outside the main tree's .versionless), record HEAD sha + freeze recompute in it. Offline dependency install (the repo's pnpm store/cache conventions — no registry network; record what the install actually needed).
2. REPOSITORY GATES in the clean tree: `pnpm exec tsc --noEmit`, `vp fmt`, `vp lint`, `vp pack`, `vp test --project node`, plus the offline receipt/corpus/trust verifies. Record each result honestly.
3. FRESH LIVE HOLDOUT RE-EXECUTION (the load-bearing amendment). For EACH holdout (react-cypress-rwa, angular-eshop-webspa): re-materialize the lanes from the recorded immutable inputs per the repo's established offline-rebuild machinery (the archives + era cells are on this host under .versionless/cache — staging them into the clean worktree's environment is permitted offline reuse of consented ingest bytes; record exactly what was staged and its hashes vs the recorded identities), then run the ACTUAL witness journey drivers fresh — real browser, both lanes, the same passes the sealed evidence records (React: the two-lane calibrate/parity flow with live loopback backend; Angular eShop: the declared same-origin projection flow) — and compare the freshly measured digests to the sealed ones (React parity 963785…, semantic 5c3285/54313316; eShop parity 585ae9ec). A digest match is the reproduction proof; a mismatch is a finding to report exactly (never patch evidence to match).
4. Record everything under `evidence/runs/clean-checkout-2026-08-14/**` (gates, staging manifest, fresh digests vs sealed, environment facts, deviations). Unknowns preserved; failures visible; no product code changes (a rerun needing one is a stop condition).
5. Clean up the worktree afterward per the repo's conventions (keep the evidence, remove the tree) — or keep it if removal would lose non-reproducible state (say which).

## File contract

- `evidence/runs/clean-checkout-2026-08-14/**`
- `docs/goals/legacy-react-angular-production-readiness/**`
- `fixtures/**`

## Forbidden moves

- No product/package code changes anywhere (reproduction only; a needed change is a blocked finding). No evidence patching to force digest matches. No non-loopback network. No sealed-record modifications. Do not commit or stage. Kill all processes; leave nothing listening; no stray worktrees with uncommitted product changes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'node -e "const r=require(\"./evidence/runs/clean-checkout-2026-08-14/summary.json\"); if(!r.gates||!r.holdouts) throw new Error(\"incomplete\"); console.log(\"clean-checkout summary:\", r.holdouts.reactParityMatch, r.holdouts.eshopParityMatch)"'
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
```

## Blocked permission

If the offline install cannot complete from local stores (bring what was missing), a fresh digest mismatches its sealed value (bring both digests + the diff surface — a REAL finding), the era runtimes cannot stage into the clean environment (bring the exact failure), or the work exceeds this unit (say which gates/holdouts completed), return status "blocked" with specifics in open_questions instead of improvising.
