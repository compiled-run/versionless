Fable-Opus-Unit: lrapr-t005/a3-ingest-ionic-conference
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest ONE scout-verified legacy Angular MIT application for the Versionless Angular tranche (board task T005, first Angular cohort). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-10, unit lrapr-t005/a0; promoted by PM swap ruling after angular-realworld failed license-at-pin): **ionic-team/ionic-conference-app @ tag `v4` = commit `a7b2fc6afcd064947f3623774f4fd7db83c53c9c`** (2020-03-02). Scout facts to re-verify at ingest, not trust: MIT LICENSE at the tag (Copyright 2015-present Drifty Co.); Angular 8.2.13, CLI 8.3.20, @ionic/angular 4.11.6, @ionic/angular-toolkit 2.1.1, TS 3.5.3; standard `build-angular:browser` plus cordova targets; `@angular/service-worker` + `@angular/pwa` + `ngsw-config.json` (SW REGISTERS — record its presence; the HospitalRun non-masking precedent handles it later at witness time); npm with committed package-lock.json lockfileVersion 1; CI matrix Node 12 running `npm ci` + `npm run build -- --prod`; conference data `src/assets/data/data.json` claimed in-tree.

PRE-RULED DEVIATION (PM, 2026-08-10): the `postinstall` script runs `webdriver-manager update`, which touches the network. Run `npm ci --ignore-scripts` and record it as a labeled deviation. You MUST then record truthfully whether the production build depends on any postinstall side effect — if the build fails under --ignore-scripts for that reason, that failure is a truthful recorded outcome plus a clear note, not a unit failure.

FRESH LESSON from the factoriolab lane (unit a1): check `.gitattributes` for Git LFS routing BEFORE trusting that any asset ships in-tree — LFS pointer stubs in the archive broke the unmodified baseline build there. Record LFS state explicitly either way; if payloads are needed, follow the a1 deviation precedent (plain GET from the media host at the same pin, each payload verified against the sha256 oid in the stub it replaces, labeled as a deviation).

Slug: EXACTLY `angular-ionic-conference` — no version suffix, no variants. Your file contract is two literal directories and every path you write must live inside them.

Admission gates, all verified BEFORE acquisition counts (record evidence for each): MIT LICENSE file content at the exact pinned revision; real substantive application (not template/demo/library — a vendor demo is admissible here ONLY for its Ionic-Angular market shape, which the charter permits; record that framing honestly); Angular 2+ CLI era; pinned revision date matches the claimed era; browser UI plausibly supporting ≥3 substantive user journeys (schedule list/search/filter modal, session favorite, speaker routing, tutorial/login flows — the Google-Maps tab is excluded and must be inventoried as a blocked request at witness time). If any gate fails against the scout's claims, record the failure append-only and return blocked — there is no fallback candidate in this packet.

Network policy: acquisition only, under purpose-bound consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; record every remote URL and byte digest touched. After acquisition, everything is offline.

Deliverable, per the a1/hospitalrun evidence shape (evidence JSON/ndjson records under your evidence dir + `fixtures/angular-ionic-conference/fixture.json`): immutable source archive identity (SHA-256, exact revision), license/rights evidence, provenance record, dependency closure with honest lock state, declared legacy Node/bundler cell (CI says Node 12 → the host has the acquired Rosetta x64 Node 12.14.1 runtime, era-consistent; declare and justify), and one baseline `npm ci --ignore-scripts` + `npm run build -- --prod` attempt with truthful outcome. Driver scripts you write are working tools, not deliverables: keep them inside your contract, knowing the PM merges only evidence records and fixture.json to mainline (strict-TS policy keeps .cjs/.mjs drivers on the review branch).

## File contract

- `fixtures/angular-ionic-conference/**`
- `evidence/ingests/angular-ionic-conference/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract. Why: parallel lanes must stay disjoint; product/adapter work is a later serial phase.
- No candidate substitution — this packet is single-candidate; failure means blocked, not improvisation.
- No secrets, tokens, usernames, or host-specific absolute paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything (the harness commits your worktree at stop).

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/angular-ionic-conference/source.json'
sh -c 'ls evidence/ingests/angular-ionic-conference/attempt.json'
```

The fence is intentionally thin (ingest evidence is candidate-shaped); the receipt must carry digests, URLs, gate evidence, and the build-attempt outcome — that is the real verification surface, reviewed by the PM.

## Blocked permission

If any admission gate fails against the scout's claims, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
