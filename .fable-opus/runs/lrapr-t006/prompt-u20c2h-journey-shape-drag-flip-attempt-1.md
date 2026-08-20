Fable-Opus-Unit: lrapr-t006/u20c2h-journey-shape-drag-flip
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the super-productivity witness journey-TYPE shape and the drag-surface membership flip in /Users/jacksm5pro/dev/open-source/versionless — the bounded schema-side half of the remaining journey (commit `31c10e3`: migrated lane clean at dist-25; AppSpec + legs a/e landed). NO browser runs, NO calibrated leg values (the driver + calibration is the next unit) — this unit lands the TYPES and the drag flip so the leg driver slots in without schema surgery.

1. **Drag-membership flip** (`packages/core/src/receipts/witness-real-app.ts`): add `'angular-super-productivity'` to `WITNESS_REAL_APP_DRAG_SURFACES`, retire the deliberate-absence comment, and in the super-productivity schema flip the drag-PROHIBITION constants (currently asserting no drag) into the earned drag-REQUIREMENT (the vertical now MUST record a drag gesture with settled order). The app's real dragula surface justifies membership; drag stays hard-refused for every other app (the existing exactly-one/none tests update to reflect two drag-surface members now — jira-clone and super-productivity). Recorded per mw1e.
2. **Journey-type shape** in the schema: the leg (c) time-tracking evidence shape (icon-flip settled anchor, play-icon-indicator presence, time-val rendering) and leg (b) drag evidence shape (settled order, store/rendered-list assertion), as TYPES with rule-pins the parser checks — NOT measured literal values (those come from the calibration unit; pin the rule/shape, range-check where a value is publish-time). The `behaviorDigest` projection extended to include the new legs' membership.
3. Tests: schema round-trip for the new shapes; the drag-flip cross-file assertions in `witness-real-app` receipt tests updated (the ones currently asserting super-productivity refuses drag flip to asserting it's an admitted surface). Whole repo gate green. NO journey/driver, NO evidence writes.

## File contract

- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/test/**`

## Forbidden moves

- No journeys/drivers/browser; no measured literal leg values (rule-pins only); no other packages/core changes; no packages/frameworks/**, packages/cli/src/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/**, fixtures/\*\*.
- Additive/flip only as specified; drag membership matches the real measured surface (jira-clone already earned; super-productivity's dragula justifies it — the actual drag gesture is measured next unit, but the SURFACE membership + app source dragula binding justify the type-level admission; if you judge the membership must wait for the measured gesture, say so and land only the journey-type shape). No fabricated evidence. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the drag membership genuinely cannot be admitted before the measured gesture (the closed-list discipline — then land only the journey-type shape and say the flip waits for the driver unit), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
