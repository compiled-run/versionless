Fable-Opus-Unit: bank-demo-fleet-pipeline-p1d/T038-trust-vendored-witness
Fable-Opus-Timeout-Minutes: 30

## Goal

Teach the trust package that a vendored `@async/witness` is a legitimate, auditable provenance — and turn the tree green with the clean-checkout gate intact.

State you inherit (T037): the clean-worktree gate PASSES (`interventionCount 0`, `proven`, idempotent, witness digest identical) *because* `@async/witness` is now vendored (`package.json`: `"file:vendor/async-witness-0.8.0.tgz"`; `vendor/README.md` records source `../witness` @ `83b86de`). But the main tree is RED — `trust:verify` throws and `npm test` reads 31 failed / 2675 passed — from exactly three collisions, all named:

1. `packages/trust/src/ingest.ts:94` and `packages/trust/src/schema.ts:139` reject the `file:` lock coordinate (`Invalid pnpm packages[1].version`). `trust:ingest` calls `lockPackages` directly, so T037's in-contract `auditableLockText` filter in `verify.ts`/`generate.ts` cannot reach it. Fix at the source: accept a non-registry lock coordinate as a NAMED coordinate kind (`file:` with the tarball's sha256 recorded, never a silent allowance). Remove or justify the `auditableLockText` workaround.
2. Vendoring pulls `mitt@3.0.1` into the audited closure, so the SBOM's CycloneDX inventory count mismatches. Run a fresh OSV/trust ingest under the consent id T037 found recorded and used: `VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=AGENTS-utilities-trust-refresh npm run trust:ingest -- --allow-network …` (read the script's flags). Record the consent id and what changed in the receipt.
3. **Provenance equality.** `packages/cli/src/witness/provenance.ts` (T037 rewrite) now reads the tarball: version `0.8.0` + tarball/package/declaration/runtime sha256. About 11 sealed witness receipts (papercups, hospitalrun, linkfree, memos, killedbygoogle v3, react-boilerplate zero-SW, fuxa, next-killedbygoogle …) embed the OLD `link:../witness` provenance record, and `react-papercups-run.ts:272` (and siblings) compare against it → `linked Witness provenance differs`. **FIRST compare, before changing anything:** do the sealed receipts' recorded declaration/runtime content digests EQUAL the vendored tarball's? Read one sealed receipt's provenance block and the tarball's `dist/index.d.mts` / `dist/index.mjs` sha256. **If YES:** provenance equality is version + content digests; the *specifier form* (`link:../witness` | `file:vendor/…`) is a recorded FACT and NOT compared — the sealed receipts then verify without re-running any driver. Document that widening at the function and in `notEstablished` (one line: what is compared, what is recorded). **If NO:** STOP and return `blocked` — re-running sealed drivers or publishing the package is the owner's decision, not yours.

Then regenerate trust (declared `pnpm exec vp pack` first ONLY if dist is stale by mtime), and prove: full chain green; coverage still `proven: 11`; freeze composite `27741d9c` stable; and the clean-worktree gate passes AGAIN — this time with `trust:verify` VALID inside the worktree.

Read first: T037's receipt on the board (state.yaml, task T037 — the three collisions with file:line and the 31 failures' two causes), `ingest.ts:80-110`, `schema.ts:130-150`, `provenance.ts` (whole file, ~100 lines), `react-papercups-run.ts:260-280`, one sealed receipt's provenance block, `vendor/README.md`.

Budget: 30 minutes. (1)+(3-compare) by minute 8; (2)+(3-implement) by minute 16; regenerate + verify chain from minute 18, clean gate last. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what remains — not `partial`.

## File contract

- `packages/trust/src/**`
- `packages/cli/src/witness/provenance.ts`
- `packages/cli/src/witness/browser.ts`
- `packages/cli/src/operator/**`
- `packages/core/src/enterprise/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `packages/trust/test/**`
- `package.json`
- `pnpm-lock.yaml`
- `vendor/**`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`
- `.versionless/cache/trust/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not re-run any sealed per-app witness driver, and do not edit any sealed receipt under `evidence/runs/<sealed-app>/`. Why: sealed evidence. If the digests differ, block.
- Do not publish `@async/witness`. Why: the owner's decision.
- Do not accept the `file:` coordinate silently or without its digest. Why: a named, audited coordinate is the honesty; a silent allowance is a hole in the SBOM.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean` in the project tree.** Why: standing rule (own temp worktree is fine).
- Do not hand-edit anything under `evidence/`. Do not run `vp fmt` repo-wide. Why: emitted artifacts; 249 files.
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
grep -q '"@async/witness": "file:vendor/' package.json && test -f vendor/async-witness-0.8.0.tgz && echo WITNESS-VENDORED
node -e "const r=require('./evidence/trust/current/coverage-report.json');if(r.totals.proven!==11)throw new Error('proven '+r.totals.proven);console.log('COVERAGE proven=11')"
W="$(mktemp -d)/vl-clean"; git worktree add "$W" HEAD >/dev/null 2>&1 && (cd "$W" && pnpm install --frozen-lockfile >/dev/null 2>&1 && VERSIONLESS_NETWORK_MODE=consented node --experimental-strip-types packages/cli/src/cli.ts acquire pawelmalak/flame --ref v2.4.0 --id react-flame-v2-4-0-clean --consent VL-LEGACY-CORPUS-2026-08-10 --json >/dev/null && node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0-clean/baseline --out "$W/.lane" --record "$W/.rr.json" --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts > "$W/.ic.json"; node -e "const j=require('$W/.ic.json');if(j.interventionCount!==0)throw new Error('clean count '+j.interventionCount);if(!/^(proven|refused:)/.test(j.terminalClassification))throw new Error('clean class '+j.terminalClassification);console.log('CLEAN-CHECKOUT-GATE '+j.terminalClassification+' count 0')"; npm run trust:verify -- --offline 2>&1 | tail -1 | grep -q '"valid":true' && echo CLEAN-TRUST-VALID); git worktree remove --force "$W"
```

Note: the clean-worktree command's `git worktree add … HEAD` uses HEAD = `18c1e80` — which does NOT contain T037's or your uncommitted changes. That gate command therefore tests the committed tree, not your work. That is a real limitation of this verify block: state in your receipt that the in-worktree gate reflects HEAD, and ALSO run the same gate against your working tree by copying it (`git worktree add` cannot include uncommitted changes) — e.g. `rsync -a --exclude node_modules --exclude .versionless --exclude .git . "$W2"` then `pnpm install --frozen-lockfile` there — and report that result verbatim too. `npm test` takes ~150s; expected green is the full suite. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the sealed receipts' content digests differ from the vendored tarball's; the OSV ingest needs a consent id not recorded in the repo; a sealed number / freeze composite / proven 11 moves; the clean gate regresses; or a verify command fails for a cause outside your contract.