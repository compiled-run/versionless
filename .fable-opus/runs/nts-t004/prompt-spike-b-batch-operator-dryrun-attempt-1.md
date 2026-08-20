Fable-Opus-Unit: nts-t004/spike-b-batch-operator-dryrun
Fable-Opus-Timeout-Minutes: 40

## Goal

SPIKE B (T003 Judge package) in /Users/jacksm5pro/dev/open-source/versionless: close the unmeasured-machine-time gap and prove the prune policy. The owner has ruled the per-app pipeline must become end-to-end automated; this spike's numbers price that work.

Do:

1. NEW FIXTURE DRIVER `packages/cli/src/fixture/fleet-batch-spike-run.ts` (strict TS; composes ONLY existing public operator flows — packages/cli/src/operator/\* is read-only; changing it is D3 execution, a stop condition): loop the EXISTING analyze + plan flows (and migrate into scratch lanes where a plan composes) over >=6 already-ingested corpus apps, mixed React/Angular (use apps whose corpus/work inputs exist locally — check .versionless availability first and pick accordingly). Time PURE MACHINE-TIME per stage per app (wall-clock per analyze/plan/migrate, no authoring time). Emit `evidence/spikes/fleet-batch-dryrun/fleet-summary.json` (per-app per-stage timings, outcomes, refusals) + a human rendering that is passed through `assertEnterpriseSurfaceHonesty` (bounded outcome strings verbatim if quoted; no blanket-support language).
2. PRUNE-SAFETY PROOF: for ONE receipted app, temporarily set aside its `.versionless/work/<app>` dir (move, not delete), run the offline receipt verify for that app's canonical receipt, restore the dir, and record the verdict (does offline verify pass from receipts alone?) in `evidence/spikes/fleet-batch-dryrun/prune-safety.json`. This decides the disk floor at N=300.
3. EXTRAPOLATION TABLE in the summary: measured machine-time per app -> N=300 projections (serial; and noting which stages are parallelizable vs witness-serialized per the determinism-under-load finding).

## File contract

- "packages/cli/src/fixture/fleet-batch-spike-run.ts"
- "packages/cli/test/\*\*"
- "evidence/spikes/fleet-batch-dryrun/\*\*"
- "docs/goals/next-tranche-strategy/\*\*"

## Forbidden moves

- No packages/cli/src/operator/\* changes (stop condition). No frozen-subtree edits (freeze recompute == 27741d9c before/after). No deletion — the prune proof MOVES and RESTORES. Offline (all inputs local). No enterprise-report/capability-coverage/matrix changes. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'node -e "const s=require(\"./evidence/spikes/fleet-batch-dryrun/fleet-summary.json\"); if(!s.apps||s.apps.length<6) throw new Error(\"fewer than 6 apps\"); console.log(\"apps:\", s.apps.length, \"prune:\", require(\"./evidence/spikes/fleet-batch-dryrun/prune-safety.json\").verdict)"'
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 27741d9c && echo FREEZE-INTACT'
```

## Blocked permission

If fewer than 6 apps have usable local inputs (name what exists), the prune proof fails (that IS a finding — record it, the verdict is "no"), a needed operator change blocks the loop (stop condition — name it), or verification fails twice, return status "blocked" with specifics in open_questions instead of improvising.
