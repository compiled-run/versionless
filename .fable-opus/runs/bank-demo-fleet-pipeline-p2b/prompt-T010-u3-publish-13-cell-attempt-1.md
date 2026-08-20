Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u3-publish-13-cell
Fable-Opus-Timeout-Minutes: 35

## Goal

Publish `angular-13.4.0` as a plannable Angular target cell, and delete the now-redundant unpublished NGCC descriptor in the same breath — merged units u3+u4 of the T010 freeze supersession, per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §1.4, §3, R3 and the PM rulings in `docs/goals/bank-demo-fleet-pipeline/goal.md` § "T010 Rulings". Read both sections first. This unit MOVES FROZEN BYTES in `packages/frameworks/angular` — that is authorized for T010 and the supersession is recorded later at u10; your job is a minimal, honest diff.

Part 1 — the cell (`packages/frameworks/angular/src/angular-target-cell.ts`):

- Add `ANGULAR_13_ECOSYSTEM_PACKAGES`: a NARROW table (PM ruling R3) containing ONLY what the T009 evidence measured from the installed lockfile — read `evidence/runs/angular-13cell/pigallery2-compile.json` (`cell.provenance` and the ngcc/pins blocks) and `evidence/runs/angular-13cell/README.md`. Expected entries: the pre-Ivy libraries ngcc consumed, the Angular-13-era repins the evidence names (ngx-bootstrap / ngx-toastr / ngx-clipboard class), `rxjs 6.6.7`, `typescript 4.6.4`, `zone.js 0.11.8`, `tslib 2.6.3` — but the EVIDENCE decides the list, not this packet; include exactly what it measured, nothing more. Every entry's `fact` must be ≥40 chars (invariant at `angular-target-cell.test.ts:177` applies to every ecosystem table) and must state the honest basis: measured from the installed closure of the T009 proving run under the named evidence file — not a registry claim you did not make. Follow the field shape of `ANGULAR_16_ECOSYSTEM_PACKAGES` (`:226`) exactly.
- Add `ANGULAR_13_BROWSER_CELL` following the shape of `ANGULAR_16_BROWSER_CELL` (`:561`): id `angular-13.4.0` (PM ruling O2 — the pins live in prose, not the id), `angularLine` per the evidence (13.4), `builder '@angular-devkit/build-angular:browser'` (mainstream on the 13 line, carried per-cell), `nodeLine '16.20.2'`, `typescriptRange '~4.6.4'`, packages/families/testPackages per the evidence, `rationale` naming the load-bearing pins (rxjs 6.6.7, Node 16.20.2, CLI 13.3.11) and the T009 evidence chain, and `nonclaims` that DECLARE the narrow-ecosystem gap in plain words: the community layer beyond the measured entries is unassessed for this cell; `readCellVerdicts` reports it `unknown`, which is the documented behavior.
- Append the cell to `ANGULAR_TARGET_CELLS` (`:604`). `index.ts` already re-exports the module — no index change.

Part 2 — the descriptor (`packages/cli/src/operator/era-cell.ts`, OUTSIDE the freeze):

- Delete `NGCC_ANGULAR_13_CELL` (`:134-144`) and its entry in `DESCRIBED_CELLS` (`:146-152`). `cellOfAdapterCell` (`:107`) now derives the published `DescribedCell` for `angular-13.4.0` automatically from `ANGULAR_TARGET_CELLS`. Rationale (sizing §1.1): keeping both would put two entries with one id in `DESCRIBED_CELLS`. Preserve whatever honest content the NGCC descriptor carried that the derived one must keep (check what `cellOfAdapterCell` derives vs what the descriptor declared — e.g. Node line, prose); if something true would be LOST by the deletion (the ngcc-required framing, the 'not installed' provides), decide whether it belongs on the new cell's rationale/nonclaims and carry it there.

Part 3 — tests:

- `packages/frameworks/angular/test/angular-target-cell.test.ts`: assertions for the new cell mirroring the 16 cell's (id, builder, nodeLine, typescriptRange, appending to ANGULAR_TARGET_CELLS, the fact-length invariant covering the new table, `buildStampContradictions(new cell)` empty if such a check exists for 16).
- `packages/cli/test/operator-era-cell.test.ts`: update the sites that pin the NGCC descriptor (`:29` import, `:303-311` published===false + provides 'not installed', `:771` DESCRIBED_CELLS contains the id) to pin the new truth: `angular-13.4.0` IS published, derived from the adapter, `DESCRIBED_CELLS` ids are UNIQUE (add that assertion), and the u2 derived block ('describable is not plannable') must now pass with the membership flipped — DO NOT edit the u2 block; if it fails, your cell is wrong, not the test.

## File contract

- `packages/frameworks/angular/src/angular-target-cell.ts`
- `packages/frameworks/angular/test/angular-target-cell.test.ts`
- `packages/cli/src/operator/era-cell.ts`
- `packages/cli/test/operator-era-cell.test.ts`

## Forbidden moves

- Do not touch any other file in `packages/frameworks/**` or any file in `packages/core/src/{migrations,bundlers,analysis}/**` or `packages/trust/**`. Why: one subtree-moving concern per unit; the supersession is recorded only at u10, and every extra frozen byte moved here is an unaccounted reason for a moved oid.
- Do not edit the u2 test block 'era-cell — describable is not plannable' in operator-era-cell.test.ts, and do not edit operator-flows.test.ts at all. Why: those are the regression pins your change must satisfy, not accommodate.
- Do not invent ecosystem entries or facts beyond what the T009 evidence files state. Why: PM ruling R3 — every `fact` is an evidence-backed claim; an invented registry reading is a lie in the trust surface.
- Do not run `git commit`, `vp pack`, or regenerate anything under `evidence/**`. Why: Phase B accumulates uncommitted until u10 cuts commit X; evidence regeneration is sequenced to u11.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: standing goal rule, and the tree carries committed u1/u2 work.

## Verification

```verify
pnpm exec vp test --project node packages/frameworks/angular/test/angular-target-cell.test.ts packages/cli/test/operator-era-cell.test.ts packages/cli/test/operator-flows.test.ts
node --experimental-strip-types -e "import('./packages/cli/src/operator/era-cell.ts').then(m=>{const ids=m.DESCRIBED_CELLS.map(c=>c.id);if(new Set(ids).size!==ids.length)throw new Error('duplicate ids: '+ids.join(','));console.log('DESCRIBED-CELLS-UNIQUE: '+ids.join(', '))})"
npm run trust:verify -- --offline
node packages/cli/src/fixture/operator-flow-byte-identity-run.ts && git diff --quiet HEAD -- evidence/runs/operator-flows/byte-identity.json && echo SEALED-16-PATH-BYTE-IDENTICAL
git diff --name-only HEAD -- packages/frameworks | tr '\n' ' ' | grep -qx 'packages/frameworks/angular/src/angular-target-cell.ts packages/frameworks/angular/test/angular-target-cell.test.ts ' && echo FROZEN-DELTA-EXACTLY-TWO-FILES
```

The first command includes operator-flows.test.ts because u2's derived tests must flip membership without edits — that flip passing IS the acceptance test for the published cell. The byte-identity re-derivation (R2) proves the sealed 16 path did not move: if adding the cell changed `composeAngularPlan`'s output for pigallery2, the driver rewrites the evidence file and the git diff check fails — which would be a real finding, not a nuisance. If the fixture driver needs different flags, read how `evidence/runs/operator-flows/byte-identity.json` records its own provenance and invoke it that way; it must leave the evidence file byte-identical.

## Blocked permission

If the T009 evidence does not actually state a value this packet assumes (a pin, a version, a package), if the derived DescribedCell loses something true that has no honest home on the new cell, or if the u2 derived block fails for a reason you believe is a defect in the u2 test rather than your cell, return status "blocked" with the question in open_questions instead of improvising.
