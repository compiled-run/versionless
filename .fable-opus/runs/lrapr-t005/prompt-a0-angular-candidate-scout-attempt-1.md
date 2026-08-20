Fable-Opus-Unit: lrapr-t005/a0-angular-candidate-scout
Fable-Opus-Timeout-Minutes: 30

## Goal

Produce the ranked Angular candidate shortlist for the first Angular production cohort of /Users/jacksm5pro/dev/open-source/versionless (board task T005: genuine code migration with applicationFilesChanged > 0; cohort must span materially different Angular CLI/build generations and legacy Node eras). This is the phase's ONE bounded scout — its receipt feeds packet composition for the ingest units, so precision beats breadth.

Work from, in order:

1. Local evidence first: `docs/goals/legacy-react-angular-production-readiness/notes/t011-codex-run-audit.md` (ground truth on the retired goal's Angular attempts), the retired board `docs/goals/react-angular-migration-spine/state.yaml` (grep for angular candidate/ingest/rejection records — it is 6MB, sample surgically), `evidence/ingests/` for any angular-\* residue, and `notes/t007-holdout-scout.md` (cypress-realworld-app is RESERVED as the React holdout — excluded here).
2. Public metadata research (read-only, purpose-bound under consent ID VL-LEGACY-CORPUS-2026-08-10): verify licenses, tags, and version facts for candidates before shortlisting them. Do not download archives or install anything — acquisition belongs to the ingest units.

Hard admission pre-screens (PM lessons from the React lanes — apply BEFORE ranking, reject with reasons):

- SPDX MIT ONLY, verified at the pinned revision (LICENSE file content, not the GitHub sidebar). Record LICENSE-vs-package.json contradictions as disqualifying unless resolved.
- Angular 2+ CLI-era shapes; the cohort overall must be able to span multiple CLI/build generations (e.g. one Angular 4-6 era, one Angular 8-11 era, optionally one 12+; Angular RealWorld may appear as ONE candidate but its prior version-bump receipt does not count and its cell requires real code migration).
- No Nx workspaces, no NativeScript, no Analog. An older Ionic Angular or Angular Universal shape may be listed only if it adds real market-shape evidence without Nx-scale complexity.
- Realistic browser journey surface: at least three substantive user journeys feasible (forms, routing, state changes) without external paid services; note required backends and whether a local/stub path exists (the papercups socket-stub precedent makes a same-origin API stub acceptable but expensive — prefer apps with local-first or stub-cheap surfaces).
- Pinned immutable revision (tag or commit) whose date matches the claimed era; note declared Node version and package manager with lockfile status.

Deliver in the receipt summary + open_questions=[] (or real questions): a ranked shortlist of 4-6 candidates with, per candidate: repo, pinned revision/tag + date, license evidence location, Angular/CLI/Node/package-manager/builder facts, journey surface sketch, stub/backend cost, admission risks; plus an explicit reject list with one-line reasons; plus a recommended first-cohort cut (2-3 candidates spanning materially different CLI generations) with the recommended ingest order.

## File contract

- none

## Forbidden moves

- Read-only: no file writes, no downloads, no installs, no git clones — a scout that writes is a scope violation.
- No candidate from the T011 graveyard of terminally excluded candidates; cypress-realworld-app stays reserved for the React holdout.
- Network use is metadata-only (license/tag/version verification on public repos under the consent ID).

## Verification

```verify

```

Read-only unit: no mechanical verify. The receipt's evidence is checked by the PM against the cited local notes and public metadata before any ingest packet is composed.

## Blocked permission

If local evidence contradicts public metadata, the graveyard status of a promising candidate is ambiguous, or fewer than 4 admissible candidates exist under these pre-screens, return status "blocked" with the specifics in open_questions instead of padding the shortlist.
