Fable-Opus-Unit: lrapr-t019/u1-refreeze-rerun-publish
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: An integrity-critical adapter re-freeze (a claim about exact bytes) plus the canonical frozen-adapter holdout publish and independent verify — a wrong composite, a missed Angular-subtree drift, or a receipt that overstates the frozen fingerprint corrupts the goal's central provenance claim, so precision over the freeze math and the falsifiable re-run is the expensive part.

## Goal

Close the React holdout's FROZEN-adapter clause in /Users/jacksm5pro/dev/open-source/versionless. The T017b chase proved cypress-realworld-app GREEN under the REOPENED adapter (committed c695a58; two-lane parity + determinism, no app-name rescue), which added the generic `react-cra-process-global` capability inside `packages/frameworks/react` — so the current adapter no longer matches the declared freeze composite `5de7df56…`. Re-freeze at the new composite, re-run the holdout UNDER the frozen adapter, and publish the canonical passing receipt. Do NOT modify any frozen adapter subtree (the freeze means the adapter stopped moving).

Do all of the following:

1. RECOMPUTE + RE-FREEZE. The freeze composite is the SHA-256 of newline-terminated `<path> <tree-oid>` lines over exactly these five subtrees in order: `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, `packages/core/src/analysis` (each oid = `git rev-parse HEAD:<path>`). Recompute at current HEAD. Update the declared `FROZEN_COMPOSITE` in `packages/trust/src/freeze.ts` (currently `5de7df56…`) to the new value, and add a freeze-history supersession record in the same style the file already uses for the d9f75ef6→5de7df56 reopen: name that this supersession is the authorized `react-cra-process-global` capability reopen for cypress-realworld-app holdout carriage (the migrated Vite bundle threw `process is not defined`; a generic analyzer-driven process/browser-parity shim closed it). `buildAdapterFreezeRecord()` throws if the composite does not match its declared subtrees — it must match after your edit.
2. CONFIRM NO CROSS-LINEAGE DRIFT. The `packages/frameworks/angular` subtree oid MUST be unchanged versus the 5de7df56 freeze (the React reopen must not have touched Angular). Record the per-subtree oids. If the Angular oid changed, STOP (blocked) — that is unexpected coupling.
3. UPDATE THE EXPERIMENTAL LIST at the new freeze: `react-cra-process-global` is proven on exactly one application (cypress-realworld-app) → it belongs on the single-app/experimental list the freeze stands behind, NOT the product/cross-proven list. Update `evidence/trust/current/adapter-freeze.json` and any freeze-mirrored record accordingly.
4. RE-RUN UNDER THE FROZEN ADAPTER. Re-run the cypress-realworld-app holdout journey (both lanes, per-pass reseed, live loopback backend) using ONLY the now-frozen adapter — no reopen, no app-name/exact-source branch, no application-source edit. Confirm it STILL passes 51/51 both lanes with two-lane behavior-digest parity + pass-twice determinism + successfulNonLoopback=0. A re-run that needs any adapter or app change is a RED finding (blocked with the exact gap), NOT something to fix here.
5. PUBLISH THE CANONICAL RECEIPT to `evidence/runs/holdout-react-cypress-rwa/**`: the passing holdout witness receipt carrying `frozenAdapterFingerprint` = the NEW composite, the measured journey results, deterministic digest, locality, and non-certification language; then independently verify it from a clean process (`offline receipt:verify`). The receipt self-reports its own counting honestly.

Also flag (do NOT fix here): task T018's card pins `Fingerprint==5de7df56 before/after` — that expectation is now stale (the composite changed; the Angular subtree is what T018 actually depends on and is unchanged). Note this in open_questions so the PM updates T018.

## File contract

- `packages/trust/**`
- `packages/core/src/receipts/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/trust/**`
- `evidence/runs/holdout-react-cypress-rwa/**`
- `evidence/runs/react-cypress-rwa/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- NO changes under the five FROZEN subtrees: `packages/frameworks/react/**`, `packages/frameworks/angular/**`, `packages/core/src/migrations/**`, `packages/core/src/bundlers/**`, `packages/core/src/analysis/**`. Changing any of them breaks the freeze and defeats the unit — if the re-run needs such a change, that is a RED finding to report, never to make. No application-source hand edits. No app-name/exact-source branch. Do not mark `react-cra-process-global` cross-proven. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any backend you spawn; leave nothing on 3001.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If recomputing the composite does not match after your freeze edit (bring the numbers), the Angular subtree oid changed (unexpected coupling), the frozen-adapter re-run goes RED (name the exact leg/gap — a genuine falsification), or the canonical publish + offline receipt:verify cannot be completed in this unit (say what is done and where it dies), return status "blocked" with specifics in open_questions instead of improvising.
