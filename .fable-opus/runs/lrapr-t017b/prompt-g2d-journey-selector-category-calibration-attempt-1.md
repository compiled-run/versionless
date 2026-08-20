Fable-Opus-Unit: lrapr-t017b/g2d-journey-selector-category-calibration
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: Stateful multi-leg browser journey calibrated against a live era-runtime backend, requiring measure-before-pin discipline over many DOM/network interactions and a from-scratch re-measurement of the backend request category through payment/feeds/notifications/settings; a wrong pin silently weakens the holdout falsification test, so the judgment cost is real.

## Goal

Drive the BASELINE cypress-realworld-app lane journey to GREEN against its live Express/lowdb backend in /Users/jacksm5pro/dev/open-source/versionless, calibrating every selector/route/backend-category/placeholder pin to the MEASURED live surface. The serving/origin blocker is already fixed (g2c: the SPA now authenticates against the live backend with no CORS rejection). This unit does the baseline lane ONLY — NOT the migrated Vite lane and NOT the two-lane pass-twice determinism proof (both are the next unit), and it publishes NO witness receipt.

MEASURED DELTAS to apply (from the g2b calibration unit — confirm each against the live DOM, do not trust blindly):

1. SELECTORS: `[data-test=...]` targets the MUI TextField ROOT `<div>`; the real `<input>` is nested. Use `[data-test=<name>] input` for every form field (signup first/last/username/password, signin, bank-account, settings, peer search).
2. SIGNUP NAV: clicking `<a data-test=signup>` does NOT SPA-navigate under automation (URL stays /signin). The journey must navigate to `/signup` (a real load) to render SignUpForm.
3. BACKEND CATEGORY (rewrite to measured reality): bank-account onboarding uses `POST /graphql` (200), NOT `/bankAccounts`. Re-measure the FULL set of method+path endpoints the journey actually hits through payment (`POST /transactions` and its reads), feeds (`GET /transactions/public|contacts|personal`), notifications (`GET /notifications`, any PATCH), and settings (`PATCH /users/:id` or `/user/settings`). Rewrite `WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY` in `packages/core/src/receipts/witness-react-cypress-rwa.ts` to the measured category; drop `/bankAccounts`/`/users/search` if unused; ROUTES pins too (settings route is `/user/settings`).
4. NON-LOOPBACK: the app fetches avatars from `https://cypress-realworld-app-svgs.s3.amazonaws.com/*.svg`. Declare an in-context mocked-non-loopback seam on the AppSpec (the schema already has an app-scoped-mocked-non-loopback-seams policy) so the witness host answers them (e.g. 204) and `successfulNonLoopback` stays 0. Do not allow real S3 egress.

JOURNEY (baseline lane, live backend, per-pass reseed-from-snapshot in the app's Node 14.16.1 era cell): sign-up as a NON-seed actor → sign-in → onboarding (bank account via graphql) → settings write → money-movement to a placeholdered seed peer (assert the minted transaction appears in the feed and balances/notifications settle) → feed filter (public/contacts/personal) → notifications. Settled-reaction anchors ONLY, never timing/sleeps. The money-movement mutates lowdb — declare the minted tx id/timestamp (and any other per-run mint) as journey placeholders so the recorded evidence is stable; confirm the per-pass reseed leaves the lane deterministic.

PROVE IT: run the asserting journey against the baseline lane through the existing in-contract driver (`packages/cli/src/fixture/react-cypress-rwa-calibrate-run.ts`), correcting each pin the live DOM/backend contradicts, until the baseline journey passes end-to-end. Report the ordered legs, the measured backend category, the request-origin buckets (all loopback + the mocked S3 seam; successfulNonLoopback=0), and the placeholdered mints. Keep the schema unit tests (`packages/core/test/**`) updated to the new pins so the calibration is protected by the node gate.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-cypress-rwa/**`

## Forbidden moves

- No migrated-Vite-lane work and no two-lane pass-twice determinism proof (next unit). No published witness receipt. No packages/frameworks/** (adapter is green — a real migration break is a RED finding, not a pin to fudge). No application-source hand edits. No packages/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/**, other evidence/runs/** dirs, scripts/**, docs/**, fixtures/** app source.
- Settled anchors never timing. No fabricated/guessed pins — measure every one against the live surface; a value you cannot measure is a blocker, not a guess. No seed PII in any captured evidence. Loopback backend only; S3 mocked in-context. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any backend you spawn; leave nothing on 3001.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If a journey leg reveals a real migration/behavior break (RED first, with the measurement), a required pin cannot be measured against the live surface, the money-movement flow cannot settle deterministically under reseed, S3 cannot be mocked without real egress, or the baseline journey cannot be driven to green within this unit (state which legs are green and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
