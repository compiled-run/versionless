Fable-Opus-Unit: lrapr-t017b/g2g-two-lane-parity-determinism
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: The holdout's decisive falsification proof — full migrated-lane journey plus normalized two-lane behavior-digest parity plus pass-twice determinism, where distinguishing a real migration divergence (RED) from a legitimately-declared per-lane presentation delta across 51 stateful legs is exactly the high-judgment call that must not be fudged.

## Goal

Close the cypress-realworld-app React holdout's browser-parity proof in /Users/jacksm5pro/dev/open-source/versionless. The migrated Vite lane now BOOTS (g2f added the CRA process-global parity capability; it renders, reaches and fills the signup form). This unit drives the FULL journey on the migrated lane and proves two-lane parity + pass-twice determinism. NO published/canonical witness receipt (the re-freeze + Judge re-bless + publish are the follow-up phase).

Prove ALL of the following, measured, via the in-contract calibrate driver:

1. MIGRATED LANE FULL GREEN. Run the complete calibrated journey (signup → signin → onboarding bank-account/graphql → settings write → money-movement to the placeholdered peer, minted tx round-trips the personal feed → public/contacts/personal feed filter → notifications) against the migrated lane (`target/build-vite`, the shim-carrying build) served with the live Express/lowdb backend (Node 14.16.1 era cell, per-pass reseed). All legs `ok`, clean page (0 console errors, 0 page errors, 0 failed requests), successfulNonLoopback=0. Correct only genuine per-lane PRESENTATION deltas the migrated DOM legitimately differs on, declared as per-lane differences kept OUT of the shared digest. A real BEHAVIORAL divergence (a leg that works on baseline but breaks on migrated, a different backend interaction, a console/page error baseline lacks) is RED-FIRST FALSIFICATION EVIDENCE — report it with the measurement; do NOT invent a pin/exception to paper over a genuine break, and do NOT touch the frozen adapter (a break is a finding).
2. TWO-LANE PARITY. Baseline and migrated reach the SAME normalized behavior digest (routing, state, errors, console, failed requests, backend category, tracked-event outcomes). Per-lane declared differences never enter the shared digest.
3. PASS-TWICE DETERMINISM (each lane). With per-pass reseed + the declared placeholder normalization, pass-1 and pass-2 semanticDigest are byte-identical on EACH lane. If not, bring both digests and the diff.
4. LOCALITY + REDACTION (both lanes). successfulNonLoopback=0 (loopback backend + declared mocked S3 seams only); no seed PII in any captured evidence.

Report per lane: legs ok/total, console/page/failed-request counts, the shared behavior digest (show baseline==migrated), pass-1==pass-2 digest equality, origin buckets. Add node-level parity/determinism protection tests so the guarantee is gate-enforced.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-cypress-rwa/**`

## Forbidden moves

- No published/canonical witness receipt (follow-up phase). No packages/frameworks/** (adapter FROZEN — a migrated break is RED evidence, never fixed here; if a leg needs a further adapter capability, that is a named RED blocker for a separate authorized reopen, not a change here). No application-source hand edits. No packages/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/**, other evidence/runs/** dirs, scripts/**, docs/**, fixtures/** app source.
- No fabricated/guessed pins or invented per-lane exceptions to hide a real divergence — measure, and report genuine divergence as RED. Settled-reaction anchors never timing. No seed PII in evidence. Loopback backend + declared mocked S3 seams only. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any backend you spawn; leave nothing on 3001.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the migrated lane reveals a genuine behavior break vs baseline (bring the leg + measurement — likely a further named adapter gap needing a separate authorized reopen), the two lanes cannot reach one normalized digest without hiding a real difference, pass-twice determinism fails on either lane (bring both digests), or the work exceeds this unit (say which of items 1-4 are proven and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
