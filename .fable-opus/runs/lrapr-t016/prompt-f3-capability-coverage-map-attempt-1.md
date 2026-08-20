Fable-Opus-Unit: lrapr-t016/f3-capability-coverage-map
Fable-Opus-Timeout-Minutes: 40

## Goal

Produce the capability-coverage map in /Users/jacksm5pro/dev/open-source/versionless — the load-bearing version-generality artifact for the bank pitch (T015 Judge required deliverable; commit `c89e43a`, matrix re-frozen 5de7df56 at React 6/6 + Angular 4/4). This is the evidence that the migration capabilities are GENERIC — cross-proven across independent applications — with the honest boundary drawn (single-app capabilities are experimental/out-of-matrix, not silently claimed general).

1. **Enumerate every exported capability** in `packages/frameworks/react/src` and `packages/frameworks/angular/src` (grep the index barrels + each module's exports; the Judge counted 7 React modules + 41 Angular modules). For each exported capability, determine its **proving applications** by reading the migration/witness evidence and the capability's own tests: which independent apps' migrations actually exercised it (e.g. the CRA→Vite adapter fired on papercups + hospitalrun + linkfree; the ngrx createEffect migration on factoriolab + super-productivity; the barrel-split on tiny-translator + super-productivity; the template-binding-reorder on super-productivity only; etc.). Ground each mapping in evidence, not assumption — where a capability's app-usage isn't determinable from records, mark it `unproven-coverage` and default to experimental.
2. **Classify** each: `cross-proven` (>=2 independent applications) = in-matrix; `experimental` (<2, i.e. single-app or unproven) = out-of-matrix. This is the honest generality claim: a capability is only claimed general once >=2 independent apps prove it. The Judge flagged Angular's 41 exports vs 4 apps — expect many single-app experimentals; that honesty IS the artifact's value for a regulated buyer.
3. **Publish** the map as a machine-readable evidence record `evidence/trust/current/capability-coverage.json` (each capability: name, package, proving apps list, proof count, classification, evidence pointers) + a rendered human-readable section in the trust report (`packages/trust/src/render.ts` + regenerate). A verify function that recomputes classification from the proof counts (no hand-set classifications; cross-proven requires the listed apps to actually differ). Tests: the map derives, a <2 capability cannot be cross-proven, the counts match the listed apps.
4. Whole repo gate green; frozen fingerprint 5de7df56 intact (this unit touches no frozen subtree — it only reads them and writes evidence/trust + the report renderer).

## File contract

- `packages/core/src/receipts/**`
- `packages/core/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/trust/**`
- `evidence/trust/current/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- ZERO changes under the five frozen subtrees (read-only for the capability enumeration); no packages/core/src changes outside receipts (the enumeration reads packages/frameworks, does not edit it); no packages/cli/src/witness/**, aggregate.json behavioral edits, evidence/ingests/**, other evidence/runs/** dirs, scripts/**.
- No hand-set classifications (derive from proof counts); no capability claimed cross-proven without >=2 genuinely-independent apps; no fabricated coverage; unproven coverage defaults to experimental, recorded.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do printf "%s %s\n" "$p" "$(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c'
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
sh -c 'ls evidence/trust/current/capability-coverage.json'
```

## Blocked permission

If a capability's proving-app set genuinely cannot be determined from the evidence (list which, default them experimental and say so), the enumeration exceeds one unit (state how far you got), or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
