Fable-Opus-Unit: lrapr-t017/h1-cypress-rwa-holdout-rerun
Fable-Opus-Timeout-Minutes: 40

## Goal

Re-run the React holdout cypress-realworld-app against the re-frozen adapters in /Users/jacksm5pro/dev/open-source/versionless and produce a falsifiable pass/fail receipt (T015 Judge spec; commit `8069c3b`; adapters re-frozen at `5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c`). This is the headline version-generality test: the tranche-one holdout (T008) FAILED on exactly one gap — non-UTF-8 module source decoding (faker's ISO-8859-1 locale) — and that generic capability now exists. Does the unseen app now migrate?

Context: ingest at `evidence/ingests/react-cypress-rwa/` (v1.0.18 = f6b5cf3a, react-scripts 4/webpack 4 CRA, MIT-at-pin, local passport-session mode, in-repo Express+lowdb loopback API, baseline green Node 14.16.1). The tranche-one FAIL receipt is at `evidence/runs/holdout-react-cypress-rwa/receipt.json` (the u19d/hx-series canonical FAIL). Caches at `.versionless/cache/react-cypress-rwa-*` (recover from `.claude/worktrees/agent-a16623627e8032fda` if missing).

FREEZE DISCIPLINE (absolute — this is a falsification run): recompute the composite fingerprint FIRST; it must equal `5de7df56…`; the five frozen subtrees must not change by one byte before OR after. The frozen adapters are applied AS IS. If the app hits something the frozen adapters can't handle, that is THE FINDING — record it red, do NOT edit product code. A harness fix may not branch on holdout app identity/revision/exact source.

Deliver:

1. Era baseline lane: rebuild ×2 byte-stable from the restored cache (Node 14.16.1 declared cell, its own build:ci path).
2. Migrated lane: apply the frozen CRA→Vite adapter composition (the non-UTF-8 decoding capability is now in it) to the pinned tree; install the Vite target closure (consented VL-LEGACY-CORPUS-2026-08-10, recorded); production build ×2. The tranche-one blocker (faker ISO-8859-1) should now be handled by the frozen capability — verify the build reaches further. If GREEN: witness journeys (substantive interactions on the real loopback API — sign-in, a banking-app transaction flow, etc.), mutation red → byte-identical restore → green, per-app production-readiness gate; a PASSING holdout is the strongest generality evidence. If RED on a NEW gap: itemize it exactly (that is still a valuable falsification result — the tool names the gap to the byte).
3. Publish/update the holdout receipt at `evidence/runs/holdout-react-cypress-rwa/` (supersede the tranche-one FAIL by reference — the FAIL record stays immutable; the re-run is a new dated record with the outcome, the fingerprint it ran against, and the adapterBytesChanged:0 attestation). The corpus holdouts ledger reflects the re-run outcome (still never counted in a lineage numerator).
4. Whole repo gate green; frozen fingerprint 5de7df56 intact before and after.

## File contract

- `fixtures/**`
- `evidence/runs/holdout-react-cypress-rwa/**`
- `evidence/runs/react-cypress-rwa/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/holdout-react-cypress-rwa.ts`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/trust/**`
- `evidence/trust/current/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- ZERO byte changes under the five frozen subtrees (packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis); a harness fix branching on holdout identity/revision/exact source; the tranche-one FAIL receipt is immutable (supersede by reference).
- No fabricated evidence; a RED result is recorded truthfully, never patched. Network only for the consented target-closure install. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do printf "%s %s\n" "$p" "$(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c'
sh -c '[ -z "$(git diff --name-only -- packages/frameworks packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis)" ]'
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/holdout-react-cypress-rwa/'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the migrated build hits a NEW gap the frozen adapters cannot handle (bring the exact demand — that is a completed falsification result, publish it as a RED holdout receipt, not a block), the fingerprint does not match, or evidence cannot distinguish a real app failure from a harness/environment failure after two reproducible attempts, return status "blocked" with specifics in open_questions instead of improvising. A RED holdout is a COMPLETED outcome, not a block.
