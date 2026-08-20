Fable-Opus-Unit: lrapr-t013/f1-counting-and-freeze
Fable-Opus-Timeout-Minutes: 35

## Goal

Publish the T007 Judge's counting-and-freeze transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change (Judge receipt on the board, task T007; commit `57b308a` is the freeze commit).

1. **Record the frozen adapter fingerprint** into `evidence/trust/current` (a dedicated record per the trust idiom): composite `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77` = SHA-256 over the newline-terminated ordered lines `"<path> <tree-oid>"` for exactly: `packages/frameworks/react ae219d37efe52b2aebd51d116108169a0456ad93`, `packages/frameworks/angular 46ed07a7ff95277dfd99e7cddb14bd8cf806719b`, `packages/core/src/migrations 5237ce5990af3623206bcd2301047a59c80731cf`, `packages/core/src/bundlers cec2f0b56fbb7897f38d579be805e19982380ca6`, `packages/core/src/analysis 262dc8b7528c92883c2300914eb7d42579fb856b` (each via `git rev-parse HEAD:<path>` at the freeze commit). RECOMPUTE it yourself first; if it does not match, that is blocked, not a value to correct. The freeze record states the registry surfaces (packages/core/src/receipts, packages/core/src/corpus, packages/cli/src/witness) are deliberately outside the freeze (additive holdout publishing).
2. **Flip counting**: `counted: true` for react-papercups-v1-0-0, react-hospitalrun, angular-factoriolab, angular-jira-clone (Judge acceptance reasons recorded per cell); **demote angular-realworld-v15-to-v16 from the angularLineage numerator** (applicationFilesChanged=0 version bump — reclassify its COUNTING, never rewrite/delete its witness receipt; keep the vertical visible with its honest non-counting reason). Regenerate aggregate/conformance/trust; the regenerated numerators must DERIVE to exactly reactLineage 3 (boilerplate + papercups + hospitalrun) and angularLineage 2 (factoriolab + jira-clone) — never hand-set. Move every affected pin to the exact measured values.
3. **Record the experimental/out-of-matrix capability list** (single-app proofs pending T006 second-app evidence): React connect-to-hooks, class-lifecycle-to-hooks, data-flow-connect-to-hooks, composed-migration; Angular custom-webpack-absorption, sentry-v8-migration, package-exports-style-imports, modal-content-params-migration, undeclared-runtime-dependency, tslint-toolchain-removal, ngrx-effects-migration. Cross-proven product: react-cra-vite-adapter; the Angular target-cell/workspace/source/cli-era spine. Record the Angular-holdout deferral (post-T006, mandatory license-text-at-pin pre-screen).
4. Update `docs/goals/legacy-react-angular-production-readiness/notes/t013-freeze-record.md` with the freeze record + counting rationale (board-side mirror of the trust record).
5. Whole repo gate green; nothing loosened; no behavioral digest, journey record, or mutation proof changes in any existing receipt.

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/receipts/**`
- `packages/core/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/trust/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`
- `docs/goals/legacy-react-angular-production-readiness/notes/t013-freeze-record.md`

## Forbidden moves

- ZERO byte changes under the five frozen subtrees (packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis).
- No rewriting/deleting the angular-realworld witness receipt; demotion is a counting reclassification with its reason recorded.
- Numerators derive, never hand-set; nothing loosened; no hand-edited evidence beyond the derived regeneration; no app names in reusable surfaces beyond closed lists.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77'
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If the recomputed fingerprint does not match, the numerators do not derive to exactly 3 and 2, the demotion would require touching the witness receipt's behavioral content, or a closed enumeration outside this contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
