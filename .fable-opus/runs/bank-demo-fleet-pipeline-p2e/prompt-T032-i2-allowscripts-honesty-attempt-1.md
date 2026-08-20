Fable-Opus-Unit: bank-demo-fleet-pipeline-p2e/T032-i2-allowscripts-honesty
Fable-Opus-Timeout-Minutes: 35

## Goal

The T036 finding on board task T032's card — a recorded-claim defect in the third install policy: npm 12 blocks DEPENDENCY install scripts behind its `allowScripts` mechanism, and `--foreground-scripts` does not grant it, so `--allow-install-scripts` currently records script-allowed installs whose dependency scripts npm SILENTLY SKIPPED. The record claims an allowance the install did not deliver. This unit makes the claim true and the skips visible.

Read first: `packages/cli/src/operator/install.ts` — how `--allow-install-scripts` constructs npm flags today, the T036-era notes if referenced from the card, and npm 12's own allowScripts semantics (probe the HOST npm's docs/behavior — `npm help install`/config for the running npm 12; the flame runs used host npm 12.0.1, and the 13-cell lane used npm 8.19.4 where semantics differ — the fix must be honest under BOTH npm majors the pipeline actually runs).

Card deliverables (choose and justify per the card's own alternative):

1. **Emit the real allowance**: either per-package allowance derived from the lockfile's install-script packages, or `--dangerously-allow-all-scripts`-class fleet-wide declaration — the card says CHOOSE AND JUSTIFY. Decision inputs: the policy's meaning is "the operator declared scripts may run"; an allowance that silently narrows to top-level-only is a lie; per-package from the lockfile is more precise but must not turn into a second inference path. Measure what npm 12 actually accepts (flag names, config forms) before choosing — do not trust this packet's paraphrase of either option's spelling.
2. **Record RAN vs SKIPPED**: the install row must state which install scripts actually ran and which npm skipped, read from npm's own output/behavior, not inferred from the lockfile alone. If npm's output cannot distinguish reliably, record what CAN be read honestly and a notEstablished line for what cannot — never assert ran-ness without a reading.
3. **npm-8 path**: at the 13 cell (npm 8.19.4), `--allow-install-scripts` semantics differ (npm 8 has no allowScripts gate — scripts run under the existing flags). The recording must be per-npm-major honest: an npm-8 install records what npm 8 did, no allowScripts vocabulary leaking into it.
4. Update `evidence/runs/*/lane-install-build.json`-class fixtures ONLY if a test pins the old dishonest recording (the card names lane-install-build.json); do not touch app run records — they are history and their thinness is already documented on the proven row per T042 residual (d), which is a SEPARATE item, not yours.
5. Census: if the policy's prose/condition changes an existing site or adds one, regenerate + u10 ordering (census then trust:generate offline). Tests: shim-npm driven, no network, both npm-major shapes.

GUARDS: coverage totals {23,11,2,5,5}; matrix 6/6+4/4; composite `140ce86e`; frozen subtrees + trust/src untouched (trust regen artifacts excepted); flame's record untouched (its npm-12-skipped boundedness is cited BY T042(d), which needs the current record as-is).

## File contract

- `packages/cli/src/operator/install.ts`
- `packages/cli/src/operator/flows.ts`
- `packages/cli/src/operator/run.ts`
- `packages/cli/test/**`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not touch any app run record (`evidence/runs/<app>/run-record.json`). Why: history; T042(d) cites flame's current thinness.
- Do not weaken the default (no policy declared → scripts blocked exactly as today). Why: refusal/block-by-default is the product.
- No inference of script allowance from lockfile alone presented as a reading of what ran. Why: the whole unit exists because a claimed allowance diverged from delivered behavior.
- No git commit, no stash/checkout/reset/clean.

## Verification

```verify
pnpm exec vp test --project node
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- evidence/runs/react-flame-v2-4-0 evidence/runs/angular2-hn && echo APP-RECORDS-UNTOUCHED
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If npm 12's allowScripts mechanics cannot be measured on this host, if neither allowance form can be emitted without redesigning the policy layer, or if RAN-vs-SKIPPED cannot be read from any honest source, return status "blocked" with the question in open_questions instead of improvising.
