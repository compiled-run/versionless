Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u1-cell-seam

## Goal

Thread a declared `--cell` from the CLI into the plan and analyze stages, so `versionless plan|migrate|run --cell <id>` actually plans against that cell instead of silently defaulting to Angular 16. This is Phase A unit u1 of the T010 freeze supersession, per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §1.2 and §5 — read that section first; it has exact file:line coordinates.

The seam today (verified by the sizing unit at HEAD):

- `packages/cli/src/operator/flows.ts:1054-1057` parses `--cell` into `EraCellDeclarations` ONLY. The `angular` options object handed to `planApplication` (`flows.ts:1034-1038`) carries no cell. The `plan` command's value-flag allowlist (`flows.ts:158`) does not include `--cell`.
- `packages/cli/src/operator/run.ts:166-167` — same gap for `run`'s plan stage; `run.ts:460-464` builds `planApplication({ appRoot, angular: declarations.angular, react })`.
- `packages/cli/src/operator/plan.ts:228` does `options.cell ?? ANGULAR_16_BROWSER_CELL`; `AngularPlanOptions.cell` (`plan.ts:138`) exists but nothing ever sets it.
- `packages/cli/src/operator/analyze.ts:232,291` — `readCellVerdicts` and `analyzeApplication` default to `ANGULAR_16_BROWSER_CELL`, so `cellReadings.cell` misreports under a declared 13 plan.

What to build:

1. Add `--cell` to the plan/migrate/run value-flag tables in `flows.ts` (the sizing names `:158,:160,:184,:200,:220`) and `run.ts` (`:166-167`), and thread the declared cell id into the `angular` options object and `declarations.angular`.
2. Resolve the declared id against `ANGULAR_TARGET_CELLS` (from `@versionless/frameworks-angular` — the array currently holds only `ANGULAR_16_BROWSER_CELL`). A resolved cell is passed as `AngularPlanOptions.cell` and reaches `analyzeApplication`/`readCellVerdicts` so the emitted `cellReadings.cell` names the cell actually planned against.
3. A declared cell id that NO adapter publishes must be a named refusal (exit 2), NOT a fallback to 16. Follow the existing refusal conventions in `packages/cli/src/operator/refusals.ts` — pick a name shaped like the existing operator refusal ids and register it wherever existing refusals are registered (if that registry lives in `refusal-census.ts` inside a frozen subtree path, STOP — it does not; `packages/cli/src/operator/refusal-census.ts` is outside the freeze, but check before writing). The refusal message must name the declared id and the published ids.
4. No declared `--cell` ⇒ behavior byte-identical to today (default 16 path). This is a sealed path; nothing about it may move.
5. Update the CLI help text where `flows.ts:553,:627` document flags.
6. Tests in `packages/cli/test/operator-flows.test.ts`: declared-known-cell reaches the plan options; declared-unknown-cell refuses by name with exit 2; undeclared is unchanged. Note `operator-flows.test.ts:389` reads `ADAPTER_FREEZE_COMPOSITE` symbolically — do not touch that.

Important framing: `angular-13.4.0` is NOT yet in `ANGULAR_TARGET_CELLS` (that is unit u3, later, inside the freeze). So after this unit, `--cell angular-13.4.0` correctly REFUSES with the named refusal. That is the honest intermediate state — do not add the 13 cell yourself; the frozen subtrees must not change in this unit.

## File contract

- `packages/cli/src/operator/plan.ts`
- `packages/cli/src/operator/analyze.ts`
- `packages/cli/src/operator/flows.ts`
- `packages/cli/src/operator/run.ts`
- `packages/cli/src/operator/refusals.ts`
- `packages/cli/test/operator-flows.test.ts`

## Forbidden moves

- Do not touch `packages/frameworks/**`, `packages/core/src/{migrations,bundlers,analysis}/**`, or `packages/trust/**`. Why: the five frozen subtrees are under composite 27741d9c and only unit u10 records the supersession; a frozen byte moved here would give the tree two reasons for a moved oid.
- Do not change the undeclared-cell code path's behavior or output. Why: the 16 path is sealed by holdout receipts and byte-identity evidence; `evidence/runs/operator-flows/byte-identity.json` pins `composeAngularPlan` output byte-for-byte.
- Do not regenerate anything under `evidence/**`. Why: no evidence claim changes in this unit.
- No `git stash`, `git checkout --`, `git reset`, `git clean`. Why: standing goal rule after the T028 incident.
- Do not run `vp pack`. Why: dist regeneration is sequenced in unit u11 with trust regen ordering.

## Verification

```verify
pnpm exec vp test --project node packages/cli/test/operator-flows.test.ts packages/cli/test/operator-era-cell.test.ts
npm run trust:verify -- --offline
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
node packages/cli/src/fixture/operator-flow-byte-identity-run.ts --verify-only 2>/dev/null || node -e "const b=require('./evidence/runs/operator-flows/byte-identity.json'); if(!b.adapterFreezeComposite.startsWith('27741d9c'))throw new Error('composite moved'); console.log('BYTE-IDENTITY-EVIDENCE-UNTOUCHED')"
```

The first command is the behavioral gate; the second proves the trust chain still verifies with no regeneration; the third proves no frozen byte moved; the fourth re-derives (or at minimum confirms untouched) the byte-identity evidence, guarding the sealed 16 path against accidental drift. If the byte-identity fixture driver needs flags other than `--verify-only`, check how it is invoked in `evidence/runs/operator-flows/byte-identity.json` provenance or the fixture source and use the correct invocation — but it must only READ/compare in this unit, never rewrite the evidence file.

## Blocked permission

If threading the cell requires touching a file outside the contract (for example a shared types module), if the refusal registry genuinely lives inside a frozen subtree, or if the sealed default path cannot stay byte-identical without a design decision, return status "blocked" with the question in open_questions instead of improvising.
