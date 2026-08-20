Fable-Opus-Unit: lrapr-t017b/g2e-migrated-lane-two-lane-determinism
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: This is the holdout's actual falsification test — running the migrated (product-adapter) Vite build through the same journey and proving normalized behavior parity with baseline plus pass-twice determinism; distinguishing a real migration break (RED evidence) from a benign per-lane build difference across many interactions is exactly the high-judgment work that must not be fudged.

## Goal

Close the cypress-realworld-app React holdout's browser-parity proof in /Users/jacksm5pro/dev/open-source/versionless. The BASELINE lane journey is already GREEN and calibrated (g2d: 51/51 legs, minted tx round-trips the personal feed, successfulNonLoopback=0, 11-endpoint measured backend category). This unit adds the MIGRATED lane and the determinism/parity proof. NO published witness receipt (the canonical evidence run + re-freeze + Judge re-bless are the follow-up phase).

Do all of the following:

1. FIX THE MIGRATED LANE ROOT. The calibrate driver (`packages/cli/src/fixture/react-cypress-rwa-calibrate-run.ts`) points `migrated` at `target/build-vite-run1`, which is an INCOMPLETE 6-file copy (no index.html, no assets). The COMPLETE migrated Vite build is `target/build-vite` (18 files, has index.html + assets). Repoint the migrated lane to `target/build-vite`. Confirm no other stale `build-vite-run*/rerun*/probe` root is referenced.
2. MIGRATED LANE GREEN. Run the SAME calibrated journey against the migrated Vite lane served with the same live Express/lowdb backend (Node 14.16.1 era cell, per-pass reseed). Correct only genuine per-lane presentation deltas the migrated DOM legitimately differs on (declare them as per-lane differences, kept OUT of the shared behavior digest). A real behavioral divergence (a leg that works on baseline but breaks on migrated, a different backend interaction, a console/page error the baseline did not have) is RED-first FALSIFICATION EVIDENCE — report it with the measurement; do NOT invent a pin or a per-lane exception to paper over a genuine migration break. The adapter is frozen; a break is a finding.
3. TWO-LANE PARITY. Both lanes must reach the SAME normalized behavior digest (routing, state, errors, console, failed requests, backend category, tracked-event outcomes). Per-lane declared differences stay declared and never enter the shared digest.
4. PASS-TWICE DETERMINISM (each lane). The money-movement mutates lowdb; with per-pass reseed-from-snapshot + the declared placeholder normalization ({created-user-id}, {created-transaction-id}, {created-account-id}, {recipient-handle}), pass-1 and pass-2 semanticDigest must be byte-identical on EACH lane. If they are not, bring the two digests and the diff — that is a real finding, not something to force.
5. LOCALITY + REDACTION (both lanes). successfulNonLoopback=0 (backend loopback + the declared mocked S3 avatar seams only, no real egress); no seed PII in any captured evidence.

PROVE IT via the in-contract driver across both lanes and two passes each; report per lane: legs ok/total, console/page/failed-request counts, the shared behavior digest (show they match across lanes), the pass-1==pass-2 digest equality, and the origin buckets. Add node-level determinism/parity protection tests (`packages/core/test/**` and/or `packages/cli/test/**`) so the guarantee is enforced by the gate.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-cypress-rwa.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-cypress-rwa/**`

## Forbidden moves

- No published/canonical witness receipt (follow-up phase). No packages/frameworks/** (adapter is FROZEN — a migrated break is RED evidence, never fixed here). No application-source hand edits. No packages/trust/**, evidence/ingests/**, evidence/runs/holdout-react-cypress-rwa/**, other evidence/runs/** dirs, scripts/**, docs/**, fixtures/** app source.
- No fabricated/guessed pins or invented per-lane exceptions to hide a real break — measure, and report genuine divergence as RED. Settled-reaction anchors never timing. No seed PII in evidence. Loopback backend + declared mocked S3 seams only. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any backend you spawn; leave nothing on 3001.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the migrated lane reveals a genuine behavior break vs baseline (bring the leg + measurement), the two lanes cannot reach the same normalized digest without hiding a real difference, pass-twice determinism fails on either lane (bring both digests), or the work exceeds this unit (say which of the 5 items are proven and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
