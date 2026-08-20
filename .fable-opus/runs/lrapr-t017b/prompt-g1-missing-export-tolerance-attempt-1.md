Fable-Opus-Unit: lrapr-t017b/g1-missing-export-tolerance
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: Hardening the frozen React adapter under holdout falsification — the capability must reproduce webpack 4's dangling-ESM semantics exactly and generically, and a wrong scope corrupts the adapter's behavior on all CRA apps, not just the holdout.

## Goal

Chase the React holdout (cypress-realworld-app v1.0.18) to a GREEN migrated build in /Users/jacksm5pro/dev/open-source/versionless by hardening the React adapter (owner-directed 2026-08-13; commit `8305dbb`). AUTHORIZED ADAPTER REOPEN — the 5de7df56 freeze is lifted for this hardening loop (do NOT enforce the fingerprint fence; you are changing packages/frameworks/react). Stage at the holdout migrated tree; T017's re-run receipt names the gaps.

Gap 2 (from T017, byte-precise): `[MISSING_EXPORT] "bpfrpt_proptype_WindowScroller"` at `react-virtualized/dist/es/WindowScroller/utils/onScroll.js:74:10` — react-virtualized 9.22.3's `babel-plugin-flow-react-proptypes` ESM emits a named import of a Flow-proptype marker its own module never exports (28 files carry the pattern), reached from production `src/components/TransactionInfiniteList.tsx`. webpack 4 resolved the dangling import to `undefined`; rolldown rejects it.

1. **Generic capability** — missing-export tolerance for a self-inconsistent DEPENDENCY ES module: when a dependency (node_modules) ES module imports a NAMED binding that the target module provably does not export, reproduce webpack 4's semantics (resolve the dangling import to `undefined`) — analyzer-proven (read the target module's actual exports; the binding must be genuinely absent), scoped to DEPENDENCY modules only, refusing an application-source dangling import (that is a real app bug, not tolerated) and any app-name/revision/exact-source branch. The marker's runtime use must be provably safe-under-undefined (a proptype marker read at module eval — verify). Tests: positive (the dangling proptype import → undefined), negatives (app-source dangling import refused, a real missing export that IS used in a value position refused, a present export untouched).
2. **Re-run the holdout migrated build** against the stage. Report: GREEN (transform + render + emit all succeed), or the next itemized gap (strictly later than gap 2 — name it to the byte; a new gap is progress, not failure).
3. If GREEN: note it for the follow-up (witness journeys + re-freeze + PASSING receipt are the next units). If a new gap: itemize it as g2's spec. Update the holdout run evidence under `evidence/runs/react-cypress-rwa/` with the advance.
4. Whole repo gate green (tsc/lint/node-tests); zero application-source hand-edits.

## File contract

- `packages/frameworks/react/**`
- `packages/core/src/migrations/**`
- `packages/core/src/bundlers/**`
- `packages/core/src/analysis/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `fixtures/**`
- `evidence/runs/react-cypress-rwa/**`

## Forbidden moves

- No capability branching on holdout app name/revision/exact source; no application-source hand edits (holdout discipline); no packages/frameworks/angular changes; no packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/** (the receipt supersede is a later unit), other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The tolerance is exactly webpack-4-dangling-DEPENDENCY-ESM-import→undefined; not a blanket missing-export suppression (app-source and value-position-used cases still fail). No fabricated green. Network only for a genuinely-needed consented install (record). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-cypress-rwa'
```

## Blocked permission

If the dangling-import tolerance cannot be made generic without suppressing real app-source errors (name the case), the marker is used in a value position where undefined would misbehave (bring the reading — a genuine RED), or a new gap needs its own unit, return status "completed" with the GREEN result OR the next itemized gap in open_questions (a named next gap is a completed iteration, not a block).
