Fable-Opus-Unit: lrapr-t006/u20c2i-leg-drivers-calibration
Fable-Opus-Timeout-Minutes: 35

## Goal

Drive and calibrate super-productivity journey legs (c) time-tracking, (b) drag-reorder, and (d) project-switch+theme against the live DOM in /Users/jacksm5pro/dev/open-source/versionless — the journey producer half (commit `3d68c5f`: migrated lane clean at dist-25, journey-type shapes + drag membership landed; legs a/e already in the AppSpec producer). NO publish (the runner+publish is the final unit).

Extend the `angular-super-productivity` journey producer in `real-app-run.ts` to drive, on BOTH lanes (migrated = dist-25):

- Leg (c): create a task, start tracking via `main-header .play-btn`, assert the icon flip `play_arrow`→`pause` + `task .play-icon-indicator` present (settled anchor, never a timer), stop, assert the flip back; tracked time renders at `task .time-wrapper .time-val` (digit-bearing).
- Leg (b) drag: create two tasks, drag-reorder with the real pointer drag primitive (the jira-clone precedent), assert the settled order is a real permutation of the before-order and the store list agrees with the rendered list — this is the earned drag gesture the u20c2h membership requires. Retire the stale "no drag driven" comment/assertion in the producer.
- Leg (d): create a second project via the side-nav `addProject()` dialog, switch to it, toggle dark theme via the `/project-settings` formly config-section save, prove it with a rendered-style probe (before/after), and exercise one meaningful keyboard shortcut (`w` goToWorkView or `b` toggleBacklog).

Calibrate every selector/count/settled-anchor against the live DOM (run the browser freely; the u19/u20 lesson — measure before pinning, record each correction). Pin the measured leg (c)/(b)/(d) values into `WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY` and the per-lane inventories (the migrated lane is clean now — pageErrors 0 both lanes; any real break is RED evidence first). Schema changes only where a measured value contradicts a rule-pin (recorded). Tests per idiom; whole repo gate green. Publish nothing to evidence/.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No publish/runner; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- Settled-reaction anchors never timing; drag membership already earned (u20c2h) — this unit provides the measured gesture that satisfies it; no fabricated evidence; truthful reds. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If a leg cannot pass truthfully on either lane (RED first with the measurement — a real break like the ones this cell already surfaced), drag cannot settle deterministically, leg (d)'s dialog/formly flow reveals a break, or the work exceeds this unit (cut: c+b land, d re-cut), return status "blocked" with specifics in open_questions instead of improvising.
