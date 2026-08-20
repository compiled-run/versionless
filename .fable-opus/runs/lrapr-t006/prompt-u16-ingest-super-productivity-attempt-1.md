Fable-Opus-Unit: lrapr-t006/u16-ingest-super-productivity
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest the Angular-8 pre-Ivy candidate for the Versionless portfolio (board task T006, Angular cohort two, C2). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-11, unit lrapr-t006/u14, license blob bytes at pin): **johannesjo/super-productivity @ tag `v2.13.15` = commit `2943c5c4f13c3ce4dece0abf4f9c39739dde4192`** (2019-12-05). Scout facts to re-verify at ingest, not trust: MIT LICENSE blob `4ebcbdf9…`, 1072 B, "Copyright (c) 2018 Johannes Millan"; Angular **8.2.6**, CLI **8.3.4**, @angular-devkit/build-angular 0.803.4 (**pre-Ivy ViewEngine + differential loading — the era gap this cell fills**), ngrx 8, TS 3.5.3, `angular.json`, yarn.lock, no LFS claimed → byte-scan anyway; 967 blobs / 6.94 MB single app; zero backend for the core flow (all state local): task create/edit, drag reorder, time tracking start/stop, project switch, settings, dark theme, keyboard shortcuts, import/export; ngsw service worker (record — non-masking precedent later); tsconfig.worker.json web worker; Electron sidecar (out of build scope — record); optional Jira/Google integrations off by default (record their egress destinations for witness blocking).

PM-RULED (baked in): the `"jira2md": "git+https://github.com/johannesjo/J2M.git"` git-protocol dependency is APPROVED under consent — record the resolved commit + tarball/tree digest per the closure idiom (the MyCrypto/jira-clone git-tarball precedent), integrity-hash absence recorded as found. `"angular-material-css-vars": "latest"` is a floating declared range lock-pinned in yarn.lock — record the declared-drift fact.

Slug: EXACTLY `angular-super-productivity-v2-13-15` — literal directories only.

Admission gates, all verified BEFORE acquisition counts: MIT LICENSE text bytes at pin; real substantive application; Angular 8 pre-Ivy era; era-coherent date; ≥3 substantive journeys plausible. Gate failure → record append-only, return blocked (pigallery2 1.7.0 is the ruled fallback but stays un-ingested unless the PM re-rules — do not substitute).

Network policy: acquisition only, consent `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; every URL/digest recorded (including the git dependency's); offline after.

Deliverable per the established evidence shape (evidence JSON/ndjson + `fixtures/angular-super-productivity-v2-13-15/fixture.json`): immutable source identity, license evidence, provenance, dependency closure with honest lock state incl. the git dependency record, declared legacy Node/bundler cell (CLI 8 era ≈ Node 10/12; Rosetta x64 Node 12.14.1 available — declare by era policy, deviations labeled), and one baseline install + production browser build attempt (web build, not Electron) with truthful outcome. Driver scripts are working tools inside your contract; PM merges only evidence records + fixture.json.

## File contract

- `fixtures/angular-super-productivity-v2-13-15/**`
- `evidence/ingests/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract; zero core enum edits.
- No candidate substitution; no secrets/usernames/host paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/angular-super-productivity-v2-13-15/source.json'
sh -c 'ls evidence/ingests/angular-super-productivity-v2-13-15/attempt.json'
```

## Blocked permission

If any admission gate fails against the scout's claims, the git-dependency acquisition cannot be recorded with full integrity facts, the era baseline cannot attempt honestly, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
