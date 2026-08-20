Fable-Opus-Unit: lrapr-t021/u3-compile-stage-dependency-readings
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: Choosing aligned-successor vs no-successor readings for three UI dependency packages requires evidence-driven verdicts from published peer declarations and compiled-with stamps (u2 proved naive latest-line alignment fails at the linker), and the engines-rewrite capability is a workspace-manifest transform whose overreach would misdeclare every future migrated app.

## Goal

Close the Angular holdout's remaining DEPENDENCY-level gaps in /Users/jacksm5pro/dev/open-source/versionless (T021 chase; React subtree stays at oid `972ca80155bbc2a6eb3779943cd481b71d35e803`). u2 landed the install-stage readings and proved the discipline (table before family-prefix; compiled-with-stamp refinement; no-successor as declared difference). Apply the same discipline to the compile-stage dependency set, plus two PM-ruled dispositions. App-source transform capabilities (NG2007, raw-loader chain, msOverflowStyle) are NOT this unit.

Do:

1. G4 READINGS — the three open-ended-peer packages whose published .d.ts fail under the Angular 16 cell:
    - `ngx-bootstrap@5.1.0` (7×TS2314 in its own ModuleWithProviders declarations): live successor lines exist (ngx-bootstrap 10/11/12 target modern Angular). Read the compiled-with stamps + peers the u2 way and align to the line that matches the 16 cell (verify the styles/theme entry the app references still resolves at that line, the toastr.css lesson).
    - `@yaga/leaflet-ng2@1.0.0` (TS2416 in geojson.directive.d.ts): read its publish history honestly — if no line compiles against Ivy/Angular 16, it is no-successor (declared difference).
    - `jw-bootstrap-switch-ng2@2.0.5`: same evidence-driven verdict, whichever the stamps support.
2. PM-RULED: `xlf-google-translate` — apply the table's own established rule: 1.0.0-beta.23+ drop the registry-deleted `@k3rn31p4nic/google-translate-api` dependency; 1.0.4 is newest, no peers, no engines. The jira2md precedent governs (an unresolvable declaration is not a closure). Land it as a package-keyed reading so the authored migrated manifest no longer hits the E404 and the digest-bounded narrowing becomes unnecessary for the MIGRATED lane (the era baseline's record stays as-is — history is history).
3. EBADENGINE CAPABILITY: the migrated workspace still declares the ERA `engines.node ">= 6.9 <11.0"`, which excludes the target cell's own Node line. Add the generic workspace-manifest capability: when the migration retargets the cell, the manifest's engines must be rewritten to the target cell's declared Node line (derived from the cell, never hardcoded), recorded as a declared difference. Respect the established changeset/declared-difference pattern.
4. Tests for every reading + the engines capability (positive/negative/stand-down), full node suite green, four green verticals unchanged.
5. RE-RUN the pigallery2 migration + install + build ONCE with the updated engine: record the new diagnostic counts honestly. EXPECTED remaining: NG2007 ×1, raw-loader module-not-found, msOverflowStyle TS2339-ish, and whatever of the 249 template diagnostics persists while app.module.ts still fails on raw-loader. If ngx-bootstrap's alignment surfaces NEW API-level breaks in app source (the 5.x->1x.x jump may change its own API surface), record each precisely — they may need their own generic capabilities or be honest REDs; do NOT hand-edit app source.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/ingests/angular-pigallery2-v1-7-0/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`

## Forbidden moves

- React subtree untouchable (verify oid). No app-name/revision/exact-source branches (readings are package-keyed — the table's shape). No app-source hand edits. No forced peer flags. No test weakening. Network use ONLY to read npm registry metadata/tarballs for the named packages under consent VL-LEGACY-CORPUS-2026-08-10 (record URLs). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-FROZEN-INTACT'
```

## Blocked permission

If a package's stamps support no honest verdict (bring the evidence), an alignment surfaces app-source API breaks too large for recording (name each), the engines capability cannot avoid overreach (explain), or the work exceeds this unit (say what landed), return status "blocked" with specifics in open_questions instead of improvising.
