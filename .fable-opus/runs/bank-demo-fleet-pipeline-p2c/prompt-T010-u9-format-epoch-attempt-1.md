Fable-Opus-Unit: bank-demo-fleet-pipeline-p2c/T010-u9-format-epoch
Fable-Opus-Timeout-Minutes: 35

## Goal

Phase C of the T010 supersession: the format epoch. Per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §4 and §5 u9, and the T003 ruling it cites ("reformat the whole repository in one commit" — the commit itself is cut later at u10; your unit produces the reformatted tree). The tree carries ALL of Phase B uncommitted (u3, u5b, u6, u7 — 13 cell, i18n rows, locale provider, composition, plus regenerated trust/census evidence). Do not disturb any of it beyond what the formatter itself does.

Two steps, mechanically coupled (sizing R4):

1. **`pnpm exec vp fmt packages`** — the epoch is a `packages/` epoch (`vite.config.ts:100-108` excludes `docs/**` and `evidence/**`; repo-wide fmt also trips on untracked `.claude/worktrees/**` parse errors, so run it on `packages` explicitly). NO hand edits to any file — if the formatter's output breaks something, that is a finding to report, never something to patch around by hand. The sizing measured ~260 non-canonical files at HEAD, 82 inside the frozen subtrees (angular 74, react 8, core-frozen 0); Phase B added new/edited files that may raise the count — take what `vp fmt --check packages` says before you write, record the number, then format.
2. **Regenerate the census in the same unit**: `node --experimental-strip-types packages/cli/src/cli.ts refusal-census --out evidence/runs/operator-flows/refusal-census.json`. The census pins per-site line numbers across the scanned roots and demands byte-identity with a fresh derivation; the reformat moves those lines (101 frozen-adapter sites among 192).

Then prove the reformat changed FORM ONLY:

- `pnpm exec vp fmt --check packages` exits clean (canonical form reached).
- The full node suite passes — behavior unchanged.
- The sealed-path byte-identity digest is UNCHANGED at `a044d716…` (`evidence/runs/operator-flows/byte-identity.json` `.angular`) — migration outputs are data, not source form; if fmt moved a digest, a template literal or string carrying load-bearing whitespace got reformatted, and that is a blocked-level finding naming the file.
- `npm run trust:verify -- --offline` stays `valid:true` — the trust package pins built dist and evidence, not source form. Do NOT run `vp pack` or `trust:generate`; if trust:verify goes red, stop blocked and name what moved.
- Matrix react 6/6 / angular 4/4, coverage totals {21,11,2,5,3}, composite `27741d9c` — all verbatim.

Report in your receipt: the pre-format non-canonical count (total and per-subtree for the five frozen subtrees), and confirmation the two frozen subtrees that must NOT move content-wise (`packages/core/src/{migrations,bundlers,analysis}`) took zero fmt changes (the sizing measured 0 deviations there — verify, don't assume).

## File contract

- `packages/**`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- No hand edits — every `packages/**` change in this unit must be formatter output, and the only other change is the census regeneration. Why: the u10 supersession record will describe this unit as "reformat + census, nothing else"; a single hand edit makes that sentence false.
- Do not run `git commit`, `vp pack`, or `trust:generate`. Why: commit X is u10's; trust regen is u11's.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: the tree carries all of Phase B uncommitted.

## Verification

```verify
pnpm exec vp fmt --check packages
pnpm exec vp test --project node
node -e "const b=require('./evidence/runs/operator-flows/byte-identity.json').angular;if(b.identical!==true||!b.operatorDigest.startsWith('a044d716'))throw new Error('sealed digest moved under fmt: '+b.operatorDigest.slice(0,8));console.log('SEALED-DIGEST-UNMOVED-BY-FMT')"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-BYTE-IDENTICAL sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('composite moved');console.log('COMPOSITE-STILL-27741d9c')"
git diff --quiet HEAD -- packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo CORE-FROZEN-UNTOUCHED
```

`fmt --check` first: the epoch's whole claim is canonical form, asserted by the same gate that failed to assert it historically. The suite and the digest checks are the form-only proof.

## Blocked permission

If the formatter changes behavior anywhere (suite failure, digest movement, trust red), if `core/src/{migrations,bundlers,analysis}` takes fmt changes the sizing said were zero, or if canonical form is unreachable (formatter self-disagreement), return status "blocked" with the file named in open_questions instead of improvising.
