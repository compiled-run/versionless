Fable-Opus-Unit: bank-demo-fleet-pipeline-p1d/T041-repin-fixtures-additive
Fable-Opus-Timeout-Minutes: 15

## Goal

Re-pin two fixture digests that legitimately moved when `@async/witness` was vendored (T037/T039 rewrote the root `package.json` and `pnpm-lock.yaml`), additively, so the last four test failures clear and the tree is fully green. Everything else is already green: `trust:verify` valid at `a99892f8…`, proven 11, freeze stable, clean-tree gate `count 0` idempotent.

**Recompute before you pin.** `sha256` of the current root `package.json` and `pnpm-lock.yaml` yourself; if any value differs from the ones below, STOP and report both — do not pin a number you did not reproduce.

1. `packages/cli/src/fixture/angular-fuxa-template-compiler-run.ts:33` — `rootPackageSha256` `6acf2dd2…` → `cfd2b0ceb3e0d9f9a89d863405ea43f0394eb91f756cc402907cd72521fbf806` (root `package.json`, 1572 bytes). `compilerPackageSha256` is unaffected. If the fixture admits only one root-manifest state, replace it and comment why (the manifest vendored `@async/witness`).

2. `packages/cli/src/fixture/next-killedbygoogle-run.ts` — the fixture admits ambient `pnpm-lock` states named `historical` / `current`. The OLD `current`, `ae8c76d3…`, is still **named by published evidence** (`evidence/dependencies/angular-contacts/t631-terminal.json` and `t633-terminal.json`), so do NOT overwrite it: keep it accepted under a new name (e.g. `previous` or `vendoringPredecessor`, with a one-line comment naming those two evidence files) and ADD the new `current`: `expectedCurrentAmbientPnpmLock` (:148) → `a05cd6c698fd531c4dcb6c1117512a0c8ce463cc56edf2e7eccb89585b56066e`; the `byteLength === 67_396` literal (~:3670) → `68_172`; `expectedCurrentCacheKeyCandidates` (:160) → `023652bbcc92f4de735e3e30446fcdc6dcb41e3bbc0f651bd236e792ed863b1e` for `[fixture/yarn.lock, ambient/pnpm-lock.yaml]` and `906bba8598f806f62350582d43d03ce906d4f654ab98e78089a588b421c83eb9` for the reverse. `expectedHistoricalAmbientPnpmLock` and the fixture `yarn.lock` pin (`a676ee93…`, 256958 bytes) unchanged. If the accepted-states structure is a two-member union or tuple, widen it to three by name — additive.

3. `packages/cli/test/next-killedbygoogle-run.test.ts:541,547,551` — the same three values (so the three files move atomically).

Then the full chain. Do NOT touch `evidence/`; do NOT regenerate trust; do NOT run `vp pack` — none should be needed.

Read first: T040's receipt on the board (`state.yaml` → T040 → blocked_reason); the three files at the named lines.

Budget: 15 minutes. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt.

## File contract

- `packages/cli/src/fixture/angular-fuxa-template-compiler-run.ts`
- `packages/cli/src/fixture/next-killedbygoogle-run.ts`
- `packages/cli/test/next-killedbygoogle-run.test.ts`

## Forbidden moves

- Do not touch any file outside the three named. Why: everything else is verified green.
- Do not overwrite the old `current` lock digest. Why: published evidence still names it; retiring it silently would orphan those records. Additive only.
- Do not pin a digest you did not recompute. Why: a wrong pin is a lie the tests would then enforce.
- Do not touch `evidence/`, regenerate trust, or run `vp pack`. Why: nothing emitted changes here.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: standing rule.
- Do not write inside the five frozen subtrees. Why: sealed under freeze `27741d9c`.

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
git diff --quiet HEAD -- evidence/runs/witness-*/receipt.json evidence/dependencies/ && echo SEALED-EVIDENCE-UNTOUCHED
```

`npm test` takes ~150s; expected green is the full suite (2704 + the 4 now fixed = 2708 + 2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block if: a recomputed digest differs from the packet's value (report both); the fix would need `evidence/` or a regeneration; or a verify command fails for a cause outside your contract (name it).
