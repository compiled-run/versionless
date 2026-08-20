Fable-Opus-Unit: lrapr-t016/f2-refreeze-count
Fable-Opus-Timeout-Minutes: 40

## Goal

Record the re-freeze and flip counting to derived reactLineage 6/6 + angularLineage 4/4 in /Users/jacksm5pro/dev/open-source/versionless (commit `4875e09`; f1 verified the fingerprint 5de7df56 matches, frozen diff empty, re-freeze commit cce3417). NO capability-coverage map (that is f3).

PM rulings baked in (f1's blocker, resolved charter-grounded):

- **Next.js is React-lineage.** The charter's completion target is "six React-LINEAGE applications ... at least one legacy Next.js app." So `next-killedbygoogle-v3-0-0` is the legacy-Next member of React's six and COUNTS toward reactLineage 6/6 — reclassify it from `lineage:'next'` into the React-lineage numerator with a recorded reason (Next.js-on-React is React-lineage per the charter oracle). The oracle has exactly two lineages (React, Angular); retire the `olderNext 0/4` separate-numerator to an informational React sub-tag (recorded — never a silent gate change; olderNext was finer tracking, not an oracle lineage).
- **Denominator model**: add a `demoted` boolean to the lineage counting cells; `angular-realworld` is `demoted:true` (excluded from the Angular denominator with its applicationFilesChanged=0 reason intact); every other cell is in-denominator. Total = count of non-demoted cells per lineage → derives reactLineage 6/6 (boilerplate, papercups, hospitalrun, memos, killedbygoogle-v3, linkfree) and angularLineage 4/4 (factoriolab, jira-clone, tiny-translator, super-productivity). Numerators DERIVE, never hand-set.

Deliver:

1. **Re-freeze record** `evidence/trust/current/adapter-freeze.json`: composite `5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c` (recompute yourself, must match), superseding d9f75ef6 by reference (retain d9f75ef6 recorded/superseded with the T999 reopen reason). The five frozen subtree OIDs at commit cce3417.
2. **Counting flip**: `counted:true` in the judgeCounting ledger for react-memos-v0-1-3, next-killedbygoogle-v3-0-0, react-linkfree-v0-72-0, angular-tiny-translator-v0-12-0, angular-super-productivity-v2-13-15; the kbg-v3 lineage reclassification; the demoted-denominator model. Regenerate aggregate/conformance/trust; derived reactLineage 6/6, angularLineage 4/4. Every affected pin/test moves to the exact derived values; the retired olderNext scoreboard's tests updated to the informational sub-tag (recorded, not deleted-silently).
3. Whole repo gate green (`vp pack` before `trust:generate`).

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

- ZERO byte changes under the five frozen subtrees; numerators derive never hand-set; no witness-receipt behavioral content edited; the olderNext retirement is recorded as a reclassification, never a silent deletion; nothing loosened.
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

If the fingerprint does not match, the numerators do not derive to exactly 6/6 and 4/4 after the ruled reclassification, a panLike/sensitive-scan trip surfaces on regeneration, or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
