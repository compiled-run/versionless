Fable-Opus-Unit: lrapr-t004-hospitalrun/h3a-cra-global-shim
Fable-Opus-Timeout-Minutes: 35

## Goal

Fix a proven generic gap in the CRA→Vite adapter of /Users/jacksm5pro/dev/open-source/versionless and rebuild the HospitalRun lanes. Evidence (prior unit's browser probe): webpack 4/react-scripts auto-provides the `global` identifier; Vite does not; HospitalRun's Vite 8 bundle throws `ReferenceError: global is not defined` at pouchdb's `immediate` dependency (unguarded `global.queueMicrotask` / `global.MutationObserver` / `global.document`) and renders an empty #root, deterministically in both build runs.

1. Add the CRA global-compatibility capability to `packages/frameworks/react/src/react-cra-vite-adapter.ts` GENERICALLY (no app names): prefer the semantically-tight mechanism — e.g. a `define`-style `global`→`globalThis` mapping or an inject/banner shim — matching the adapter's existing idiom; unit-test it (a module using bare `global` builds and runs). Document in the test why webpack 4 apps need it.
2. Rebuild BOTH HospitalRun lanes offline per the fixture flow (baseline needs the Rosetta Node 12.14.1 cell; target on workspace Node): twice each, deterministic. Verify with a quick headless probe (the repo's Playwright host) that the migrated build now boots — `#root` non-empty on `/` — this is a boot probe, not the witness journey suite.
3. Regenerate the HospitalRun canonical build receipt under `evidence/runs/react-hospitalrun/` (current one pins canonicalDigest 4f498c3c… against the broken build; append-style honesty rules — the receipt regeneration replaces the current receipt via the canonical flow, and the discovered-broken finding must be RECORDED in the regenerated receipt/markdown, not erased: a migration gate caught a real runtime break that build parity missed).
4. Measure papercups impact: rebuild the papercups Vite target with the updated adapter and byte-compare against its sealed digests (`evidence/runs/react-papercups-v1-0-0/`, witness receipt digest abd33d56…). REPORT ONLY — do not regenerate papercups evidence in this unit; if digests shift, say exactly which files changed so the PM can schedule regeneration.
5. Whole repo gate green.

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/react-hospitalrun/**`
- `fixtures/react-hospitalrun/**`

## Forbidden moves

- No app-name branching in the reusable surface (the guard tests must stay green); no packages/core/**, packages/trust/**, evidence/runs/react-papercups*/\*\*, evidence/runs/witness-*/**, aggregate.json, evidence/trust/**, evidence/ingests/**, scripts/**, docs/\*\*.
- Do not erase the broken-build finding — the regenerated evidence records that the gate caught it.
- Network: none (era-pinned deps and registry caches already exist locally from the prior build; if an install genuinely needs the consented registry, record it).
- Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the shim cannot be added generically, determinism fails post-fix, the boot probe still fails (report the exact new error), or papercups measurement requires touching sealed evidence, return status "blocked" with specifics in open_questions.
