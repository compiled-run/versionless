Fable-Opus-Unit: lrapr-t017b/g2b-holdout-journey-calibrate
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: Stateful multi-leg browser journey calibration against a live era-runtime backend on two build lanes, with pass-twice semantic-digest determinism, locality, and redaction all asserted — a wrong pin silently fudges the holdout falsification test, so measurement discipline over many DOM/backend interactions is the expensive part.

## Goal

Drive the cypress-realworld-app holdout journey to GREEN on both lanes against the live Express+lowdb backend in /Users/jacksm5pro/dev/open-source/versionless (commit `d7ebff6`: the generic live-backend path + schema + AppSpec journey are landed but the selectors/facts are declared from the app's own Cypress specs, NOT yet live-calibrated). NO publish (Unit C is runner+publish). This unit makes the asserting journey PASS end-to-end on both lanes with every pin measured against the live app+backend.

RESUME NOTE: A prior attempt of this same unit was orphaned by an external session limit AFTER it had (a) confirmed the era backend boots healthy on loopback 3001 (checkAuth -> 401) in the app's own Node 14.16.1 runtime cell with reseed-from-snapshot, (b) discovered the @async/witness PageHandle API surface, and (c) written a 399-line calibration DRIVER at `packages/cli/src/fixture/react-cypress-rwa-calibrate-run.ts` that boots+reseeds the real backend and drives one built lane through the host, printing every measurement (ordered steps + refusals, recorded navigations, request outcomes bucketed by origin, tracked-event counts). That driver is already on disk (untracked). START by reading and RUNNING it against the baseline lane rather than rebuilding the harness — then use its printed measurements to calibrate. If the driver needs fixing to run, fix it (it is in-contract), but do not discard the measurement-first approach.

Lanes: baseline CRA build + migrated Vite build (7051b848), both served with the real Express+lowdb backend on a second loopback port (the g2a live-backend path). Journey: sign-up/sign-in as a non-seed actor -> onboarding/settings write -> money-movement to a placeholdered peer (the bank-shaped headline — assert the transaction appears in the feed and balances/notifications settle) -> feed filter (public/contacts/personal) -> notifications. Settled-reaction anchors, never timing. The per-pass reseed + placeholder normalization must make pass-twice semanticDigest identical on each lane.

Method (the u19/u20 discipline — measure before pinning, record each correction):

1. Run the asserting journey against the baseline lane; correct every selector/count/route/placeholder pin the live DOM+backend contradicts. The money-movement flow mutates lowdb — confirm the reseed makes pass-1==pass-2 and the minted tx id/timestamp are placeholdered so both passes agree.
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

## Previous attempt failed

The previous attempt was stopped by the cockpit before it finished: Prior session hit the weekly usage limit mid-unit; g2b worker was orphaned after booting the live backend and writing the 399-line calibrate driver but before running calibration or returning a receipt. Recording kill to clear the dangling live-unit state so g2b can be re-dispatched fresh.
No receipt was validated and no verify command ran for that attempt. Work in smaller steps and report honestly.
Fix the problem and complete the task.
