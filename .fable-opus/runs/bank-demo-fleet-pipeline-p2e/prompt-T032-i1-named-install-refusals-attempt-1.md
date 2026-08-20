Fable-Opus-Unit: bank-demo-fleet-pipeline-p2e/T032-i1-named-install-refusals
Fable-Opus-Timeout-Minutes: 35

## Goal

Items (i) and (ii) of board task T032 — two measured defect:install rows become named, countable refusals, in the exact mold of the four existing install policies (the fourth, `--allow-foreign-lockfile`, landed at commit b3d0c14; read its shape in `packages/cli/src/operator/install.ts` first — it is the freshest example of the house pattern).

(i) **Git-protocol dependencies**: npm refuses `git+ssh://` dependencies with EALLOWGIT unless allowed (measured on coverview: `file-saver@git+ssh`). Today that lands as defect:install. It becomes the named refusal `install.git-dependency-policy-not-declared`, converted by a FIFTH declared fleet-wide policy `--allow-git-dependencies` — default OFF, refusal byte-carrying npm's error text VERBATIM (the card is explicit: never paraphrase npm), declared path recording the policy + which git dependencies were allowed (name@spec list read from the failure/lockfile) on the install row, threaded through flows/run/batch exactly like the other four.

(ii) **Unreachable pinned registry**: an install whose closure pins an unreachable registry (measured on antd-admin: CERT_HAS_EXPIRED on registry.npm.taobao.org) becomes the named refusal `install.closure-registry-unreachable`, carrying the registry URL and npm's error text verbatim. This one is a REFUSAL with no policy — there is no honest "proceed anyway" for an unreachable registry; the remedy (re-pinning the registry) is a migration concern, and the refusal message may say so. Classification detail: distinguish it from transient network conditions honestly — the detection should key on npm's error classes for registry connection/certificate failures (CERT_HAS_EXPIRED, and the obvious siblings the npm source names — ENOTFOUND/ECONNREFUSED against the registry host, cert errors), each recorded verbatim; do not build a general network-error taxonomy beyond what the measured cases justify.

Both must be reproducible in tests WITHOUT network: drive the classification seam directly (the install stage's npm-failure interpretation point) with captured npm error output shapes — look at how existing install refusal tests fake npm outcomes. If the measured error texts (coverview EALLOWGIT, antd-admin CERT_HAS_EXPIRED) exist in evidence (`evidence/runs/**` pass-3 rows or T030-era notes in the OLD goal dir `docs/goals/legacy-react-angular-production-readiness/`), quote them exactly in tests; if not on disk, construct the npm error shape from npm's own documented output for those codes and say so in the receipt.

Census: two new sites → regenerate + the u10 ordering (census, then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`), then verify. NO batch re-run in this unit (the card's "fourth batch pass" needs the old six-app corpus staged; that is a later unit once T045's acquire-based grind runs — record this deferral in your receipt).

GUARDS: coverage totals {23,11,2,5,5}; matrix 6/6+4/4; composite `140ce86e`; frozen subtrees + trust/src/freeze.ts untouched; suite green.

## File contract

- `packages/cli/src/operator/install.ts`
- `packages/cli/src/operator/flows.ts`
- `packages/cli/src/operator/run.ts`
- `packages/cli/src/operator/batch.ts`
- `packages/cli/test/**`
- `evidence/runs/operator-flows/refusal-census.json`
- `evidence/trust/current/**`

## Forbidden moves

- Defaults unchanged: undeclared behavior for every OTHER npm failure class stays byte-for-byte (defect:install remains the honest home for the unclassified). Why: named refusals are earned by measurement, not by pattern-matching enthusiasm.
- No paraphrase of npm error text anywhere. Why: card constraint — the verbatim text is what an operator debugs with.
- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. No git commit, no stash/checkout/reset/clean.

## Verification

```verify
pnpm exec vp test --project node
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');const codes=d.census.entries.map(e=>e.code);for(const c of ['install.git-dependency-policy-not-declared','install.closure-registry-unreachable']){if(!codes.includes(c))throw new Error('missing '+c)}console.log('CENSUS-OK sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If the npm-failure classification seam cannot distinguish the two cases without a general taxonomy, if the measured error texts cannot be located or reconstructed honestly, or if the policy pattern cannot express git-dependency allowance without new machinery, return status "blocked" with the question in open_questions instead of improvising.
