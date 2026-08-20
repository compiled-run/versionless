Fable-Opus-Unit: lrapr-t005/mj3b-ngzorro-capabilities
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the three generic ng-zorro-era migration capabilities in /Users/jacksm5pro/dev/open-source/versionless (`packages/frameworks/angular`, the ngrx/Sentry idiom: analyzer-driven, binding-resolved, refusal over half-edits; commit `7e9f42d` is the latest). Re-cut (b) of mj3; verified facts live in the mj3 receipt and the staged closure at `.versionless/stage/angular-jira-clone-mj2/app` (node_modules installed, READ-ONLY for fact-checking).

PM-ruled capability specs:

1. **Undeclared-runtime-dependency (peer-hole) capability**, cell-level: detect from the installed closure's own facts that a package's shipped bundles import a module it declares in neither `dependencies` nor `peerDependencies` (verified case: `ng-zorro-antd@16.2.2` fesm2022 bundles import `@ctrl/tinycolor`), and declare the dependency explicitly in the application manifest with a recorded reason and a registry-verified version (consented metadata read allowed: consent ID VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented, record the URL/fact; pick by the same mechanical rule as ecosystemPackages — newest line satisfying the cell). Generic surface: keyed on detection, not on this package pair.

2. **Exports-map-blocked style-import capability**: given style imports that a package's exports map no longer resolves, and PM ruling for the no-narrow-equivalent case: rewrite the blocked import to the package's exported root aggregate AND remove now-redundant granular imports of the same package, each removal recorded; the whole rewrite lands in the changeset's `declaredDifferences` channel (payload change named: 22.7KB entry → 550KB aggregate; parity will carry it as a non-claim; witness arbitrates behavior). Refuse when the package exports no aggregate stylesheet. Verified case: 8/9 jira-clone imports resolve, only the root `ng-zorro-antd/style/index.min.css` is blocked, aggregate `./ng-zorro-antd.min.css` exists.

3. **Modal content-params capability** (cross-module, the ruling from mj3): rewrite `nzComponentParams` call sites to `nzData` AND binding-resolve each `nzContent` class to its declaring file, rewriting the content component to inject `NZ_MODAL_DATA` for exactly the fields the params object supplied (verified: v16 provides `{ provide: NZ_MODAL_DATA, useValue: config.nzData }`, never instance assignment; affected components in the staged app: IssueModalComponent with @Input() issue$, IssueDeleteModalComponent with issueId + onDelete). All-or-nothing per modal call: if the content class, its fields, or the injection rewrite cannot be fully resolved, the entire call site is left whole and reported. No app names in the product surface — the staged components are fact-checking and test-fixture material only.

4. Tests per idiom for all three (positives on the staged shapes via fixture-scoped copies; refusal negatives: declared dependency untouched, exports-resolvable import untouched, no-aggregate package refuses, unresolvable nzContent refuses, non-supplied field never injected). Overfitting guard green; whole repo gate green. Do NOT apply to the staged closure or run app builds — mj3c does that.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-jira-clone/**`
- `fixtures/angular-jira-clone/**`

## Forbidden moves

- No packages/core/src, packages/frameworks/react/**, packages/cli/src/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/**, scripts/**, docs/**.
- Staged closure read-only. Network only for the one consented registry metadata read in capability 1. No app-name branches in product code. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If any of the three cannot be generic (name the concrete case), the staged facts contradict this spec, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
