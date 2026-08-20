Fable-Opus-Unit: lrapr-t019/u2-trust-render-regen
Fable-Opus-Timeout-Minutes: 25

## Goal

Restore trust-gate consistency after the T019 re-freeze in /Users/jacksm5pro/dev/open-source/versionless. (The prior attempt did the regeneration correctly but the unit's verify command was mis-specified — it omitted the required offline flag; trust verification requires offline mode. This attempt uses the corrected verify. The regenerated artifacts from the prior attempt are already on disk; confirm/reproduce them and pass the corrected gate.)

u1 updated the adapter freeze to composite `4df7bc96…` (`packages/trust/src/freeze.ts` + `evidence/trust/current/adapter-freeze.json`) and published the canonical React holdout receipt, but the generator-owned trust render artifacts (`report.md`, `manifest.json`) reflect the OLD `5de7df56…` freeze until regenerated.

Do exactly this and nothing more:

1. Run the project's trust generator OFFLINE to regenerate ALL trust render artifacts from source. Use the exact offline invocation the repo uses — `VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:generate --offline --policy trust/policy.json --output evidence/trust/current`. Do NOT hand-edit rendered artifacts.
2. Confirm `VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline` returns `valid:true`.
3. Confirm the regenerated artifacts reflect: freeze composite `4df7bc96` (commit `c695a586`), `react-cra-process-global` as single-app/experimental (NOT cross-proven), and the published passing frozen-adapter holdout receipt (`evidence/runs/holdout-react-cypress-rwa/green-2026-08-13`, `holdoutOutcome: passed`, composite `4df7bc96`) consistent. The holdout LEDGER keeping its immutable historical failed record (derived from aggregate.json, required by verify.ts) is BY DESIGN, not a desync — leave it.

## File contract

- `evidence/trust/**`

## Forbidden moves

- No changes under any frozen subtree (`packages/frameworks/**`, `packages/core/src/migrations/**`, `packages/core/src/bundlers/**`, `packages/core/src/analysis/**`). No source/code changes — `evidence/trust/**` only. No hand-editing rendered artifacts (regenerate them). No aggregate.json / witness-receipt behavioral changes. Do not commit or stage. Strict offline (no non-loopback network).

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
```

## Blocked permission

If `trust:generate` reverts the composite to `5de7df56` (freeze.ts is not its source of truth), `trust:verify --offline` still fails after a clean regenerate (bring the exact mismatch), or regenerating requires touching anything outside `evidence/trust/**`, return status "blocked" with specifics in open_questions instead of improvising.

## Previous attempt failed

verify failed: node --experimental-strip-types packages/cli/src/cli.ts trust:verify (exit 1)

Output tail:
Error: Trust verification requires VERSIONLESS_NETWORK_MODE=offline
at verifyTrustPackage (file:///Users/jacksm5pro/dev/open-source/versionless/packages/trust/src/verify.ts:146:9)
at file:///Users/jacksm5pro/dev/open-source/versionless/packages/cli/src/cli.ts:363:11
at ModuleJob.run (node:internal/modules/esm/module_job:437:25)
at async node:internal/modules/esm/loader:639:26
at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Fix the problem and complete the task.
