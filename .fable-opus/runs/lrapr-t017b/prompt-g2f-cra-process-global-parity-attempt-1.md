Fable-Opus-Unit: lrapr-t017b/g2f-cra-process-global-parity
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: A new frozen-adapter capability that must reproduce webpack-4/CRA's functional process shim as honest behavioral parity, analyzer-driven from the bundle's real usage and refusing app-identity branches — the generality/honesty boundary (functional shim for called methods vs the Angular read-only eval shim, honest leaves, no over-shimming) is exactly the high-judgment work the holdout exists to force.

## Goal

Close the cypress-realworld-app React holdout's named RED gap in /Users/jacksm5pro/dev/open-source/versionless: the migrated Vite bundle throws `process is not defined` at module-eval and white-screens (baseline CRA runs the full journey; g2e proved this deterministically twice). Add a GENERIC, analyzer-driven CRA/webpack-4 process-global parity capability to the React CRA→Vite adapter so the migrated bundle boots, then prove the migrated lane BOOTS and renders. This is an AUTHORIZED adapter reopen for a named holdout gap (T017b clause). NOT the full parity/determinism proof (that is the next unit) and NO published receipt.

WHY THIS IS HONEST PARITY, NOT A HACK: the baseline (CRA/webpack-4) build the app was authored against injected a functional `process` (webpack `ProvidePlugin` + `process/browser`) and inlined `process.env.NODE_ENV` (`DefinePlugin`). The app and its deps genuinely depend on that runtime contract. To achieve BEHAVIORAL parity with the baseline lane, the migrated build must reproduce that same runtime environment. Reproducing it is parity; leaving it out is the divergence.

DESIGN (study, do not blindly copy, `packages/frameworks/angular/src/node-core-runtime-globals.ts` for the discipline — derived-from-bytes, only-what-evaluation-reaches, honest leaves, refuse app-name branches — but note the CRITICAL difference): the Angular capability is a READ-ONLY evaluation shim and deliberately REFUSES globals that are called/constructed. The React bundle CALLS `process.nextTick` (~60), `process.cwd` (~2) and reads `process.version`/`process.browser`/`process.platform`/`process.env` — so this capability must supply a FUNCTIONAL `process/browser`-parity shim (the exact webpack-4/CRA surface: `nextTick` as a real microtask/timer scheduler, `browser: true`, `version: ''`, `versions: {}`, `platform: 'browser'`, `cwd: () => '/'`, `env` object), plus `process.env.NODE_ENV` (and any other statically-inlined CRA env) define-inlined to the build mode. Drive WHAT is supplied from the migrated bundle's ACTUAL process.\* usage (analyzer over the emitted/entry code), not a blanket shim of every Node global. Deliver it through the React adapter's OWN build seam (a polyfill/entry/define the adapter emits, an ordinary visible module — not an app-source edit). NO branch on the app name, revision, or exact source string.

PROVE IT:

1. Rebuild the migrated Vite lane (`target/build-vite`) through the adapter with the new capability. Confirm the emitted bundle no longer references bare `process` at eval (or references a supplied shim).
2. Run the calibrated journey driver against the migrated lane served with the live backend: the migrated bundle must BOOT — no `process is not defined` pageError, root renders, the app reaches the `signup-form` anchor (i.e. gets past module-eval and mounts). Report the before/after (g2e: 0/1 legs, pageError process-not-defined → now: boots, reaches signup-form). Full 51-leg journey + two-lane digest parity + pass-twice determinism is the NEXT unit; here, BOOT + mount + first real leg is the pass bar. If booting reveals a FURTHER distinct gap, name it (RED) with the measurement.
3. Register the capability as EXPERIMENTAL/single-app in the coverage map (`packages/core/src/receipts/capability-coverage.ts`) — it is proven on one React app until a 2nd CRA app proves it; do not mark it cross-proven.
4. Repo gate green; add adapter-level tests for the capability (`packages/frameworks/react/test/**`).

## File contract

- `packages/frameworks/react/**`
- `packages/core/src/bundlers/**`
- `packages/core/src/migrations/**`
- `packages/core/src/analysis/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`

## Forbidden moves

- No branch on the holdout app name, revision, or exact source string (analyzer-driven only). No application-source hand edits (the shim is adapter-emitted build infrastructure, not an app file). No blanket "shim every Node global" — supply only what the bundle's evaluation actually reaches, with honest `undefined`/functional leaves. No packages/cli/src/witness/** journey re-pinning beyond what boot requires (that was g2d). No published/canonical witness receipt. No packages/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/**, other evidence/runs/** dirs, scripts/**, docs/\*\*. Do not mark the capability cross-proven. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any backend you spawn; leave nothing on 3001.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the process gap cannot be closed generically without an app-name/exact-source branch (name exactly what forces it — a genuine RED), booting the migrated lane reveals a further gap that also needs the frozen adapter and exceeds this unit (name it with the measurement), or the honest-parity shim cannot be expressed through the adapter's build seam, return status "blocked" with specifics in open_questions instead of improvising.
