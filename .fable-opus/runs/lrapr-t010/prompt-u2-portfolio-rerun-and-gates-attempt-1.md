Fable-Opus-Unit: lrapr-t010/u2-portfolio-rerun-and-gates
Fable-Opus-Timeout-Minutes: 60
Fable-Opus-Effort: high
Effort-Justification: The release-candidate verification — the full ten-application portfolio browser rerun plus the three previously-UNKNOWN gates, serialized to avoid the measured concurrent-load determinism drift, where any stale/red cell is a stop condition and evidence may never be patched to pass; distinguishing genuine regressions from staging artifacts across ten verticals is the expensive judgment.

## Goal

T010 completion in /Users/jacksm5pro/dev/open-source/versionless (freeze `27741d9c` — React `972ca80155bbc2a6eb3779943cd481b71d35e803` / Angular `4b6e2f4494d98582e4fe9b420c2b412059dc0720` untouchable): the three UNKNOWN gates from u1, then the complete portfolio verification, then the release-candidate evidence record. SERIALIZE everything — u1 measured that React pass-twice determinism drifts under concurrent CPU load; never run witness passes while the test suite or another build is running.

1. THE THREE UNKNOWN GATES FIRST (staging is now in place from u1): `pnpm exec vp test --project node`, `VERSIONLESS_NETWORK_MODE=offline ... trust:verify --offline`, and the script-surface verify (find its exact invocation in package.json/cli). Each must go green or its failure is reported exactly (missing-lane ENOENTs mean staging gaps — stage from the recorded immutable inputs and re-run; a SOURCE defect is a stop condition).
2. PORTFOLIO BROWSER VERIFICATION: rerun the offline portfolio witness verification across the ten counted applications (find the established portfolio/browser verification entry points — the corpus machinery that validated 20 verticals/12 apps in corpus:verify plus whatever live browser portfolio rerun the repo's conventions define; where the canonical receipts define digest-reproduction checks, run them). Any cell stale/skipped/ambiguous/red is a STOP finding with the exact cell named — never patched.
3. LOCALITY + MUTATION SPOT-PROOFS: where the portfolio machinery includes mutation/restoration or locality re-checks, run them; report per-cell.
4. FULL GATE SUITE at the end, serialized: tsc, vp fmt, vp lint, vp pack, vp test --project node, receipt/corpus/trust verifies, report:enterprise --verify-only, supported-matrix regeneration (must reproduce the derived matrix byte-stably or name the diff).
5. RELEASE-CANDIDATE EVIDENCE: extend `evidence/runs/clean-checkout-2026-08-14/` with the portfolio results (`portfolio.json`, updated `summary.json` gates block) + a human-readable release-candidate note in the goal notes. Unknowns preserved; no product code changes.

## File contract

- `evidence/runs/clean-checkout-2026-08-14/**`
- `evidence/trust/**`
- `docs/goals/legacy-react-angular-production-readiness/**`
- `fixtures/**`

## Forbidden moves

- No product/package code changes (a needed change is a blocked finding naming the cell). No evidence patching. No non-loopback network. No sealed-record modifications. No concurrent witness passes. Do not commit or stage. Kill processes; leave nothing listening.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
sh -c 'node -e "const r=require(\"./evidence/runs/clean-checkout-2026-08-14/summary.json\"); if(!r.portfolio) throw new Error(\"no portfolio block\"); console.log(\"portfolio:\", r.portfolio.outcome)"'
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
```

## Blocked permission

If any gate stays red for a SOURCE (not staging) cause (name it — stop condition), any portfolio cell is stale/ambiguous/red (name the cell + evidence), the matrix does not reproduce byte-stably (bring the diff), or the work exceeds this unit (say exactly which gates/cells completed), return status "blocked" with specifics in open_questions instead of improvising.
