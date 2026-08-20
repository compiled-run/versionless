Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T010a-supersession-sizing
Fable-Opus-Timeout-Minutes: 25

## Goal

Read-only sizing of the ONE authorized freeze supersession (T010) before anything frozen is touched. The 13 cell's evidence chain is complete (compile → byte-identical lanes → live witness parity on application signals, nine-item delta — `evidence/runs/angular-13cell/*`). What remains is making `angular-13.4.0` a **plannable migration target in the pipeline**, which requires changing the frozen subtrees, recomputing the freeze, and riding the format epoch on the same supersession. Nobody has sized that change against the actual code. You do, without writing a single product byte.

Answer, with file:line evidence:

1. **What must change for `angular-13.4.0` to be a plannable target?** Trace how the Angular 16 cell is wired today: where `packages/frameworks/angular` declares its target cell(s); how `packages/cli/src/operator/plan.ts` / `analyze.ts` select the Angular target; what `NGCC_ANGULAR_13_CELL` (`era-cell.ts:134`, `published: false`) would need to flip to published; where the migration transforms assume 16-isms (standalone bootstrap? builder names? typescript version pins?) that a 13 target must not inherit. List every file inside the five frozen subtrees that must change, with the smallest honest change per file — and every file OUTSIDE the frozen subtrees (operator/plan, era-cell registry, tests) that changes with them.
2. **The nine-item delta as transforms.** Which of pigallery2's nine migration-delta items generalize into adapter transforms (ModuleWithProviders generic, @Directive on undecorated base, localize polyfill add, LOCALE_ID provider for dropped --i18n-locale, angular.json schema trims) vs which are app-specific (the as-any cast)? For the generalizable ones: does a transform already exist in `packages/core/src/migrations` for the 16 path that extends, or is each new? Estimate units per transform.
3. **The freeze mechanics.** Read how freeze `27741d9c` was computed and recorded (`evidence/trust/current/adapter-freeze.json` — subtree treeOids; find the tool: grep `freeze` in `packages/cli/src`, `scripts/`, trust src). What exactly does a supersession record carry (the chain in `adapter-freeze.json` has 5 entries — read their shape)? What recomputes downstream (trust regen, which tests pin the composite)? List the exact steps in order.
4. **The format epoch.** `vp fmt` repo-wide touches 249 files, 82 freeze-locked (the sealed T003 ruling says it rides this supersession). Verify those numbers today (`pnpm exec vp fmt --check` over the tree — read-only check mode). Which of the 82 are in which frozen subtree? Does reformatting change tree OIDs only, or do any tests pin file bytes/digests that the reformat moves (grep for sha256 pins of frozen-subtree files in tests and trust)?
5. **The cut.** Propose T010's unit breakdown (each ≤30 min, isolated where frozen bytes move): ordering, file contracts, verify blocks, and the single point where the supersession is recorded. Name the risks in order (the one that would make you run it differently).

Write the full sizing to `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` — that file is your ONE permitted write. End with the fenced JSON receipt; `files_changed` must be exactly that one path.

## File contract

- `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md`

## Forbidden moves

- Do not write anything except the sizing note. Why: this unit exists so the supersession is executed once, correctly, from measurements — not discovered mid-flight.
- Do not run `vp fmt` in write mode. Why: the format epoch rides the supersession, not this unit; `--check` only.
- Do not run trust:generate or any regeneration. Why: read-only.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
test -f docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md && wc -l docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md
git diff --quiet HEAD -- packages/ evidence/ && echo NOTHING-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

## Blocked permission

If evidence is missing or the contract conflicts with reality, return status "blocked" with the question in open_questions instead of improvising.
