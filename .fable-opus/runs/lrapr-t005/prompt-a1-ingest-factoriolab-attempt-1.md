Fable-Opus-Unit: lrapr-t005/a1-ingest-factoriolab
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest ONE scout-verified legacy Angular MIT application for the Versionless Angular tranche (board task T005, first Angular cohort). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-10, unit lrapr-t005/a0): **factoriolab/factoriolab @ commit `5f54abbdcac518d8ebf7e136c4348384d9b1a2bb`** (2020-10-31). Scout facts to re-verify at ingest, not trust: MIT LICENSE file at the pin (Copyright 2020 Doug Broad); Angular 10.1.5, @angular/cli 10.1.4, @ngrx/store 10.0.1, TS 4.0.3, builder `@angular-devkit/build-angular:browser` (webpack 4, Ivy); npm with committed package-lock.json lockfileVersion 1; engines unstated (CLI 10 era = Node 10.13/12/14); datasets ship in `src/data/**`, zero backend. Slug: `angular-factoriolab` (all your paths must start with this prefix to stay inside the contract).

Admission gates, all verified BEFORE acquisition counts (record evidence for each): MIT LICENSE file content at the exact pinned revision; real substantive application (not template/demo/library); Angular 2+ CLI era; pinned revision date matches the claimed era; browser UI plausibly supporting ≥3 substantive user journeys. If any gate fails against the scout's claims, record the failure append-only and return blocked — there is no fallback candidate in this packet.

Network policy: acquisition only, under purpose-bound consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; record every remote URL and byte digest touched. After acquisition, everything is offline.

Deliverable, using the EXISTING generic ingest machinery (`packages/cli/src/fixture/ingest.ts`, tier-f machinery, `pnpm run fixture:ingest` — read them first): immutable source archive identity (SHA-256, exact revision), license/rights evidence, provenance record, dependency closure with honest lock state (lockfileVersion recorded as found), declared legacy Node/bundler cell chosen by era policy (CLI 10 era: prefer an era-consistent Node line; the host has native arm64 Node 16.20.2 and, per the MyCrypto e1 precedent, an acquired Rosetta x64 Node 12.14.1 runtime with Rosetta 2 installed — declare which cell you use and why, truthfully recording any engine deviation), and one baseline `npm ci` + production build attempt with truthful outcome (a failing build is a truthful recorded outcome, not a unit failure — report it exactly).

Writing new per-app modules under packages/\*\* is OUT of contract; if the generic machinery cannot express this ingest, return blocked stating exactly what is missing.

## File contract

- `fixtures/angular-factoriolab*/**`
- `evidence/ingests/angular-factoriolab*/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract. Why: parallel lanes must stay disjoint; product/adapter work is a later serial phase.
- No candidate substitution — this packet is single-candidate; failure means blocked, not improvisation.
- Never recycle graveyard candidates (angular-contacts-app-example, FUXA, kubernetes-dashboard, openMF web-app, Tiledesk, Video-Hub-App, angular2-hn, ngx-admin, angularspree, OpenSlides, Oppia, QuickApp, ngrx-material-starter).
- No secrets, tokens, usernames, or host-specific absolute paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything (the harness commits your worktree at stop).

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/angular-factoriolab*/source.json'
sh -c 'ls evidence/ingests/angular-factoriolab*/attempt.json'
```

The fence is intentionally thin (ingest evidence is candidate-shaped); the receipt must carry digests, URLs, gate evidence, and the build-attempt outcome — that is the real verification surface, reviewed by the PM.

## Blocked permission

If any admission gate fails against the scout's claims, the generic ingest machinery cannot express this flow, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
