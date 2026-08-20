Fable-Opus-Unit: bank-demo-fleet-pipeline-p1d/T039-provenance-sbom-green
Fable-Opus-Timeout-Minutes: 30

## Goal

Land three decided changes and turn the tree green with the clean gate intact. The tree is currently RED (`trust:verify` throws; 31 tests fail) because `@async/witness` was vendored (T037 — that vendoring is what makes the clean-checkout gate pass, so it stays). T038 established the facts and the PM decided the encoding; you implement.

**(1) Provenance equality.** T038 proved: all 12 sealed witness receipts record `version 0.8.0`, `declarationSha256 4e249b3c…`, `runtimeSha256 d1fd099b…`, upstream commit `83b86de` — **equal** to the vendored tarball's; only `packageSha256` differs (`d166f031` vs `920905ea`) because `pnpm pack` rewrites `package.json`. So: in `packages/cli/src/witness/provenance.ts` add ONE shared helper — e.g. `assertLinkedWitnessProvenanceEquivalent(recorded, expected)` — that COMPARES version + `declarationSha256` + `runtimeSha256` + upstream commit, and RECORDS (never compares) the specifier form (`link:../witness` | `file:vendor/…`), `linkTarget`, `index`/`tracked`/`untracked` readings, and `packageSha256`. Then change EXACTLY the one compare line at each of the 16 call sites (`grep -rln verifyLinkedWitnessProvenance packages/`: 13 sealed `packages/cli/src/witness/*-run.ts` drivers — e.g. `react-papercups-run.ts:271` `if (canonicalize(receipt.provenance) !== canonicalize(expectedProvenance)) throw …` — plus `real-app-run.ts`, `packages/cli/src/cli.ts`, `packages/cli/src/fixture/angular-realworld-production-parity-run.ts`) to call the helper. Sealed drivers otherwise byte-untouched; **no driver re-run; no sealed receipt edited** (a verify command checks `evidence/runs/witness-*/receipt.json` unchanged). Add ONE `notEstablished` line in `packages/core/src/receipts/witness-real-app.ts` (~:987, in the existing voice): what is compared, what is recorded.

**(2) SBOM encoding (approved).** `packages/trust/src/ingest.ts` (~:94) and `schema.ts` (~:139) accept the vendored coordinate as `{ name: '@async/witness', version: '0.8.0', kind: 'file', tarball: 'vendor/async-witness-0.8.0.tgz', sha256: <tarball sha256> }` — **no `file:` prefix in any emitted evidence** (`schema.ts:114` `assertPortableEvidence` refuses `/^file:/` and stays as-is), no purl (`packagePurl` must skip `kind: 'file'`), a `hashes: [{alg:'SHA-256', content}]` entry plus a `versionless:coordinate-kind = file` property on the CycloneDX component. Remove T037's `auditableLockText` workaround in `verify.ts`/`generate.ts` if it becomes redundant. **`verify.ts:440`** hardcodes `components.length !== 197` / `dependencies.length !== 197` — make both DERIVED from the lock (no literal).

**(3) Fresh OSV/trust ingest** under the recorded consent id: `VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=AGENTS-utilities-trust-refresh npm run trust:ingest -- --allow-network …` (read the script's flags) so `mitt@3.0.1` and the vendored witness enter the inventory. Record the consent id and what changed.

**(4) Regenerate** (`pnpm exec vp pack` once first only if dist is stale by mtime; declare it), then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`. Whole chain green; coverage `proven: 11`; freeze composite `27741d9c` stable; sealed witness receipts byte-untouched; NO `file:` string anywhere under `evidence/trust/current/`; and the CLEAN-TREE gate — an `rsync` of the WORKING tree (HEAD `18c1e80` lacks these changes, so `git worktree add HEAD` would test the wrong thing) → `pnpm install --frozen-lockfile` → consented acquire of flame → `intervention-count` → `count 0`, `proven`/`refused:` — with `trust:verify` VALID in that copy.

Read first: T038's receipt on the board (state.yaml → T038 → blocked_reason: the digest table, the 16 sites, both collisions, the three decisions), `provenance.ts` (whole file), `react-papercups-run.ts:260-280`, `ingest.ts:80-110`, `schema.ts:105-150`, `verify.ts:430-450`, `witness-real-app.ts:980-995`, `vendor/README.md`.

Budget: 30 minutes. (1) by minute 10 (it is 16 one-line edits + one helper), (2)+(3) by minute 18, (4) + verify from minute 18, clean-tree gate last. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, land what you have and return `blocked` naming what remains — not `partial`.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/cli.ts`
- `packages/cli/src/fixture/angular-realworld-production-parity-run.ts`
- `packages/cli/src/operator/**`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/enterprise/**`
- `packages/trust/src/**`
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
- Do not re-run any sealed per-app witness driver, and do not edit any file under `evidence/runs/witness-*/` or any other sealed receipt. Why: sealed evidence; T038 proved re-running is unnecessary.
- In the 13 sealed drivers, change nothing but the one compare line. Why: their evidence must stay reproducible; the helper call is the whole change.
- Do not emit a `file:` string into any evidence artifact, and do not accept the coordinate without its sha256. Why: portable-evidence rule; a named, digested coordinate is the honesty.
- Do not leave or add a literal SBOM count. Why: T022 rule — derive, do not pin.
- Do not publish `@async/witness`. Why: the owner's decision.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean` in the project tree.** Why: standing rule (own temp dirs are fine).
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
test -z "$(grep -rl '\bfile:' evidence/trust/current/ 2>/dev/null)" && echo NO-FILE-URL-IN-PORTABLE-EVIDENCE
git diff --quiet HEAD -- evidence/runs/witness-*/receipt.json && echo SEALED-WITNESS-RECEIPTS-UNTOUCHED
W2="$(mktemp -d)/vl-wt"; mkdir -p "$W2" && rsync -a --exclude node_modules --exclude .versionless --exclude .git --exclude .fable-opus . "$W2/" >/dev/null && (cd "$W2" && pnpm install --frozen-lockfile >/dev/null 2>&1 && VERSIONLESS_NETWORK_MODE=consented node --experimental-strip-types packages/cli/src/cli.ts acquire pawelmalak/flame --ref v2.4.0 --id react-flame-v2-4-0-clean --consent VL-LEGACY-CORPUS-2026-08-10 --json >/dev/null && node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0-clean/baseline --out "$W2/.lane" --record "$W2/.rr.json" --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts > "$W2/.ic.json"; node -e "const j=require('$W2/.ic.json');if(j.interventionCount!==0)throw new Error('clean count '+j.interventionCount+' '+JSON.stringify(j.mutatedPathsOutsideWriteSet));if(!/^(proven|refused:)/.test(j.terminalClassification))throw new Error('clean class '+j.terminalClassification);console.log('CLEAN-TREE-GATE '+j.terminalClassification+' count 0')"; npm run trust:verify -- --offline 2>&1 | tail -1 | grep -q '"valid":true' && echo CLEAN-TREE-TRUST-VALID); rm -rf "$W2"
```

`npm test` takes ~150s; expected green is the full suite (2706 + 2 skipped baseline plus additions). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: any sealed receipt or sealed evidence would have to change; the OSV ingest needs a consent id not recorded in the repo; a sealed number / freeze composite / proven 11 moves; the clean-tree gate regresses; or a verify command fails for a cause outside your contract.