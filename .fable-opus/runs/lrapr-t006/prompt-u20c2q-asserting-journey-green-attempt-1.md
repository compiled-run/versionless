Fable-Opus-Unit: lrapr-t006/u20c2q-asserting-journey-green
Fable-Opus-Timeout-Minutes: 40

## Goal

Drive the super-productivity ASSERTING witness journey end-to-end to green on BOTH lanes in /Users/jacksm5pro/dev/open-source/versionless (commit `a5366f7`: the runner scaffolding exists; `executeAngularSuperProductivityWitnessRun` drives all five legs but the asserting journey RED-fails at boot — the `WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY` pins were validated by the calibration driver, NOT by a full asserting run). NO publish — this unit makes the journey PASS end-to-end on both lanes with every pin matching a real asserting run.

Method (the honest calibration-of-the-asserting-journey):

1. Run the actual asserting journey (`executeAngularSuperProductivityWitnessRun`) against baseline dist-run2 AND migrated dist-25. It dies at the boot `taskLists=2` assertion — the live DOM renders exactly 1 task-list throughout (the done-tasks list only exists with completed tasks). Correct that pin to the measured 1, recorded per mw1e as an app-shape fact.
2. Continue driving; each pin the asserting run contradicts (navigations, drag order, timer icon flip, project-switch title, leg-d dark→light contrast strings per lane, key census, service-worker parity, scroll) gets corrected to the MEASURED value — measure on both lanes, RED-first on any real behavioral break (this cell has surfaced three real regressions; a genuine break is evidence, not a pin to fudge). Per-lane declared differences (typeface, theme rgb format) stay declared, never in the shared behavior digest.
3. Iterate until both lanes drive the full five-leg journey GREEN with `pageErrors=0`, one shared behavior digest, and every JOURNEY pin measured-true. Do NOT publish receipts — the deliverable is the green asserting journey + corrected pins + a calibration evidence note under `evidence/runs/angular-super-productivity-v2-13-15/` recording every pin correction and the final both-lane green measurements.
4. Tests updated for the corrected pins; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No published witness receipt (that is the next unit); no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Pins corrected ONLY to measured values (each recorded); a real behavioral break is RED first, not a pin correction; settled anchors never timing; per-lane differences declared not normalized. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If a real behavioral break (not a stale pin) surfaces on either lane (RED first with the measurement), the two lanes cannot converge on one behavior digest even after declaring the legitimate per-lane differences (bring both digests), or the full asserting drive genuinely exceeds this unit (state exactly which legs are green and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
