Fable-Opus-Unit: lrapr-t016/f1-refreeze-count-capmap
Fable-Opus-Timeout-Minutes: 35

## Goal

Record the re-freeze, flip counting to 6/6 + 4/4, and produce the capability-coverage map in /Users/jacksm5pro/dev/open-source/versionless (T015 Judge worker_package; commit `1830809`). This is the counting-and-freeze publish; the fingerprint is PM-recomputed and confirmed.

1. **Record the re-freeze** in `evidence/trust/current/adapter-freeze.json`: the new composite `5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c` = SHA-256 over newline-terminated `"<path> <tree-oid>"` lines in order: `packages/frameworks/react 9b2af393179749a4093f46e587e7f4fd9ce09b47`, `packages/frameworks/angular ca3824d0595d1fa88d37feda6b1785dfd79e72c4`, `packages/core/src/migrations 5237ce5990af3623206bcd2301047a59c80731cf`, `packages/core/src/bundlers cec2f0b56fbb7897f38d579be805e19982380ca6`, `packages/core/src/analysis 262dc8b7528c92883c2300914eb7d42579fb856b`. RECOMPUTE it yourself first (must match). Supersede d9f75ef6 by reference (retain it as recorded/superseded with the T999 reopen reason: the tranche-one freeze was falsified for CRA holdout carriage and legitimately reopened; the re-freeze is the enlarged adapter surface).
2. **Flip counting**: `counted: true` for react-memos-v0-1-3, next-killedbygoogle-v3-0-0, react-linkfree-v0-72-0, angular-tiny-translator-v0-12-0, angular-super-productivity-v2-13-15 (in the judgeCounting ledger, per the T013 precedent — the witness receipts keep their own counted:false; the Judge acceptance is the separate counting layer). Regenerate aggregate/conformance/trust; the DERIVED numerators must be exactly reactLineage 6/6 and angularLineage 4/4 (never hand-set; angular-realworld stays out of the numerator with its demotion reason intact).
3. **Capability-coverage map** — the load-bearing pitch artifact — as a new evidence record (e.g. `evidence/trust/current/capability-coverage.json` + a rendered section in the trust report): grep every exported symbol in `packages/frameworks/react/src` and `packages/frameworks/angular/src`, and map each to its proving applications (read the witness/migration records — which apps' migrations actually exercised each capability). Mark every capability with **<2 independent-application proofs as experimental/out-of-matrix**; only >=2 independent apps counts as cross-proven in-matrix. This is the version-generality evidence: generic capabilities cross-proven across independent apps, with the honest boundary drawn. The Judge flagged Angular exports at 41 vs 4 apps — expect many to be single-app experimental; that honesty is the point.
4. Whole repo gate green; the T016 verify block (fingerprint match, empty frozen-subtree diff, derived 6/6+4/4, the map).

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/receipts/**`
- `packages/core/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/trust/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- ZERO byte changes under the five frozen subtrees (packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis).
- Numerators derive, never hand-set; no <2-proof capability placed in-matrix cross-proven; no witness-receipt behavioral content edited; nothing loosened.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do printf "%s %s\n" "$p" "$(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c'
sh -c '[ -z "$(git diff --name-only -- packages/frameworks packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis)" ]'
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If the recomputed fingerprint does not match, the numerators do not derive to exactly 6/6 and 4/4, a capability's independent-app proof count is ambiguous (record the ambiguity, default to experimental), or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
