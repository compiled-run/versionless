Fable-Opus-Unit: lrapr-t006/u20b-super-productivity-journey
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the super-productivity AppSpec/journey, dedicated runner, and browser calibration in /Users/jacksm5pro/dev/open-source/versionless — split 2 of 3 (commit `1e65bb0`: schema landed on corrected foundations; lanes: era dist per the u21 correction, migrated dist-23). NO publish (u20c).

Journeys per the u20 plan, calibrated against the live DOM (the u19-series lesson: measure before pinning; expect the calibration to correct your first drafts and record each correction):
(a) create a task with typed content → renders;
(b) **drag-reorder two tasks with real pointer gestures** → settled order asserted — on success, `angular-super-productivity` EARNS its `WITNESS_REAL_APP_DRAG_SURFACES` membership (the schema currently refuses drag; flip the refusal to the earned membership in the same change that lands the measured drag);
(c) start/stop time tracking anchored on the app's own settled reaction (play/pause control state + tracked-time rendering — never timing);
(d) project switch + dark-theme toggle proven by a rendered-style probe + a keyboard shortcut where meaningful;
(e) reload persistence via IndexedDB (localforage `SUP`/`SUP_STORE`) with storage keys recorded as measured;
plus per-lane inventories (console, failed requests — the ngsw lanes may emit SW-lifecycle noise: pin whatever reality shows exactly), the shared font seam blocked per idiom, measured scroll or absence, route shape per the schema's `useHash` reading.

Deliver: AppSpec + journey in `real-app-run.ts`; dedicated runner `packages/cli/src/witness/angular-super-productivity-run.ts` (mutation seam chosen and verified unique against dist-23); tests per idiom; you may run the browser freely for calibration but publish nothing to evidence/. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- Schema changes ONLY for the drag-membership flip and calibration-contradicted pins (each recorded per the mw1e precedent); no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- Drag membership only WITH the measured drag; no fabricated evidence; truthful reds (a real behavioral break across the lift is RED evidence first). No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If a journey cannot pass truthfully (RED first — the u19 precedent shows what that discipline finds), drag cannot settle deterministically, or the work exceeds this unit (state exactly what lands vs what is owed), return status "blocked" with specifics in open_questions instead of improvising.
