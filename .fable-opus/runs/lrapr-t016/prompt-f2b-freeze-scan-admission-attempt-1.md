Fable-Opus-Unit: lrapr-t016/f2b-freeze-scan-admission
Fable-Opus-Timeout-Minutes: 40

## Goal

Complete the re-freeze record and the counting flip in /Users/jacksm5pro/dev/open-source/versionless, resolving the panLike false-positive on the freeze commit SHA the RIGHT way (commit `4875e09`; f2 left its counting work in the working tree — build on it). The re-freeze commit is genuinely `cce34175340273919c0b70341dfada5533f0307c` (the last commit touching a frozen subtree, where the frozen adapter state was established); its SHA contains a 14-digit run that trips the panLike scan at `$.freeze.commit`.

PM RULING — resolve exactly like T004's HospitalRun revision, NOT by substituting a different commit:

- A git commit object-id is a FALSE POSITIVE, not a PAN. The tranche-one precedent is `isCorpusProvenanceRevisionObjectId` in `packages/core/src/policy/payment-signals.ts` (admits an exact 40-lowercase-hex object-id under a closed context; a bare 13-19 digit run still trips). **Extend that closed-list admission to the adapter-freeze commit context**: admit an exact-40-lowercase-hex-including-≥1-letter value under the freeze record's commit key (`$.freeze.commit`, and the `supersedes` commit key) in the `versionless.adapter-freeze.*` document shape. Nothing else loosens: a bare digit run still trips, a 40-hex under a non-freeze-commit key still trips, wrong case/length still trips. Add negative tests pinning ALL of these, plus the positive case (cce3417's exact SHA admitted under the freeze commit key; its embedded 14-digit run alone still trips).
- **FORBIDDEN**: do NOT change the recorded freeze commit away from `cce3417` to dodge the scanner (that would falsify which commit the freeze was computed at and tunnel around a security control). The record names the real commit; the scanner learns the git-object-id shape.

Deliver:

1. The payment-signals admission + negative/positive tests (per above).
2. Complete the re-freeze record `evidence/trust/current/adapter-freeze.json` via `packages/trust/src/freeze.ts`: composite `5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c` (recompute, must match), freeze commit `cce3417...`, the five subtree OIDs, superseding d9f75ef6 by reference (retained, recorded, with the T999 reopen reason).
3. Finalize f2's counting: derived reactLineage 6/6 (boilerplate, papercups, hospitalrun, memos, killedbygoogle-v3 with reactSubTag legacy-next, linkfree) + angularLineage 4/4 (factoriolab, jira-clone, tiny-translator, super-productivity; realworld demoted-excluded); olderNext retired to informational React sub-tag (recorded).
4. Regenerate aggregate/conformance/trust (vp pack before trust:generate — it now succeeds since the freeze record writes); whole repo gate green.

## File contract

- `packages/core/src/policy/payment-signals.ts`
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

- The payment-signals change is EXACTLY the closed-list git-object-id-under-freeze-commit-key admission — no broader detector change, no threshold move, no blanket allowance; bare digit runs and PANs still trip (negative-tested).
- Do NOT change the freeze commit away from cce3417 to evade the scanner. ZERO byte changes under the five frozen subtrees (packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis). Numerators derive never hand-set; no witness-receipt behavioral edits; nothing loosened.
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

If admitting the freeze-commit object-id cannot be done without loosening the detector for a real PAN (name the concrete case), the fingerprint does not match, or the numerators do not derive to 6/6 and 4/4, return status "blocked" with specifics in open_questions instead of improvising. Do NOT resolve by changing the freeze commit.
