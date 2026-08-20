Fable-Opus-Unit: bank-demo-fleet-pipeline/T015-coverage-report
Fable-Opus-Timeout-Minutes: 30

## Goal

Emit the derivation-guarded **coverage report** — `evidence/trust/current/coverage-report.json` and `coverage-report.md` — sourced from the existing supported-matrix / enterprise derivation (never a parallel one), joined to the trust package's deterministic artifact list so `trust:verify --offline` covers it, terminating in `assertEnterpriseSurfaceHonesty`, and encoding one new rule: an application admitted through `versionless run` is recorded proven ONLY if its run record exists with interventions == 0. Then fill the `report` slot in `versionless.run.v1` so `run` ends by pointing at an emitted report.

Why. The owner's outcome is one command that ends in a coverage report. `run` exists (T007) and its record carries `report: { status: 'not-yet-emitted', slot: 'evidence/trust/current/coverage-report.json' }`. Nothing writes that file yet. This unit writes it — from the same receipts and the same guarded derivation the enterprise report already uses, so widening the surface cannot widen the claim.

Read first, in this order:

1. `packages/trust/src/generate.ts` around :2030-2075 — the `deterministic: Array<[string, unknown]>` list (12 entries, `adapter-freeze.json` … `capability-coverage.json`), how each is written, digested into `ManifestArtifact[]`, and folded into `deterministicCore`. Your report joins this list — that is what makes it derivation-guarded and offline-verifiable.
2. `packages/cli/src/cli.ts:427-441` — `report:enterprise`: verifies trust first, then re-derives one machine artifact and one human document from the canonical receipts; `--verify-only` refuses to write. Mirror this shape for the coverage report (or extend `runEnterpriseReport` to emit the coverage pair alongside — say which).
3. `packages/cli/src/operator/matrix.ts:42-51,105-176` — `readSupportedMatrix` verifies trust first, renders counted cells / holdouts / falsification history / boundary prevalence, and ends in `assertEnterpriseSurfaceHonesty` (`packages/trust/src/enterprise.ts:935-975`). Source your numbers from this path.
4. `packages/cli/src/operator/run.ts` — the `report` slot and the seam; and `evidence/runs/witness-synthesized/react-papercups-v1-0-0/record.json` for how a machine record carries `integrity` and `notEstablished`.
5. `docs/goals/bank-demo-fleet-pipeline/notes/T001-plan-validation.md` — the coverage-report specification section (what it must contain, and: "an app with intervention count > 0 may not be recorded as proven").

Deliver:

1. **`coverage-report.json`** (schema `versionless.coverage-report.v1`) with at minimum: the sealed baseline as the report reads it today (react counted/proven cells, angular counted/proven cells, capabilities cross-proven / experimental / total — verbatim from the supported-matrix derivation, so today it reads `react: 6 counted of 6`, `angular: 4 counted of 4`, `8 cross-proven of 58`); per-application rows (id, framework, status `proven | bounded | refused | not-admitted`, the bounded string verbatim where one applies, the refusal code where one applies, and `provenanceOfStatus: 'sealed-receipts' | 'run-record'`); the refusal census totals by code (from `evidence/runs/operator-flows/refusal-census.json`); `interventionRule: { applied: true, statement: '…' }`; `integrity` (canonical sha256) and `notEstablished`. **`coverage-report.md`** is the human rendering of the same data, and it must pass `assertEnterpriseSurfaceHonesty` — build it through the same guard the enterprise report uses.
2. **The intervention rule, encoded:** an application whose status derives from a run record is proven only if that record carries `interventions.count === 0` (T014 will emit that field; until it exists, a run-record-derived application cannot be proven and the report says why: `intervention-count-not-asserted`). Applications whose status derives from sealed receipts (the current 10) are unaffected — the rule must not un-prove them. Write a test that proves both directions.
3. **Join the artifact list**: add `['coverage-report.json', coverageReport]` to `deterministic` in `generate.ts` (the `.md` follows the enterprise-report.md pattern — read how that one is handled and do the same). Then, because dist is a provenance subject and later units changed CLI source since the last trust regeneration: **rebuild dist ONCE first (`pnpm exec vp pack`), declare it in the receipt, then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`** (the T017 shape). Freeze composite must stay `27741d9c…`; react 6/6, angular 4/4, 8-of-58 must reproduce verbatim; the trust digest WILL change and you record old (`c9941f8f…`) and new.
4. **`report:coverage` CLI command** (or `report:enterprise` extended — say which) with `--offline` required and `--verify-only`, mirroring `report:enterprise`; and **`run` fills its `report` slot** with `{ status: 'emitted', path, digest }` when the report exists and verifies, or `{ status: 'not-yet-emitted' | 'stale', … }` honestly otherwise. `run` must NOT regenerate trust itself in this unit — it points at the report; keeping it fresh across rebuilds is T021's ordering work.
5. **Tests**: `packages/trust/test/coverage-report.test.ts` (schema, honesty guard on the .md, intervention rule both directions, sealed numbers verbatim) and additions to `packages/cli/test/operator-run.test.ts` for the filled slot.

Do NOT touch `packages/core/src/corpus/conformance.ts` or `packages/core/src/receipts/capability-coverage.ts` — the 12-application literal-union ceiling is the NEXT unit (T022). If the report cannot be emitted for the current 10 applications without opening that ceiling, return `blocked` and say exactly why.

Budget: 30 minutes; start the verify chain by minute 18; emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what is left, not `partial`.

## File contract

- `packages/trust/src/generate.ts`
- `packages/trust/src/enterprise.ts`
- `packages/trust/src/coverage-report.ts`
- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/trust/test/**`
- `packages/cli/test/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not touch `packages/core/src/corpus/conformance.ts` or `packages/core/src/receipts/capability-coverage.ts`. Why: that is T022's ceiling work, and it must reproduce sealed numbers under its own gates.
- Do not weaken, bypass, or special-case `assertEnterpriseSurfaceHonesty`. Why: it is the only mechanical guard against restating a bounded claim more generally; the report must pass it as-is. If a string cannot survive, change the string.
- Do not derive coverage numbers by any path other than the existing supported-matrix / enterprise derivation. Why: two derivations can disagree; one guarded derivation cannot.
- Do not hand-edit any file under `evidence/trust/current/`. Why: it must be what `trust:generate` emitted, or it is not evidence.
- Do not restate `witness-passed-on-bounded-anonymous-catalog-surface` or any other bounded string more generally, anywhere. Why: the bounded string is part of the sealed claim.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not fetch from the network. Why: offline-verifiable artifact.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline --verify-only
test -f evidence/trust/current/coverage-report.json && test -f evidence/trust/current/coverage-report.md && echo COVERAGE-REPORT-EMITTED
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved');console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2598/2598 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the report cannot be emitted for the current 10 applications without opening the conformance.ts ceiling; a report string cannot survive the honesty guard without weakening it; trust:generate needs the network; or the regenerated surfaces move any sealed number or the freeze composite.