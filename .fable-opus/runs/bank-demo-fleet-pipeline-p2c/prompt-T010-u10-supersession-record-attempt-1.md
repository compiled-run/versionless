Fable-Opus-Unit: bank-demo-fleet-pipeline-p2c/T010-u10-supersession-record
Fable-Opus-Timeout-Minutes: 35

## Goal

The single point of record for the ONE authorized T010 freeze supersession, plus the regeneration of every surface that names the composite — merged u10+u11 of `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §3 and §5 (read §3 in full; also read `packages/trust/src/freeze.ts` top to bottom before editing). HEAD is commit X = `ddc2870aa934be7c8bc6caaeca74095d270776d5`, which carries all Phase B+C work; the tree is clean.

**Part 1 — `packages/trust/src/freeze.ts` (you are the only unit ever permitted to touch it):**

- `ADAPTER_FREEZE_SUBTREES` gets the five oids at commit X, in existing hashing order:
    - `packages/frameworks/react` → `ad28e7c430b78e040a0609c24d7665601e480771` (MOVED — fmt only)
    - `packages/frameworks/angular` → `d20a740dd03179df6c8c7990dbe39e1e94e31316` (MOVED — capabilities + fmt)
    - `packages/core/src/migrations` → `5237ce5990af3623206bcd2301047a59c80731cf` (unchanged, re-frozen)
    - `packages/core/src/bundlers` → `cec2f0b56fbb7897f38d579be805e19982380ca6` (unchanged, re-frozen)
    - `packages/core/src/analysis` → `262dc8b7528c92883c2300914eb7d42579fb856b` (unchanged, re-frozen)
      Re-derive them yourself with `git rev-parse HEAD:<path>` rather than trusting this packet.
- Recompute `ADAPTER_FREEZE_COMPOSITE` from the preimage exactly as `adapterFreezePreimage()` builds it (`"<path> <oid>\n"` joined in list order, sha256) — `adapterFreezeRecord()` throws on any mismatch, which is your immediate feedback.
- `ADAPTER_FREEZE_COMMIT = 'ddc2870aa934be7c8bc6caaeca74095d270776d5'`.
- Move `27741d9c…` into `ADAPTER_FREEZE_SUPERSEDES` (state 'superseded', commit `0ecd4106…` — the commit it was pinned to), append the NEW composite as the 6th entry of `chain` (oldest first: d9f75ef6 → 5de7df56 → 4df7bc96 → f1a63359 → 27741d9c → new).
- New `reopens[]` entry for T010 with **`reactSubtreeUnchanged: false`** — and `trust-package.test.ts:1910`-region's `reopens.every(r => r.reactSubtreeUnchanged)` assertion updated to pin the new truth per-reopen (T021 true, T024 true, T010 false), not weakened to a vacuous check.
- Experimental capabilities: append the T010 slice — 1 NEW capability (`locale-id-provider`) + 2 EXTENDED (`workspace-script-flags` i18n value-carrying rows, `template-i18n-runtime` widened closure-reading gate) — following the T021 (:184-region) / T024 (:198-region) slice pattern; update the length/slice pins in `trust-package.test.ts` (`:1894` toHaveLength, `:1905` reopen-task list gains 'T010').
- `reopenReason`: one paragraph that states, by name: the authorization (bank-demo-fleet-pipeline T010, the goal's ONE authorized supersession); the units (u1,u2,u3,u5b,u6,u7,u9 under runs p2b/p2c) and commit X; which subtrees moved and why — angular for the 13-cell capabilities AND formatting, react for FORMATTING ALONE (8 files, whitespace, no capability — say it in those words), the three core subtrees unchanged and re-frozen at their oids; that the sealed 16-path pigallery2 changeset moved once under this reopen as an authorized defect fix (i18n flags trimmed from ng-first scripts; byte-identity angular digest 2b85d619→a044d716); that the format epoch was run to fixpoint (2 passes — the formatter is non-idempotent on one signature); what the reopen bought (angular-13.4.0 as a plannable, refusal-honest target with a narrow evidence-backed ecosystem) and what it did NOT buy (no community-layer coverage beyond the T009 measurements — declared in the cell's nonclaims; no composed localize capability — deliberately uncomposed); and the prior chain tail in prose.

**Part 2 — regenerate every surface that names the composite, in the declared order:**

1. `pnpm exec vp pack` (dist is stale — Phase B changed adapter sources).
2. `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`
3. `node packages/cli/src/fixture/operator-flow-byte-identity-run.ts` (byte-identity.json pins the composite; the angular changeset digests must stay `a044d716…` — only the composite field moves).
4. `node --experimental-strip-types packages/cli/src/cli.ts refusal-census --out evidence/runs/operator-flows/refusal-census.json` (census carries adapterFreezeComposite).

GUARDS that must reproduce verbatim after all regeneration: matrix react 6/6 / angular 4/4; coverage totals {applications 21, proven 11, bounded 2, refused 5, not-admitted 3}; byte-identity angular operator/driver digests equal and starting `a044d716`. The HOLDOUT receipts' composite pins (`f1a63359` in holdout-angular-pigallery2, `27741d9c` in holdout-angular-eshop-webspa/witness) are HISTORY per `freeze.ts:52-56` — they must NOT be touched; the verify chain is built to accept historical pins.

## File contract

- `packages/trust/src/freeze.ts`
- `packages/trust/test/trust-package.test.ts`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`
- `evidence/runs/operator-flows/byte-identity.json`

## Forbidden moves

- Do not touch any file in the five frozen subtrees, any holdout/witness receipt, or any fixture. Why: the subtree oids you are recording are the oids at commit X; a byte moved now falsifies the record as you write it.
- Do not weaken any assertion to make a count fit — every pin you update must pin the NEW true value. Why: the record's honesty is the entire product of this unit.
- Do not run `git commit`. Why: the supersession commit is cut by the PM after diff review — that is how ADAPTER_FREEZE_COMMIT (X) stays distinct from the record's own commit, mirroring how 0ecd4106 relates to the T024 commits.
- No `git stash` / `git checkout --` / `git reset` / `git clean`.

## Verification

```verify
pnpm exec vp test --project node
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-BYTE-IDENTICAL sites='+d.census.summary.sites)})"
node -e "const b=require('./evidence/runs/operator-flows/byte-identity.json').angular;if(b.identical!==true||b.operatorDigest!==b.driverDigest||!b.operatorDigest.startsWith('a044d716'))throw new Error('byte-identity wrong: '+b.operatorDigest.slice(0,8));console.log('SEALED-DIGESTS-STABLE-UNDER-NEW-COMPOSITE')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==21)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');const z=f.freeze;if(String(z.composite).startsWith('27741d9c'))throw new Error('composite did not move');if(!f.supersedes||!String(f.supersedes.composite).startsWith('27741d9c'))throw new Error('supersedes does not carry 27741d9c');if((f.supersedes.chain||z.chain||[]).length<6&&(f.chain||[]).length<6)console.log('CHAIN-LENGTH-CHECK-DEFERRED-TO-SHAPE');const rs=(f.reopens||[]);const t=rs.find(r=>r.task==='T010');if(!t)throw new Error('no T010 reopen entry');if(t.reactSubtreeUnchanged!==false)throw new Error('reactSubtreeUnchanged must be false');console.log('SUPERSESSION-RECORDED composite='+String(z.composite).slice(0,8))"
git diff --quiet HEAD -- packages/frameworks packages/core && echo FROZEN-AND-CORE-UNTOUCHED-BY-U10
```

If the emitted adapter-freeze.json nests these fields differently than the check guesses, adjust nothing in the record — report the actual paths in your receipt and the PM re-runs the check against the real shape; the other nine commands are the binding gate.

## Blocked permission

If `adapterFreezeRecord()`'s shape differs from the sizing's description in a way that forces a design choice, if any guard number moves, if a holdout receipt goes red under the new composite (it must not — history pins are accepted), or if the record cannot state something truthfully as instructed, return status "blocked" with the question in open_questions instead of improvising.
