Fable-Opus-Unit: lrapr-t006/u18c-fork-kind-wiring-attempt
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the two owed adapter items from u18b and re-attempt the super-productivity build in /Users/jacksm5pro/dev/open-source/versionless (commit `84240e7`; demand ledger at `evidence/runs/angular-super-productivity-v2-13-15/u18b-migrated-lane.json`; stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app` with the resolved closure installed).

This unit COMPLETES on exactly these four deliverables — a still-red build with the remaining demands itemized is a COMPLETED outcome (the mj2 precedent), not a partial:

1. **Implement the `successor-fork` EcosystemPackage kind** (u18b verified the provenance: `@danielmoncada/angular-datetime-picker` is GitHub-fork-verified from ng-pick-datetime's declared repo, peers fit, all three used symbols exported, same stylesheet path). The kind removes one package name, declares its successor at the registry-read range, records the provenance facts, and hands a generic specifier rename to the source pass and the tilde-stylesheet pass. Tests: positive on a synthetic fork pair; negatives (unverified lineage refuses; API-surface mismatch refuses).
2. **Wire `entry-components-removal` into `migrateAngularCliEraWorkspace`** (the capability exists, exported, tested — the era pipeline never calls it; that wiring gap answers 19 module literals here). Positive test that the composed migration now removes analyzer-proven-reachable entryComponents.
3. **Apply the updated changeset to the stage tree and re-attempt the production build.** Extend reusable capabilities for demands the attempt proves tractable within budget (the Material barrel split capability EXISTS from tiny-translator — it should fire here; ngrx setAll and formly to→props are analyzer-shaped renames if the surfaces prove out; rxjs/internal-compatibility rides the existing collapse if the installed surface maps it). Anything not tractable in budget: itemize exactly and stop cleanly.
4. **The u18c record** under `evidence/runs/angular-super-productivity-v2-13-15/`: what fired, what cleared, what remains (if anything), diagnostic counts before/after, truthful `applicationFilesChanged`. If green: build ×2 deterministic-modulo the recorded Sass-random files + logical-name parity per the standing ruling.

Tests per idiom; overfitting guard green; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented reads/installs (recorded). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If the fork kind cannot stay generic, the wiring breaks an existing cell's pinned behavior, or a demand's tractability is ambiguous inside the budget, return status "blocked" with specifics in open_questions instead of improvising — but remember: red-with-itemized-remainder is COMPLETED, not blocked.
