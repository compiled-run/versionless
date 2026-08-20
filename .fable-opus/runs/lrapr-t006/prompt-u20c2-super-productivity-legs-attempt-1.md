Fable-Opus-Unit: lrapr-t006/u20c2-super-productivity-legs
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the super-productivity AppSpec and journey legs (a)(c)(d)(e) in /Users/jacksm5pro/dev/open-source/versionless — re-cut 2 of 4 (commit `4937e41`: host capabilities landed; u20b's calibration facts are the ground truth). NO drag leg (re-cut 3), NO runner/publish (re-cut 4).

Calibrated facts to build on: app boots into planning mode with zero tasks (every leg creates its own state); shell probes live (`main-header`, `.project-settings-btn`, `mat-drawer-container`, `side-nav`, `split`, `banner`); the work view reaches via `.work-view-header`/`.task-list-wrapper` (NOT work-view-page — the schema pin needs the calibration-contradicted correction, recorded); real ngsw settles (ready, activated, controlling, 7 caches) → the new `run.serviceWorker` shape; both era worker chunks fetched 200; font seam answered once; zero failed requests at boot; storage empty at boot; no first-route overflow at 1280×900.

Legs (both lanes' facts pinned from calibration passes as needed — you may run the browser freely):
(a) create a task via `add-task-bar input` with typed content → renders in `task-list`;
(c) start/stop time tracking anchored on the app's own settled reaction (play/pause control state + tracked-time rendering);
(d) project switch + dark-theme toggle proven by a rendered-style probe + one meaningful keyboard shortcut;
(e) reload persistence via the new IndexedDB key reader (opt-in declared on the AppSpec; keys measured under `SUP`/`SUP_STORE`; the created task must survive reload — assert via the rendered list post-reload, with the key census recorded);
plus per-lane console/failed-request inventories pinned from calibration (ngsw lifecycle noise pinned exactly if it appears), the shared font seam, measured scroll or absence per surface, the `useHash` route shape.

Deliver: AppSpec + journey in `real-app-run.ts` (the spec declares `indexedDb: 'read-keys'`; drag NOT declared yet); schema corrections ONLY where calibration contradicts (the work-view host tag; each recorded per the mw1e precedent); tests per idiom; whole repo gate green. Publish nothing to evidence/.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No drag leg or membership; schema changes only where calibration contradicts, recorded; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds (a real behavioral break is RED first). No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If a leg cannot pass truthfully on either lane (RED first with the measurement), the IndexedDB reader hits a refusal on this app's real stores (bring it), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
