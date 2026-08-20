Fable-Opus-Unit: bank-demo-fleet-pipeline-p1d/T040-counter-realpath-tests-green
Fable-Opus-Timeout-Minutes: 30

## Goal

Close the two blockers T039 left, and turn the tree fully green with the clean-tree gate at `count 0`.

Where you start: `trust:verify --offline` is VALID in the main tree (digest `a99892f8…`), coverage `proven 11`, freeze `27741d9c` stable, sealed witness receipts untouched, lint 0 errors, `npm test` **4 failed / 2702 passed / 2 skipped**, and the clean-tree gate reads **`count 225`** where every counted path is the run's own declared output.

**(1) Counter path-resolution defect.** `packages/cli/src/operator/intervention-count.ts` (write-set membership around :480-520; `path.relative(root, file)` at ~:504) relativizes observed writes against a **realpath'd** root (`/private/var/folders/…`) while snapshot paths and the declared write set keep the **symlinked** form (`/var/folders/…` — macOS `mktemp -d`). So under a symlinked root, `insideWriteSet` matches nothing and the run's own `--out` lane, `--record` file and stage receipts count as interventions — the `../../../../../../../..` prefixes in T039's output are the tell. **Fix:** `fs.realpathSync` (or `realpath`) BOTH the root and every snapshot / write-set / observed path before comparison. Semantics unchanged: do not shrink the snapshot set, do not add the lane to an ignore list, do not special-case macOS. Add a test that runs the harness under a **symlinked temp root** with a child that writes only into `--out` and `--record`, and asserts `interventionCount 0`; and one where the child writes one file outside → count 1 (proving normalization did not blind it).

**(2) The four test failures**, all new since `18c1e80` (2706 green there):
- `packages/cli/test/angular-fuxa-template-compiler-run.test.ts` — 2 cases ("publishes four separate inventories and six restored mutation proofs"; "refuses changed evidence and cleans replay work")
- `packages/cli/test/next-killedbygoogle-run.test.ts` — 2 cases ("models the exact Next 12 concurrent lock-read permutations fail closed"; "validates portable hash-only cacheKey provenance schema, privacy, and integrity" → `T314 source-bound cacheKey model differs`)
- `packages/cli/test/direct-dom-inventory.test.ts` and `packages/core/test/direct-dom-access.test.ts` — suite-level load failures.
Isolate each: read the failing assertion and the stack. Determine whether it is (a) the T039 provenance record shape (the widened helper / recorded-not-compared fields), (b) the vendored `@async/witness` resolving differently at load than `link:../witness` did (e.g. a `dist/` path or export the sibling had), or (c) the declared `vp pack`. You may `git worktree add <tmp> 18c1e80` and run a failing test there to compare (own worktree — allowed). **Fix the cause, not the expectation** — unless the expectation itself pinned the old link-form provenance record, in which case update the expectation and say exactly which and why. Sealed evidence stays byte-untouched.

**(3)** Regenerate trust ONLY if a fix changes an emitted artifact (declared `vp pack` first if dist stale). Then the full chain green, and the CLEAN-TREE gate — an `rsync` copy under `mktemp -d` (the symlinked root, deliberately) — run **twice**: `count 0` both, idempotent, class `proven`/`refused:`, `trust:verify` valid in the copy.

Read first: T039's receipt on the board (`state.yaml` → T039 → blocked_reason); `intervention-count.ts:470-530`; the four failing tests' failing assertions.

Budget: 30 minutes. (1) by minute 8; (2) by minute 20; verify chain + clean gate from minute 20. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, land what you have and return `blocked` naming what remains — not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/witness/**`
- `packages/core/src/receipts/**`
- `packages/core/src/enterprise/**`
- `packages/trust/src/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `packages/trust/test/**`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not make a failing test pass by weakening the provenance equality (version + declaration/runtime digests + upstream commit) or the write-set semantics. Why: those are the honesty; if a test can only pass by weakening them, stop and name it.
- Do not edit any file under `evidence/runs/witness-*/` or any other sealed receipt. Why: sealed evidence.
- Do not shrink the harness snapshot set or add an ignore for the lane. Why: normalization is the fix; blinding the counter is the misfire.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean` in the project tree.** Why: standing rule (own worktrees/tmp fine).
- Do not publish `@async/witness`. Do not hand-edit anything under `evidence/`. Do not run `vp fmt` repo-wide. Why: owner's decision; emitted artifacts; 249 files.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
node -e "const r=require('./evidence/trust/current/coverage-report.json');if(r.totals.proven!==11)throw new Error('proven '+r.totals.proven);console.log('COVERAGE proven=11')"
test -z "$(grep -rl '\bfile:' evidence/trust/current/ 2>/dev/null)" && echo NO-FILE-URL-IN-PORTABLE-EVIDENCE
git diff --quiet HEAD -- evidence/runs/witness-*/receipt.json && echo SEALED-WITNESS-RECEIPTS-UNTOUCHED
W2="$(mktemp -d)/vl-wt"; mkdir -p "$W2" && rsync -a --exclude node_modules --exclude .versionless --exclude .git --exclude .fable-opus . "$W2/" >/dev/null && (cd "$W2" && pnpm install --frozen-lockfile >/dev/null 2>&1 && VERSIONLESS_NETWORK_MODE=consented node --experimental-strip-types packages/cli/src/cli.ts acquire pawelmalak/flame --ref v2.4.0 --id react-flame-v2-4-0-clean --consent VL-LEGACY-CORPUS-2026-08-10 --json >/dev/null && node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0-clean/baseline --out "$W2/.lane" --record "$W2/.rr.json" --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts > "$W2/.ic1.json"; node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0-clean/baseline --out "$W2/.lane2" --record "$W2/.rr2.json" --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts > "$W2/.ic2.json"; node -e "const a=require('$W2/.ic1.json'),b=require('$W2/.ic2.json');if(a.interventionCount!==0)throw new Error('clean count '+a.interventionCount+' '+JSON.stringify(a.mutatedPathsOutsideWriteSet).slice(0,400));if(!/^(proven|refused:)/.test(a.terminalClassification))throw new Error('clean class '+a.terminalClassification);if(b.interventionCount!==0)throw new Error('run2 count '+b.interventionCount);console.log('CLEAN-TREE-GATE '+a.terminalClassification+' count 0 idempotent (symlinked mktemp root)')"; npm run trust:verify -- --offline 2>&1 | tail -1 | grep -q '"valid":true' && echo CLEAN-TREE-TRUST-VALID); rm -rf "$W2"
```

`npm test` takes ~150s; expected green is the full suite. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: a test can only pass by weakening provenance equality or write-set semantics; sealed evidence would have to change; a sealed number / freeze composite / proven 11 moves; the clean gate still reads `count > 0` after realpath (report the paths verbatim); or a verify command fails for a cause outside your contract.