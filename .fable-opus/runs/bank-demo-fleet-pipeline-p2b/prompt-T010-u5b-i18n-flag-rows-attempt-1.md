Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u5b-i18n-flag-rows
Fable-Opus-Timeout-Minutes: 35

## Goal

Delta item 7 of the T010 supersession, re-cut after unit u5's blocked findings (read its open_questions in the run ledger if useful — but this packet incorporates all four rulings). The tree carries uncommitted Phase B work (u3: published 13 cell). PM rulings binding this unit:

1. **THREE rows, not four**: `--i18n-locale`, `--i18n-format`, `--i18n-file` in `REMOVED_ANGULAR_CLI_FLAGS` (`workspace-script-flags.ts:74`), `removedAfterMajor: 12`, no successor flag (the successor is the `$localize` runtime — say so in the row's prose). `--i18n-missing-translation` was MEASURED as surviving at 13 (13.3.11 `src/builders/browser/schema.json:216`, enum warning|error|ignore) — it gets a NEGATIVE test pinning that it is NOT removed, and no row.
2. **Value capture is authorized**: add an optional value-carrying marker to `RemovedCliFlag` (e.g. `carriesValue: true`) and make the CLI-flag removal path consume the separated value token (`--i18n-locale en`) and the `=`-joined form (`--i18n-format=xlf`) so neither strands a dangling token. Widen `ScriptFlagChange.from` to the full flag+value span so the removed VALUE survives on the change record (it is the only surface it can survive on — `describeScriptFlagChange`, `angular-cli-era-migration.ts:388`). This is additive capture, not a recording redesign: do not add new record types or readings.
3. **The sealed 16 path legitimately moves, and this unit owns the movement.** The pinned pigallery2 corpus `package.json` carries `run-dev` and `build-stats`, both `ng`-first, both passing `--i18n-locale en --i18n-file frontend/translate/messages.en.xlf`. At the 16 cell those flags are equally removed (removedAfterMajor 12 < 16), so the current sealed migration output preserves scripts that would die on `Unknown option` — trimming them is a defect fix, authorized under the T010 reopen and to be named in u10's reopenReason. Consequences you must carry IN THIS UNIT:
    - Regenerate `evidence/runs/operator-flows/byte-identity.json` by running `node packages/cli/src/fixture/operator-flow-byte-identity-run.ts` AFTER your change; it must land `identical: true` with operator and driver digests equal (new value, both moved together).
    - Update the changeset/output digest constants in `packages/core/src/receipts/holdout-angular-pigallery2.ts` that the new scripts.changes falsify. STRICT LIMIT: only digests of migration OUTPUT (changeset/manifest/records) may move, each one named in your receipt with old→new. The HISTORY pins — the adapter-freeze composite the receipt ran against (`f1a63359…`) and any Angular subtree oid (`1f63f32c…`) — must NOT move; they are history per `freeze.ts:52-56`. If you cannot separate the two classes, stop blocked.
    - If any OTHER receipt or evidence surface moves (another corpus carrying i18n flags), stop blocked and name it — do not widen your own contract.
4. **Tests** (`workspace-script-flags.test.ts`): the three rows; value-carrying removal in both token forms (no dangling value); the negative test for `--i18n-missing-translation`; the `ng`-first gate still ignores non-ng scripts (pigallery2's gulp `build-prod` untouched); a 13-cell case. Check whether existing tests pin the OLD pigallery2 script translation (16-cell) byte-for-byte and update only those assertions that the honest new output falsifies.

Evidence grounding: `evidence/runs/angular-13cell/README.md` item 7, the corpus manifest at `.versionless/cache/angular-pigallery2-v1-7-0-source/corpus/pigallery2-6d44c22*/package.json` (read it), and the 13-cell lane's builder schema for the survivor flag.

## File contract

- `packages/frameworks/angular/src/workspace-script-flags.ts`
- `packages/frameworks/angular/test/workspace-script-flags.test.ts`
- `packages/core/src/receipts/holdout-angular-pigallery2.ts`
- `evidence/runs/operator-flows/byte-identity.json`

## Forbidden moves

- Do not touch u3's uncommitted work (`angular-target-cell.ts`, `era-cell.ts`, their tests) or any other frozen file. Why: one subtree-moving concern per unit; the accumulated Phase B diff must decompose per-unit. (`packages/core/src/receipts/` is NOT in the five frozen subtrees — migrations/bundlers/analysis are.)
- Do not move any history pin (freeze composite, subtree oid) in the holdout receipt. Why: `freeze.ts:52-56` — receipts pin composites as history; updating them breaks the evidence chain.
- Do not run `git commit` or `vp pack`. Why: Phase B accumulates uncommitted until u10 cuts commit X.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: the tree carries uncommitted Phase B work these commands would destroy.

## Verification

```verify
pnpm exec vp test --project node
node -e "const b=require('./evidence/runs/operator-flows/byte-identity.json');if(b.identical!==true)throw new Error('not identical');if(b.operatorDigest!==b.driverDigest)throw new Error('digests differ');if(b.operatorDigest==='2b85d619387263e1974ec5ee3c13ac3429548405a988b504a650b575a780d6e3')throw new Error('digest did not move - the sealed-path change did not land');console.log('BYTE-IDENTITY-MOVED-TOGETHER '+b.operatorDigest.slice(0,8))"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-BYTE-IDENTICAL sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
git diff --name-only HEAD -- packages/frameworks | sort | tr '\n' ' ' | grep -q 'packages/frameworks/angular/src/angular-target-cell.ts packages/frameworks/angular/src/workspace-script-flags.ts packages/frameworks/angular/test/angular-target-cell.test.ts packages/frameworks/angular/test/workspace-script-flags.test.ts' && echo FROZEN-DELTA-EXACTLY-FOUR-FILES
```

The FULL node suite is the first gate because the sealed-path movement can falsify pins anywhere — a targeted list would miss exactly the surface we did not predict. receipt:verify and corpus:verify prove the holdout-receipt edit kept every other receipt green. The byte-identity check asserts the digests MOVED (a no-op means the change did not reach the sealed path) and moved TOGETHER (identical:true).

## Blocked permission

If a digest constant you must change cannot be classified cleanly as output-vs-history, if any surface outside your contract moves (another receipt, another corpus, the witness records), or if the full suite fails on something this packet did not predict, return status "blocked" with the question in open_questions instead of improvising.
