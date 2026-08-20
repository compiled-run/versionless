Fable-Opus-Unit: lrapr-t023/u1-boundary-publish-refreeze
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: Publishing a declared unsupported-boundary cell and re-freezing the adapter are integrity-critical claims surfaces — a wrong boundary statement overclaims or underclaims support fleet-wide, and the freeze math + supersession chain must stay independently recomputable.

## Goal

Stages 1+2 of T023 (the T022 Judge ruling, notes/t022-boundary-ruling.md) in /Users/jacksm5pro/dev/open-source/versionless. NO candidate selection and NO new holdout work in this unit (stages 3+4 follow).

STAGE 1 — PUBLISH THE BOUNDARY:

- Record the pigallery2 1.7.0 RED as a permanent falsification entry in the corpus/holdout ledger surface, following EXACTLY the established pattern used for the React holdout's historical failed record (study how `evidence/runs/aggregate.json` `holdouts` + `packages/core/src/corpus/conformance.ts` carry the d9f75ef6-era React holdout FAIL — the T018/T021 RED gets the same immutable treatment; never weaken or reclassify it).
- Declare the support boundary as data the matrix surfaces render: "pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell", citing @yaga/leaflet-ng2, ng2-slim-loading-bar, jw-bootstrap-switch-ng2 at their six pigallery2 import sites as instance evidence. Put it where the conformance/support-matrix machinery will carry it into reports (find the established unsupported/limitations surface in packages/core/src/corpus/conformance.ts and the trust report; extend it the way it already models unsupported/unknown states — no new ad-hoc file if a surface exists).
- The boundary is a DECLARED limitation, with explicit non-certification language consistent with the repo's discipline.

STAGE 2 — RE-FREEZE:

- Recompute the composite fingerprint at HEAD over the five subtrees (packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis; SHA-256 over newline-terminated "<path> <tree-oid>" lines).
- Verify React oid == 972ca80155bbc2a6eb3779943cd481b71d35e803 (unchanged since 4df7bc96). The Angular oid has legitimately moved (T021 authorized reopen).
- Update `ADAPTER_FREEZE_COMPOSITE` / commit / subtree oids in packages/trust/src/freeze.ts and append the freeze-history supersession record (chain d9f75ef6 -> 5de7df56 -> 4df7bc96 -> NEW), citing the authorized T021 Angular reopen for the pigallery2 chase (12 generic capabilities; only the Angular subtree moved). buildAdapterFreezeRecord() must validate.
- Keep ALL 12 T021 capabilities single-app/experimental in the coverage surfaces (update the freeze's experimental list the way u1-of-T019 did).
- Regenerate trust render artifacts OFFLINE (`VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:generate --offline --policy trust/policy.json --output evidence/trust/current`) — never hand-edit report.md/manifest.json.
- `trust:verify --offline` must return valid:true, and the regenerated report must carry the new composite, the boundary declaration, and the pigallery2 RED entry.

## File contract

- `packages/trust/**`
- `packages/core/src/receipts/**`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/test/**`
- `evidence/trust/**`
- `evidence/runs/aggregate.json`
- `evidence/runs/holdout-angular-pigallery2/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- NO packages/frameworks/\*\* edits (the freeze is a claim the adapter stopped moving — you record it, you do not move it). No app-source edits. No candidate selection/scouting (stage 3). Never weaken/reclassify the pigallery2 RED or any existing receipt's behavioral content. No hand-edits to generator-owned render artifacts. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Offline except nothing — this unit needs no network. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-INTACT'
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
```

## Blocked permission

If the composite does not validate after your freeze edit (bring the numbers), the conformance surface cannot carry the boundary without inventing a new ad-hoc mechanism (bring the analysis), the pigallery2 RED cannot be ledgered without touching immutable receipts, or trust:verify fails after clean regeneration (bring the mismatch), return status "blocked" with specifics in open_questions instead of improvising.
