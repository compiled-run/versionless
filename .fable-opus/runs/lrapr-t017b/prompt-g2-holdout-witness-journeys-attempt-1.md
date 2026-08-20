Fable-Opus-Unit: lrapr-t017b/g2-holdout-witness-journeys
Fable-Opus-Timeout-Minutes: 40

## Goal

Browser-prove the React holdout cypress-realworld-app to a true PASS in /Users/jacksm5pro/dev/open-source/versionless (owner-directed chase-to-green; commit `33092a7`: the migrated build is GREEN at 7051b848, all gaps closed generically). The adapter is in its authorized reopen (no frozen fence this unit). A PASSING holdout needs substantive browser journeys on the real loopback backend, not just a green build.

Context: cypress-realworld-app is a banking/transactions app with an in-repo Express + lowdb loopback API and passport-local session auth (local mode, no external auth). Era baseline = CRA build (Node 14.16.1, dist digest 57cea249); migrated = the green Vite build (7051b848). The app's own Cypress specs name the real journeys (sign-in, new-transaction/payment flow, transaction feed, notifications) — use them as the journey map, drive them through the witness host against the app's own loopback API (both lanes serve the real Express+lowdb backend on loopback — this is a genuine backend, not a stub).

Deliver:

1. cypress-realworld-app in `WITNESS_REAL_APP_NAMES` if not already (framework 'react'); the holdout journey in `real-app-run.ts` + a dedicated runner per the established idiom. Journeys (both lanes, real backend): (a) sign-in via the app's own form (passport session); (b) a **money-movement flow** — new payment/transaction to another user, assert the transaction appears in the feed and balances/notification update (this is the bank-shaped journey — assert settled state, real typing/click, never timing); (c) the transaction feed with filter/search; (d) a second substantive interaction the specs name (e.g. like/comment on a transaction, or notifications). Real gestures; measured scroll where the feed overflows; per-lane exact inventories.
2. Baseline 2/2 + migrated 2/2 through local link:../witness; zero successful non-loopback (the loopback API is allowed — it IS the app's backend on 127.0.0.1; assert zero NON-loopback); semantic byte-mutation on the migrated bundle (visible string → journey red → byte-identical restore → green).
3. Core schema `packages/core/src/receipts/witness-react-cypress-rwa.ts` per idiom (or extend the holdout receipt shape), barrel-exported; canonical witness artifacts under `evidence/runs/react-cypress-rwa/`; redacted (NO seed usernames/passwords/PII — this is a banking app fixture; assert the redaction), unknowns preserved.
4. Tests per idiom; whole repo gate green. Do NOT re-freeze or publish the PASSING holdout receipt yet (the re-freeze + holdout-receipt supersede is the next unit) — this unit delivers the green witness journeys + artifacts.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-cypress-rwa/**`
- `fixtures/**`

## Forbidden moves

- No packages/frameworks/** changes (the adapter is green — a journey needing an adapter change is a finding, not an edit); no application-source hand edits; no packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/** (receipt supersede is next unit), other evidence/runs/** dirs, scripts/**, docs/**.
- No seed PII/credentials in evidence (banking fixture — redact, test-enforced); no fabricated evidence; truthful reds; a real behavioral break across the migration is RED evidence first. Loopback backend allowed; zero successful NON-loopback. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-cypress-rwa'
```

## Blocked permission

If a journey reveals a real migration break (RED first with the measurement), the loopback backend cannot be driven deterministically, a journey genuinely needs a frozen-adapter change (name it), or the work exceeds this unit (cut: schema+journey / runner+publish-artifacts), return status "blocked" with specifics in open_questions instead of improvising.
