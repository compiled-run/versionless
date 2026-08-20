Fable-Opus-Unit: lrapr-t005/a2-ingest-jira-clone
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest ONE scout-verified legacy Angular MIT application for the Versionless Angular tranche (board task T005, first Angular cohort). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-10, unit lrapr-t005/a0): **trungvose/jira-clone-angular @ commit `059455b9933a236456524925065bce2c295e2d9a`** (2022-03-13). Scout facts to re-verify at ingest, not trust: MIT LICENSE file at this exact pin (Copyright (c) 2020 Trung Vo) — NOTE the v2.0.0 tag tree itself lacks LICENSE, this pin four days later restores it, so pin the SHA, never the tag; package.json declares no license field (absence, not a contradiction — record as found); Angular 13.2.4, CLI 13.2.5, `@angular-builders/custom-webpack:browser`/`:dev-server` with a root `webpack.config.js`, ng-zorro-antd 13, Akita 7, Tailwind 3, TS 4.5.5; `.nvmrc` = 16; npm with committed package-lock.json (verify lockfileVersion locally, record as found); seed data `src/assets/data/project.json` + `auth.json` fetched same-origin, no backend. The v1.x line ships a NestJS backend and is NOT this candidate.

FRESH LESSON from the factoriolab lane (unit a1): check `.gitattributes` for Git LFS routing BEFORE trusting that any asset ships in-tree — LFS pointer stubs in the archive broke the unmodified baseline build there. Record LFS state explicitly either way; if payloads are needed, follow the a1 deviation precedent (plain GET from the media host at the same pin, each payload verified against the sha256 oid in the stub it replaces, labeled as a deviation).

Slug: EXACTLY `angular-jira-clone` — no version suffix, no variants. Your file contract is two literal directories and every path you write must live inside them.

Admission gates, all verified BEFORE acquisition counts (record evidence for each): MIT LICENSE file content at the exact pinned revision; real substantive application (not template/demo/library); Angular 2+ CLI era; pinned revision date matches the claimed era; browser UI plausibly supporting ≥3 substantive user journeys. If any gate fails against the scout's claims, record the failure append-only and return blocked — there is no fallback candidate in this packet.

Network policy: acquisition only, under purpose-bound consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; record every remote URL and byte digest touched. After acquisition, everything is offline.

Deliverable, per the a1/hospitalrun evidence shape (evidence JSON/ndjson records under your evidence dir + `fixtures/angular-jira-clone/fixture.json`): immutable source archive identity (SHA-256, exact revision), license/rights evidence, provenance record, dependency closure with honest lock state, declared legacy Node/bundler cell (`.nvmrc` 16 → native arm64 Node 16.20.2, era-consistent), and one baseline `npm ci` + production build attempt with truthful outcome (a failing build is a truthful recorded outcome, not a unit failure — report it exactly; the layout may require building the Angular client workspace specifically — record exactly what you built). Driver scripts you write are working tools, not deliverables: keep them wherever is convenient inside your contract, knowing the PM merges only evidence records and fixture.json to mainline (strict-TS policy keeps .cjs/.mjs drivers on the review branch).

## File contract

- `fixtures/angular-jira-clone/**`
- `evidence/ingests/angular-jira-clone/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract. Why: parallel lanes must stay disjoint; product/adapter work is a later serial phase.
- No candidate substitution — this packet is single-candidate; failure means blocked, not improvisation.
- No secrets, tokens, usernames, or host-specific absolute paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything (the harness commits your worktree at stop).

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/angular-jira-clone/source.json'
sh -c 'ls evidence/ingests/angular-jira-clone/attempt.json'
```

The fence is intentionally thin (ingest evidence is candidate-shaped); the receipt must carry digests, URLs, gate evidence, and the build-attempt outcome — that is the real verification surface, reviewed by the PM.

## Blocked permission

If any admission gate fails against the scout's claims, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
