Fable-Opus-Unit: lrapr-t021/u4-app-source-transform-wall
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: Four generic app-source-facing capabilities (NG2007 decorator synthesis, inline webpack loader-chain rewriting, dom-lib drift, post-disposition undeclared edges) each carry real overreach risk — a wrong transform silently rewrites application semantics — and the unit must then measure the no-successor wall honestly, where inventing stubs would corrupt the holdout's meaning.

## Goal

Close the Angular holdout's remaining GENERIC-transform gaps in /Users/jacksm5pro/dev/open-source/versionless (T021; React subtree stays at `972ca80155bbc2a6eb3779943cd481b71d35e803`), then measure what wall remains. Current migrated-build state (u3, commit e6a219e): 260 diagnostics — NG2007 ×1, raw-loader module-not-found, TS2339 msOverflowStyle ×1, leaflet undeclared-edge (+downstream TS7006/NG1010), TS2307/MNF ×~15 from the three no-successor libraries in app use, and NG8001/8002/8003/8004 ×249 template diagnostics downstream of app.module.ts failing to compile.

CAPABILITIES TO LAND (each: detector-gated, generic, tested positive/negative/idempotent; study the existing composition pattern):

1. NG2007 UNDECORATED BASE CLASS: a base class using Angular features (DI constructor params, lifecycle hooks) without a decorator was legal ViewEngine, illegal Ivy. The generic answer Angular's own migration shipped is adding `@Directive()` (no selector) to such base classes. Detect via the compiler's own diagnostic or equivalent static analysis; synthesize the decorator + import. This answers `abstract.settings.component.ts:14`.
2. G6 INLINE WEBPACK LOADER CHAIN: `require(`raw-loader!../translate/messages.${locale}.xlf`)` — webpack-only syntax. The generic reading: an inline `raw-loader!` chain asks for file-contents-as-string; the modern equivalent under the Angular builder is a different mechanism (e.g. declared asset + fetch, or build-time inlining). Study what the app does with the result (it feeds ViewEngine i18n locale selection at runtime) AND how the tiny-translator localize lane handled i18n — the honest transform may be tied to the i18n driver composition rather than a naked loader rewrite. If the truly generic answer is "this construct pairs with the template-i18n-runtime capability composed at the driver" — implement the loader-chain half generically and record how the driver completes it.
3. G7 DOM-LIB DRIFT: `msOverflowStyle` left lib.dom.d.ts. Generic: era-DOM-property continuation (the property is a vendor CSS property read/written on style objects). The honest minimal transform: type-level accommodation (e.g. index-signature cast) synthesized where era code touches departed lib.dom members — derived from the diagnostic, no hardcoded property list beyond what the detector reads.
4. LEAFLET UNDECLARED EDGE: extend/compose `undeclared-runtime-dependency` (or a sibling) so post-disposition edges are read: when a cell disposition drops a wrapper that transitively supplied a package the app imports directly (`leaflet` at lightbox.map.gallery.component.ts:15), the capability must declare it (with @types where the era had them). Era-read vs post-disposition-read is the defect — fix the reachability generically.
5. Also compose `deep-import-redirection` for the ngx-bootstrap exports-map narrowing (u3 named it; currently produces no diagnostic — compose it where its detector matches so it is not another G5).

THEN: re-run migration + install + build ONCE. Record the honest remaining wall — expected: the three no-successor libraries' TS2307/MNF at their real app import sites and whatever template diagnostics remain. DO NOT stub, shim, or fake the dead libraries; do not hand-edit app source. Report the wall with the options honestly framed (e.g. cell-policy question: a target cell with ngcc; app-change question: outside holdout discipline; honest RED for full parity) — the disposition is the cockpit's, not yours.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/ingests/angular-pigallery2-v1-7-0/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`

## Forbidden moves

- React subtree untouchable (verify oid). No app-name/revision/exact-source branches. No app-source hand edits. No stubbing/faking dead libraries. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any processes. Network only for npm metadata of named packages under consent VL-LEGACY-CORPUS-2026-08-10 if needed.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-FROZEN-INTACT'
```

## Blocked permission

If a capability cannot avoid overreach (explain the boundary that fails), the loader-chain/i18n coupling cannot be split honestly between capability and driver (bring the analysis), the re-run surfaces a new gap class, or the work exceeds this unit (say which capabilities landed and the current wall), return status "blocked" with specifics in open_questions instead of improvising.
