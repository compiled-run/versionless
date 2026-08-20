Fable-Opus-Unit: lrapr-t023/u3-boundary-amend-candidate3-acquire
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: Amending a published claims surface (prevalence, successor-across-names, population statement) without weakening anything, appending a verdict-overturn record without rewriting history, and acquiring a monorepo-subpath candidate immutably are all integrity-critical evidence operations.

## Goal

Stage 1+2 of the T022 follow-up ruling (notes/t022-boundary-ruling.md "Follow-up ruling" section, commit 126c35b) in /Users/jacksm5pro/dev/open-source/versionless. NO baseline build, NO migration, NO run (later units).

STAGE 1 — AMEND THE PUBLISHED BOUNDARY (in the same surfaces u1 landed: coverage.supportBoundaries -> matrix.json -> report.md, with the trust:verify guard):

1. Codify the successor-across-names rule: a successor reading counts when evidenced by registry deprecation metadata naming the successor + the successor's published Ivy bytes; the boundary is an ecosystem-availability fact, never an adapter-capability fact.
2. Codify the preboot rule: declared-but-never-imported dependencies are not active use.
3. Publish prevalence honestly: the no-successor pre-Ivy condition observed in 5 of 6 independently selected webpack-era Angular applications — 1 tested-and-failed (pigallery2), 4 screened-and-failed (cyclos4-ui, ngx-starter-kit, tabby, coreui); eShopOnContainers carries a first-party-successor removal, a DISTINCT condition. Tested vs screened must stay distinguished; never publish 6-of-6.
4. Add the population statement: any application clearing this gate is by construction from a narrower, younger-dependency population than the webpack-era fleet the goal targets; a GREEN holdout speaks for the supported cell only.
5. Append the OVERTURN record for candidate 3's gate-zero verdict to `docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md` — an APPENDED section citing the T022 follow-up ruling; the original screen text stays byte-unchanged above it. Capture the @angular/http registry deprecation message bytes into the overturn record (fetch the packument; record URL; consent VL-LEGACY-CORPUS-2026-08-10).
6. Update trust guards/tests so a stripped/weakened prevalence or missing population statement fails verification; regenerate trust artifacts OFFLINE (trust:generate --offline --policy trust/policy.json --output evidence/trust/current); trust:verify --offline must be valid.

STAGE 2 — COMMIT + ACQUIRE CANDIDATE 3 (the fixed §3 order requires it; no substitution):

- dotnet-architecture/eShopOnContainers @ netcore2.2, commit `a387f21029f0b2d49614d165d5384717d2398f8e`, root tree `debf546f9450273577ac74490cf906564698beab`, licenseSha256 `baebca0309090f4eca1b7a82c836cc91e48b2b92139c2280fb0ff69af922c2ae`, application subpath `src/Web/WebSPA`.
- Immutable acquisition per the established T018-u1 method: codeload tarball at the pinned commit, double-fetch byte-identical, sha256, blob-parity vs the git tree (the repo is large — parity over the full tree, with the WebSPA subpath containment explicitly recorded: the migration input is src/Web/WebSPA only, and that containment is a recorded fact, not a filter applied silently later). Store under `evidence/ingests/angular-eshop-webspa-netcore2-2/` (source.json/attempt.json/license-at-pin.txt/.gitignore for archive bytes).
- Detection facts from the WebSPA subpath (read-only, scratch extraction): Angular version (~6.1.4), CLI/builder (~6.1.5), Node engines, package manager, @angular/http usage sites, backend coupling shape (the SPA talks to .NET services — record what its own config declares), unknowns preserved.

Network authorized ONLY for the @angular/http packument capture + the pinned acquisition, under the consent ID; record every URL.

## File contract

- `packages/trust/**`
- `packages/core/src/receipts/**`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `packages/cli/test/**`
- `evidence/trust/**`
- `evidence/ingests/angular-eshop-webspa-netcore2-2/**`
- `docs/goals/legacy-react-angular-production-readiness/**`

## Forbidden moves

- No packages/frameworks/\*\* edits (freeze f1a63359 intact; verify React 972ca801 + Angular 1f63f32c oids unchanged). No baseline/migration/run work. Never rewrite the original screen text, the pigallery2 RED, or any receipt's behavioral content — overturn is APPEND-ONLY. Never publish 6-of-6 or drop the tested/screened distinction. No hand-edits to generator-owned artifacts. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "1f63f32c9f4eb327e2c85f63e69544f1eeb99428" && echo FREEZE-SUBTREES-INTACT'
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
sh -c 'node -e "const s=require(\"./evidence/ingests/angular-eshop-webspa-netcore2-2/source.json\"); if(s.revision!==\"a387f21029f0b2d49614d165d5384717d2398f8e\"||!s.sha256||s.licenseSha256!==\"baebca0309090f4eca1b7a82c836cc91e48b2b92139c2280fb0ff69af922c2ae\") throw new Error(\"pin mismatch\"); console.log(\"candidate-3 pinned ok\")"'
```

## Blocked permission

If the acquisition cannot match the exact pin (bring what was found), the packument deprecation bytes contradict the ruling's successor claim (bring them — that would reopen the ruling), the prevalence amendment cannot land without touching immutable receipts, or trust:verify fails after clean regeneration, return status "blocked" with specifics in open_questions instead of improvising.
