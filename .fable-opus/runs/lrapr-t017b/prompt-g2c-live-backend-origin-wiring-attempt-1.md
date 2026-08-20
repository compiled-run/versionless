Fable-Opus-Unit: lrapr-t017b/g2c-live-backend-origin-wiring
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: The fix is a generic origin/CORS coordination in the shared live-backend serving path that must be AppSpec-declared, never an app-name/exact-source branch; getting the generality boundary right (what is generic runner code vs what is per-app declared config) under holdout falsification discipline is the expensive, judgment-heavy part.

## Goal

Wire the GENERIC live-backend serving path so a served production-static SPA can actually reach its own spawned loopback backend, in /Users/jacksm5pro/dev/open-source/versionless. Today it cannot: the g2a path (commit d7ebff6) was landed but never live-wired, and a prior calibration unit PROVED why and PROVED the fix. This unit lands ONLY that serving/origin fix and proves the baseline cypress-realworld-app lane authenticates against its live backend. NO journey selector/category calibration (next unit), NO migrated lane, NO publish.

MEASURED DEFECT (already proven, do not re-derive from scratch — confirm and fix):

1. `packages/cli/src/witness/live-backend.ts` `backendOrigin(port)` hardcodes `127.0.0.1:<port>`, but the built SPA calls `http://localhost:3001`. So `buildLoopbackBackendInventory` throws "unexpected loopback origin" and origin bucketing is wrong. `localhost`, `127.0.0.1`, and `[::1]` are ALL loopback names — recognizing them as loopback is correct, not app-specific (check `isWitnessLoopbackUrl` in playwright-host.ts too).
2. The SPA's backend enforces CORS `origin: http://localhost:${REACT_APP_PORT}, credentials: true`. The runner (`packages/cli/src/witness/real-app-run.ts` `executeRun` + `startStaticServer`, which binds 127.0.0.1:0) both addresses the browser at 127.0.0.1:<ephemeral> AND never injects the served SPA port into the backend env. Result: every credentialed XHR is CORS-rejected and the app can't authenticate. The proven fix: address the browser at the host the backend expects (`localhost`) and inject the actual served SPA port into the backend env var the app uses for its CORS origin (`REACT_APP_PORT`).

GENERALITY BOUNDARY (holdout discipline — this is the crux):

- The RUNNER code stays generic. It must NOT branch on the app name, revision, or exact source. It reads DECLARED config.
- The per-app facts (the host the SPA must be addressed as; the backend env var name(s) that carry the SPA origin/port for CORS) are DECLARED on the AppSpec (the same category as an app declaring its journey selectors), NOT hardcoded in the runner and NOT an app-name branch. Add the minimal declarative fields to the live-backend/AppSpec types in `packages/core/src/receipts/witness-real-app.ts`, set them on the cypress-rwa AppSpec in `packages/core/src/receipts/witness-react-cypress-rwa.ts` (host `localhost`, CORS-origin env `REACT_APP_PORT`), and have `executeRun`/`startLiveBackend` consume them. If a live-backend AppSpec omits these, keep today's 127.0.0.1 default behavior so the 13 static apps and any origin-agnostic backend are unchanged.

PROVE IT:

- Baseline lane (`.versionless/work/react-cypress-rwa/baseline` built static output) served with the real Express/lowdb backend booted in the app's era runtime cell (Node 14.16.1, reseed-from-snapshot): demonstrate the SPA authenticates against the live backend with NO CORS rejection — POST /login returns 200 and a subsequent credentialed GET (e.g. /checkAuth or /transactions/public) succeeds. Use the existing in-contract drivers (`packages/cli/src/fixture/react-cypress-rwa-probe.ts` and/or `react-cypress-rwa-calibrate-run.ts`) to demonstrate; report the observed request outcomes.
- Add a focused regression test (in `packages/cli/test/**` or `packages/core/test/**`) over the origin/loopback-recognition + env-injection coordination logic (unit-level, no browser needed) so the fix is protected.
- `buildLoopbackBackendInventory` must no longer throw on the live `localhost` backend origin; the loopback-backend bucketing must accept it.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`

## Forbidden moves

- No app-name / exact-revision / exact-source-string branch in RUNNER/product code (the AppSpec DECLARES; the runner reads). No packages/frameworks/**. No application-source hand edits. No packages/trust/**, evidence/**, scripts/**, docs/**, fixtures/** app source. No published witness receipt. No journey selector/category calibration or migrated-lane work (next unit). Do not weaken any existing test or the 13-static-app byte-identical guarantee. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any backend process you spawn before returning; do not leave a listener on 3001.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the proven fix does not actually let the SPA authenticate (bring the observed request outcomes and the CORS/origin evidence), the generic-vs-declared boundary cannot be drawn without an app-name branch (name exactly what forces it — that is a real finding), or making localhost a loopback origin breaks the 13-static-app guarantee, return status "blocked" with specifics in open_questions instead of improvising.
