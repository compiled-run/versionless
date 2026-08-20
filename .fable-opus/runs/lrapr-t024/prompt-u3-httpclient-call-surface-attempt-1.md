Fable-Opus-Unit: lrapr-t024/u3-httpclient-call-surface
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: G6 is a cross-file type-flow transform — retyping producer and consumers as one coherent unit, removing .json() calls, relocating a GET body option, and rewriting immutable-headers mutation — where the withdrawn Response-rename experiment already proved that any site-at-a-time approach manufactures new type errors; the honest generality boundary for a whole-flow rewrite is the hardest judgment in this chase.

## Goal

Close G6 — the HttpClient call-surface migration — for the eShop holdout in /Users/jacksm5pro/dev/open-source/versionless (T024, run lrapr-t024; AUTHORIZED ANGULAR REOPEN; React subtree `972ca80155bbc2a6eb3779943cd481b71d35e803` untouchable). After u2 (commit 7543e0e) the remaining build diagnostics are exactly: 5×TS2307 + 1 webpack MNF on `@angular/http` in basket/campaigns/catalog/orders `.service.ts` + `security.service.ts`, and `security.service.ts:229 TS2339 '.json'`. The withdrawn u2a experiment (migration/u2a-t024-target-build.log, 18 diagnostics) is the negative evidence to study FIRST.

Design the generic capability honestly — a documented-successor CALL-SURFACE migration for `@angular/http -> @angular/common/http`, likely composed of:

1. Import-site substitution for the remaining value uses (`Http -> HttpClient`, `Headers -> HttpHeaders`, `Response` type positions resolved per rule 3).
2. `.json()` REMOVAL with type-flow reconciliation: `http.get(url).map(res => res.json())`-era patterns (and the app's actual shapes — measure all sites in the five services) become the typed HttpClient call whose observable already emits the parsed body; the producer's declared return type and every consumer's declared type must be reconciled IN THE SAME CHANGESET (the u2a lesson). Where the era code declared `Observable<Response>` and consumers call `.json()`, the honest rewrite types the flow by what the app actually does with the body (measure; if the element type cannot be derived from the app's own declarations, the honest answer may be `Observable<unknown>` + a named refusal, or a declared difference — never an invented `any` cascade that hides type reality... unless `any` is literally what the era `.json()` returned (it was `any`) — in which case typing the emitted element as the era's own `any` IS era-faithful parity; decide from what tsc accepts WITHOUT weakening noImplicitAny, and record the reasoning).
3. GET `body` option: HttpClient's get() has no body slot — measure what the era call actually sent (a body on GET per the era Http?) and apply the documented equivalent (request() with explicit method) — never silently drop a body the era sent.
4. Immutable headers: `headers.append(...)` mutation becomes reassignment (`headers = headers.append(...)`) — detector-gated on the successor's immutable API.
   All gates supply-driven (installed successor surface + measured app bytes), no app-name branches, per-flow total refusal when a flow cannot be reconciled honestly (a refused flow is a named diagnostic, not a half-rewrite).

Then RE-RUN migration + install + build. If GREEN: build TWICE, byte-compare, record. If a NEW class appears beyond G6, name it — do not chase. Tests per sub-rule (positive/negative/refusal); five green verticals unchanged; coverage entries experimental. Extend attempt.json + migration logs; restore any prior red records byte-for-byte if the re-run touches them.

## File contract

- `packages/frameworks/angular/**`
- `packages/core/src/migrations/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`
- `evidence/ingests/angular-eshop-webspa-netcore2-2/**`

## Forbidden moves

- React subtree untouchable. No app-name/revision/exact-source branches; no app-source hand edits; no tsconfig/strictness weakening to make types pass; no test weakening. Network only for named-package packument/tarball reads under consent VL-LEGACY-CORPUS-2026-08-10. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-INTACT'
```

## Blocked permission

If a flow cannot be reconciled without inventing types the app never declared (bring the flow + the honest options), the era GET-body semantics cannot be preserved by the successor (bring the measurement), a new class beyond G6 appears (name it), or the work exceeds this unit (say which flows closed and the build state), return status "blocked" with specifics in open_questions instead of improvising.
