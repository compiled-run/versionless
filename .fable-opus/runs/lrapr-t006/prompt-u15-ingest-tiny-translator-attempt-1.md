Fable-Opus-Unit: lrapr-t006/u15-ingest-tiny-translator
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest the Angular 4–6-band candidate for the Versionless portfolio (board task T006, Angular cohort two, C1). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-11, unit lrapr-t006/u14, license blob bytes at pin; promoted by PM ruling after altair's placeholder-copyright refusal): **martinroob/tiny-translator @ tag `v0.12.0` = commit `08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a`** (2017-12-08). Scout facts to re-verify at ingest, not trust: MIT LICENSE blob `67e75a82…`, 1068 B, "Copyright (c) 2017 Martin Roob" (clean holder line); Angular **5.0.3**, @angular/cli **1.5.4**, TS 2.4, @angular/material 5.0.0-rc.2 (an RC dep — record as found), **`.angular-cli.json`** (the owed pre-angular.json workspace format — this is the cell's entire point); yarn.lock; no LFS claimed → byte-scan anyway; zero backend (IndexedDB/localStorage core flow: create project → load XLIFF via file input → edit/filter/mark translation units → download); an optional GitHub-download feature to be blocked at witness time (record the destination); ngsw service-worker build variants and i18n build-prod-lang scripts on the surface (record; the SW non-masking precedent applies later).

Slug: EXACTLY `angular-tiny-translator-v0-12-0` — literal directories only.

Admission gates, all verified BEFORE acquisition counts: MIT LICENSE text bytes at the pin; real substantive application (56 stars is recorded as a weak-fleet-shape fact, not a gate failure — the cell's value is the workspace-format capability); Angular 4–6 era with `.angular-cli.json`; era-coherent date; ≥3 substantive journeys plausible (project create, XLIFF load via file input, unit edit/filter/mark, download). Gate failure → record append-only, return blocked (the C1 swap chain is exhausted — altair is refused — so a failure here reshapes the cohort; state it plainly).

Network policy: acquisition only, consent `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; every URL/digest recorded; offline after.

Deliverable per the established evidence shape (evidence JSON/ndjson + `fixtures/angular-tiny-translator-v0-12-0/fixture.json`): immutable source identity, license evidence, provenance, dependency closure with honest lock state, declared legacy Node/bundler cell (CLI 1.5 era ≈ Node 6-8; the host has Rosetta x64 Node 12.14.1 and native 16.20.2 — declare by era policy and justify, deviations labeled), and one baseline install + production build attempt with truthful outcome. Driver scripts are working tools inside your contract; PM merges only evidence records + fixture.json.

## File contract

- `fixtures/angular-tiny-translator-v0-12-0/**`
- `evidence/ingests/angular-tiny-translator-v0-12-0/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract; zero core enum edits.
- No candidate substitution; no secrets/usernames/host paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/angular-tiny-translator-v0-12-0/source.json'
sh -c 'ls evidence/ingests/angular-tiny-translator-v0-12-0/attempt.json'
```

## Blocked permission

If any admission gate fails against the scout's claims, the era baseline cannot attempt honestly (record the exact wall), pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
