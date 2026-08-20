Fable-Opus-Unit: lrapr-t008/hx3-holdout-fail-receipt
Fable-Opus-Timeout-Minutes: 35

## Goal

Publish the canonical holdout falsification receipt in /Users/jacksm5pro/dev/open-source/versionless — T008's falsifiable pass/fail deliverable, and the outcome is FAIL, recorded with the same rigor a pass would get. Commit `bc1755b` landed the run evidence (`evidence/runs/react-cypress-rwa/build-profile.json`, `t008-run.md`): baseline lane green byte-stable ×2 in the declared Node 14.16.1 cell; migrated lane RED identically ×2 — the frozen CRA adapter (fingerprint `d9f75ef6…`, recomputed intact) stops on faker 5.5.3's ISO-8859-1 Italian locale (six invalid UTF-8 bytes, reached from production code via `src/utils/transactionUtils.ts` → faker's eager locale index) because rolldown requires valid UTF-8 where webpack 4 decoded leniently. Missing generic capability: non-UTF-8 module source decoding. Zero adapter bytes changed; zero app source hand-edits.

Deliver:

1. Core receipt schema `packages/core/src/receipts/holdout-react-cypress-rwa.ts` per the repo's receipt idiom but shaped for a HOLDOUT FALSIFICATION outcome (not a witness receipt — no journeys ran): pinned source identity, the frozen adapter fingerprint it ran against, both lanes' outcomes with digests, the exact missing-capability finding (file, byte offsets, encoding facts), the two-attempt identity proof, zero-adapter-influence attestation, non-claims (no browser evidence; the pass-proves-less clean-target caveat carried), `holdoutOutcome: 'failed'` with the capability gap as the recorded reason. Parser/renderer/verifier per idiom, barrel-exported.
2. Canonical receipt at `evidence/runs/holdout-react-cypress-rwa/receipt.{json,md}`, redacted, self-limiting, derived from the committed run evidence.
3. Conformance/trust recording: the holdout attempt appears in the corpus as an explicit `holdouts` record — attempted, failed, reason, fingerprint, NEVER counted in any lineage numerator and never hidden (the declined-RealWorld visibility precedent). Regenerate aggregate/conformance/trust with measured counts; numerators must stay exactly reactLineage 3 / angularLineage 2; the trust report carries the holdout result and the missing-capability finding for the follow-on tranche.
4. Tests per idiom (schema round-trip; conformance holdout record positive; numerator-unchanged pins); whole repo gate green; freeze fingerprint intact.

## File contract

- `packages/core/src/receipts/holdout-react-cypress-rwa.ts`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/trust/**`
- `evidence/runs/aggregate.json`
- `evidence/runs/holdout-react-cypress-rwa/**`
- `evidence/trust/current/**`

## Forbidden moves

- ZERO byte changes under the five frozen subtrees; no packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The holdout NEVER enters a lineage numerator; no behavioral claims beyond what the committed run evidence measured; no fabricated evidence; nothing loosened.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77'
sh -c '[ -z "$(git diff --name-only -- packages/frameworks packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis)" ]'
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
sh -c 'ls evidence/runs/holdout-react-cypress-rwa/receipt.json evidence/runs/holdout-react-cypress-rwa/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If the holdout record cannot stay out of the numerators without loosening, a closed enumeration outside the contract surfaces, or the committed run evidence is insufficient for a canonical receipt claim, return status "blocked" with specifics in open_questions instead of improvising.
