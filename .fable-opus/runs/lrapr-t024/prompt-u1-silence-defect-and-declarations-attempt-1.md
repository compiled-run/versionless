Fable-Opus-Unit: lrapr-t024/u1-silence-defect-and-declarations
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: The silence defect is a reporting-honesty fix in the manifest-alignment core — the general transform must make every unread-line era pin visible without misclassifying the hundreds of already-read lines across five green verticals; getting the generality boundary and no-regression right is the expensive part.

## Goal

Close the eShop holdout's G1/G2/G4/G5 gaps generically in /Users/jacksm5pro/dev/open-source/versionless (T024, run lrapr-t024; AUTHORIZED ANGULAR REOPEN of f1a63359 — React subtree `972ca80155bbc2a6eb3779943cd481b71d35e803` untouchable, verify every step). G3 (value-position successor) is the NEXT unit — do not start it. Evidence: `evidence/ingests/angular-eshop-webspa-netcore2-2/migration/` + the u5 fixture record.

1. G1 THE SILENCE DEFECT (the general transform, first): `alignAngularPackageManifest` carries era pins for packages the cell has read NO line for, reporting nothing. Fix generically: any era-pinned declaration the cell has no reading for must surface — as `unhandled` (with the package + era pin + why silence is refused) — so silence stops being a failure mode. This must not change behavior for packages WITH readings (five green verticals' changesets must not shift except where a silent carry becomes an honest unhandled).
2. G2 COMMUNITY READINGS: add `@ng-bootstrap/ng-bootstrap` and `preboot` readings by the published-bytes discipline (dist-tags, peers, compiled-with stamps, Ivy markers — the u2/u3-of-T021 method; network only for these packuments/tarballs, consent VL-LEGACY-CORPUS-2026-08-10, URLs recorded). Verdicts as the bytes support: aligned line or no-successor. Note: @ng-bootstrap has modern lines (15/16.x target Angular 16); preboot's newest line — read it honestly.
3. G5 LOCKFILE SUPERSESSION: the changeset must DECLARE the era package-lock superseded (a changeset declaration like tslint.json removal, not a lane convention). Honest scope: only when the manifest alignment actually retargets the closure.
4. G4 SCRIPTS SURFACE: a generic capability reading the workspace's npm scripts and retargeting builder flags the workspace migration changed/removed (the measured case: `--extract-css` removed at builder level while build:prod still passes it). Detector-gated, no blanket rewriting.
5. Tests for each (positive/negative/stand-down); full node suite green; five green verticals' changesets unchanged except silent-carry->unhandled surfacing (name any such surfacing).
6. RE-RUN the eShop migration + install (the u5 runner): G1/G2/G5 should clear the install wall or name the exact next blocker. If install goes green, attempt the build ONCE and record diagnostics honestly (G3's 8 sites expected to remain; new construct classes behind the wall named precisely). Extend attempt.json + migration logs.

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

- React subtree untouchable. No G3 work. No app-name/revision/exact-source branches; no app-source hand edits; no forced peer flags; no test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes; no listeners left.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-INTACT'
```

## Blocked permission

If the silence fix cannot avoid shifting green-vertical changesets beyond honest surfacing (bring the diff), a community reading has no honest verdict (bring the bytes), the re-run reveals a new install blocker (name it), or the work exceeds this unit (say what landed), return status "blocked" with specifics in open_questions instead of improvising.
