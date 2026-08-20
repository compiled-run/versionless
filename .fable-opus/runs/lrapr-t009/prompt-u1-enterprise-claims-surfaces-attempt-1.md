Fable-Opus-Unit: lrapr-t009/u1-enterprise-claims-surfaces
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: The pitch-grade matrix and claims one-pager are the adoption decision's primary artifacts — every sentence must derive from a canonical receipt with the exact bounded vocabulary, REDs and boundaries carried verbatim, and nothing asserted beyond the evidence; an overclaim here is the failure mode the whole goal exists to prevent.

## Goal

T009 deliverables 2-4 in /Users/jacksm5pro/dev/open-source/versionless (T025 Judge worker_package; freeze 27741d9c — React `972ca80155bbc2a6eb3779943cd481b71d35e803` / Angular `4b6e2f4494d98582e4fe9b420c2b412059dc0720` byte-untouchable, verify before/after). The operator CLI flows are the NEXT unit. Derive everything from canonical receipts; never assert beyond them. Study the existing trust report/matrix machinery first — extend the established generators, no parallel ad-hoc pipeline.

1. ENTERPRISE REPORTS (machine + human), generated from a clean process: source/rights, tool + target versions, hashes, commands, locality, journeys, results, deviations, unsupported/unknown states, explicit non-certification language. Where the existing evidence/trust/current/report.md + matrix.json already carry these, extend rather than duplicate; add whatever operator-facing generation command is missing (e.g. a report:enterprise flow in the CLI) so an enterprise reviewer gets ONE machine artifact + ONE human document.
2. PITCH-GRADE SUPPORTED/UNSUPPORTED MATRIX: exactly the 6 React + 4 Angular counted green cells (derived — never hand-listed); both holdouts quoted with their EXACT receipt outcome strings ('passed' for react-cypress-rwa 76f0b5bd; 'witness-passed-on-bounded-anonymous-catalog-surface' for eShop fb921b46 — never restated as a generic pass); pigallery2 RED + eShop frozen-install RED as permanent falsification history; the pre-Ivy boundary with its 5-of-6 prevalence + population statement VERBATIM from angular-pre-ivy-boundary-amendment.ts; the declared tranche-two ngcc-bearing Angular 12/13 commitment; the 50 experimental capabilities marked out-of-matrix.
3. CLAIMS-AND-NON-CLAIMS ONE-PAGER: derived from canonical receipts; the nonclaims carried forward verbatim in substance (no certification, no signer authenticity, no OS-wide isolation, no SLSA level, holdouts counted in no numerator, bounded surfaces named). Audit and remove/correct any existing claim in docs/README surfaces broader than canonical green cells.
4. Guards + tests: generation is derivation-only (a hand-edited cell fails verification); grep-style verification that the eShop holdout appears ONLY with its bounded outcome string, no 'production-ready' blanket language, prevalence stays 5-of-6, population statement present.
5. Regenerate trust artifacts OFFLINE; all offline verifies valid.

## File contract

- `packages/trust/**`
- `packages/core/src/receipts/**`
- `packages/core/src/corpus/**`
- `packages/core/src/index.ts`
- `packages/cli/src/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/trust/**`
- `docs/**`
- `README.md`

## Forbidden moves

- NO packages/frameworks/\*\* edits (composite 27741d9c must recompute intact). No claim beyond canonical green cells; no generic-pass restatement; no numerator folding; no prevalence rounding; no dropped nonclaim/boundary/RED. No hand-edits to generator-owned artifacts. No sealed-receipt changes. No test weakening. Offline. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
sh -c 'grep -q "witness-passed-on-bounded-anonymous-catalog-surface" evidence/trust/current/report.md && ! grep -qi "production.ready" evidence/trust/current/report.md && grep -q "5 of 6\|5-of-6" evidence/trust/current/report.md && echo CLAIMS-SURFACE-HONEST'
```

## Blocked permission

If a required report field has no canonical source (name it — do not invent), an existing broader claim cannot be corrected within contract (name the file), or verifies fail after clean regeneration, return status "blocked" with specifics in open_questions instead of improvising.
