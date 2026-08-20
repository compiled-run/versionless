Fable-Opus-Unit: lrapr-t017b/g2b-holdout-journey-calibrate
Fable-Opus-Timeout-Minutes: 40

## Goal

Drive the cypress-realworld-app holdout journey to GREEN on both lanes against the live Express+lowdb backend in /Users/jacksm5pro/dev/open-source/versionless (commit `d7ebff6`: the generic live-backend path + schema + AppSpec journey are landed but the selectors/facts are declared from the app's own Cypress specs, NOT yet live-calibrated). NO publish (Unit C is runner+publish). This unit makes the asserting journey PASS end-to-end on both lanes with every pin measured against the live app+backend.

Lanes: baseline CRA build + migrated Vite build (7051b848), both served with the real Express+lowdb backend on a second loopback port (the g2a live-backend path). Journey: sign-up/sign-in as a non-seed actor → onboarding/settings write → money-movement to a placeholdered peer (the bank-shaped headline — assert the transaction appears in the feed and balances/notifications settle) → feed filter (public/contacts/personal) → notifications. Settled-reaction anchors, never timing. The per-pass reseed + placeholder normalization must make pass-twice semanticDigest identical on each lane.

Method (the u19/u20 discipline — measure before pinning, record each correction):

1. Run the asserting journey against the baseline lane; correct every selector/count/route/placeholder pin the live DOM+backend contradicts (recorded per mw1e). The money-movement flow mutates lowdb — confirm the reseed makes pass-1==pass-2 and the minted tx id/timestamp are placeholdered so both passes agree.
2. Run against the migrated lane; both lanes must reach the same behavior digest (per-lane declared differences stay declared, never in the shared digest). A real migration break is RED evidence first (this holdout is the falsification test — a genuine break is a finding, not a pin to fudge).
3. Confirm: zero successful NON-loopback (backend loopback requests counted in the loopback-backend category); the banking-fixture redaction holds (no seed PII in any captured evidence). Update the journey/schema pins to measured reality; whole repo gate green. NO published witness receipt (Unit C).

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-cypress-rwa/**`
- `fixtures/**`

## Forbidden moves

- No packages/frameworks/** (adapter green — a break is a finding); no application-source hand edits; no packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No published witness receipt (Unit C); settled anchors never timing; no fabricated/guessed values (measure both lanes); no seed PII in evidence; truthful reds. Loopback backend only. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-cypress-rwa'
```

## Blocked permission

If a journey leg reveals a real migration break on either lane (RED first with the measurement), the reseed/placeholder cannot make pass-twice identical (bring the digests), the money-movement flow cannot settle deterministically, or the work exceeds this unit (state which legs are green and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
