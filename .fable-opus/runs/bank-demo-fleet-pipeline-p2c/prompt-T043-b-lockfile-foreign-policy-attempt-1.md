Fable-Opus-Unit: bank-demo-fleet-pipeline-p2c/T043-b-lockfile-foreign-policy
Fable-Opus-Timeout-Minutes: 35

## Goal

Item (c) of board task T043 — the highest-value measured admission item: a DECLARED policy for the `install.lockfile-foreign` refusal, in the exact mold of the three existing install policies (`--allow-remote-tarballs`, `--allow-install-scripts`, `--allow-peer-conflicts`). T012-b1 measured it stopping `angular2-hn` (yarn `yarn.lock`, Angular 9) at 6/9 stages, and it is already measured on the react lineage too — era-appropriate apps overwhelmingly carry yarn-era lockfiles, so this single gate is the widest admission wall on the board.

Read first: `packages/cli/src/operator/install.ts` — the lockfile-foreign vs lockfile-absent distinction, the three existing policy flags (how each is declared, threaded, recorded on the run record, and how the refusal stays the default), and the sandbox/boundary machinery that must keep applying. Also `evidence/runs/angular2-hn/run-record.json` — the measured refusal row this policy must convert.

Semantics (PM-ruled, binding):

1. New flag `--allow-foreign-lockfile`, default OFF — undeclared, the refusal is byte-for-byte today's. Following the existing policy pattern in `flows.ts`/`run.ts` value-flag tables and `batch.ts` forwarding (policies forward per-batch like the existing three).
2. Declared, install PROCEEDS WITHOUT the foreign lockfile: fresh npm resolution from the manifest, the foreign lockfile left untouched on disk and NOT consulted. The run record's install row must state, by name: the policy taken (`allow-foreign-lockfile`), which foreign lockfile was disregarded (path + kind, e.g. yarn/`yarn.lock`), and the honesty consequence — resolution is NOT pinned by the era lockfile, so the installed closure may drift from what the era app shipped with; downstream claims are bounded by that drift. Look at how the other three policies phrase their recorded consequence and match the house style.
3. This is a POLICY, never an inference: no auto-detection that "yarn.lock is fine to ignore." The operator declares it or the refusal stands.
4. If install.ts distinguishes sub-cases today (lockfile-foreign vs lockfile-absent), the policy converts ONLY lockfile-foreign; lockfile-absent semantics unchanged.

Tests (`packages/cli/test/` — the file that covers install policies today; extend it): undeclared → refusal unchanged (code, stage, message class); declared → install proceeds, run-record install row carries the policy name + disregarded lockfile + drift statement; lockfile-absent path unaffected; batch forwards the flag like the other three.

Proof on the real corpus: re-run `angular2-hn` through the batch runner with the new policy declared alongside the existing three (`--cell angular-13.4.0`, same invocation shape as T012-b1's — read `notes/T012-angular-batch.md`). The wall must move from install to wherever truth stops it next (a later stage, a new refusal, a defect — all honest outcomes; T012-b2's cdk ETARGET defect may well be next, and measuring it on a SECOND app strengthens T044's owner case). Append the outcome to the T012 note (do not rewrite existing sections), publish per the batch ordering, T028 proven bar binds.

GUARDS: react 6/6 verbatim; angular 4/4 may only grow; composite `140ce86e`; census will shift (install.ts is scanned, new policy prose) — regenerate it and say so; coverage totals move only by what the re-run honestly records.

## File contract

- `packages/cli/src/operator/install.ts`
- `packages/cli/src/operator/flows.ts`
- `packages/cli/src/operator/run.ts`
- `packages/cli/src/operator/batch.ts`
- `packages/cli/test/**`
- `evidence/runs/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. Why: composite 140ce86e stands; T044 is owner-gated.
- Do not weaken the default: undeclared behavior must be byte-for-byte today's refusal. Why: refusals are the product's honesty; policies are declared exceptions, not new defaults.
- Do not auto-detect or infer the policy from the lockfile kind. Why: the boundary between measurement and operator declaration is the adapter's whole discipline.
- No `git commit`, no `git stash` / `checkout --` / `reset` / `clean`.

## Verification

```verify
pnpm exec vp test --project node
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE-140ce86e')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
node -e "const r=require('./evidence/runs/angular2-hn/run-record.json');const rows=r.stages||[];const i=rows.find(s=>(s.stage||s.name)==='install');if(!i)throw new Error('no install row');const s=JSON.stringify(i);if(!s.includes('allow-foreign-lockfile'))throw new Error('policy not recorded on install row');console.log('POLICY-RECORDED-ON-RUN-RECORD')"
```

## Blocked permission

If the existing policy pattern cannot express "proceed without the lockfile" without new machinery, if the angular2-hn re-run needs a human hand, or if converting the refusal exposes a sub-case this packet's semantics do not cover honestly, return status "blocked" with the question in open_questions instead of improvising.
