Fable-Opus-Unit: lrapr-t017b/g2a-live-backend-harness
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: First live-backend stateful vertical in the witness harness — the serving/determinism/locality model is new generic infrastructure that every future stateful app inherits; wrong invariants corrupt the pass-twice-identical guarantee the whole corpus relies on.

## Goal

Extend the witness harness with a GENERIC live-backend serving path, and land the cypress-realworld-app schema + AppSpec journey in /Users/jacksm5pro/dev/open-source/versionless (g2's architectural findings; commit `33092a7`, migrated build green 7051b848). NO full evidence runs / no publish (runner+publish is Unit B). The infrastructure must be generic (any future stateful app inherits it), never cypress-rwa-specific branches.

PM rulings (from g2's four questions):

1. **Live-backend serving**: extend the witness host so an AppSpec can declare a `backend` (the app's own server command + port), served on a second 127.0.0.1 loopback origin alongside the SPA static origin. This is the app's REAL backend (Express+lowdb here), never an in-context stub. Add a `loopback-backend` request category to the locality model: requests to 127.0.0.1:<backend-port> are loopback (allowed, counted separately), `successfulNonLoopback` stays 0, and any NON-loopback request still hard-fails. Generic: the AppSpec provides the command/port/health-check; the harness knows nothing app-specific.
2. **Determinism vs mutating state**: before each pass, re-seed the backend from its seed snapshot (the AppSpec declares the seed source + reset mechanism); and normalize minted ids/timestamps in the journey evidence to placeholders (the HospitalRun `{created-patient-id}` idiom — extend it generically: the journey declares which captured values are minted/nondeterministic and get placeholdered) so pass-1 and pass-2 produce identical semanticDigests.
3. **byteIdentical scope**: the static-inventory / byteIdentical invariant applies to the FRONTEND SPA dist bytes only; live backend state is explicitly outside the byte inventory. Add a schema field recording `backend: 'live-loopback'` with the served-static invariant scoped to the SPA tree, so the parser no longer requires a byte-identical backend.
4. **Schema + AppSpec** (no runs): `packages/core/src/receipts/witness-react-cypress-rwa.ts` per idiom with the live-backend fields; the `cypress-realworld-app` AppSpec + journey in `real-app-run.ts` (sign-in, money-movement, feed/filter, one more substantive interaction — the app's own Cypress specs are the journey map; wire the gestures and the placeholder-normalization declarations), declaring the backend + seed-reset; barrel export; banking-fixture redaction (NO seed usernames/passwords/PII — test-enforced). You MAY drive the browser to calibrate selectors/journey facts but publish NO evidence receipts.

Deliver the generic harness path + schema + calibrated journey; tests per idiom (the live-backend path's determinism-under-reseed, the loopback-backend category, the placeholder normalization, redaction); whole repo gate green. The existing 14 static apps must be provably untouched (backend defaults to none; their served-static byteIdentical invariant unchanged — regression proof: full suite green).

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/**`

## Forbidden moves

- No packages/frameworks/** (the adapter is green); no application-source hand edits; no packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- The live-backend path is generic (AppSpec-driven, no app-name branches); the existing static apps' invariants stay intact (additive); a live backend is the app's REAL server, never a stub; no seed PII in evidence (test-enforced); no fabricated evidence. Network: loopback only (the app's own backend). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the live-backend serving path cannot be made generic without an app-name branch (name it), the re-seed/placeholder determinism cannot make pass-twice identical (bring the measurement), a static app's invariant would have to change (name it — additive only), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
