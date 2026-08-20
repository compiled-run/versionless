Fable-Opus-Unit: lrapr-t008/hx1-ingest-cypress-rwa
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest the React HOLDOUT application for the Versionless frozen-adapter falsification run (board task T008; T007 Judge selection). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (Judge-selected 2026-08-11; scout-verified in `notes/t007-holdout-scout.md`): **cypress-io/cypress-realworld-app @ v1.0.18 = commit `f6b5cf3a`** (verify the full SHA from the wire). Scout facts to re-verify at ingest, not trust: MIT LICENSE at the pin; react-scripts 4 / webpack 4 CRA shape; a genuine in-repo Express+lowdb loopback API (NOT a harness stub — record its presence and boot path); LOCAL JWT auth mode available without Auth0/Okta network (record exactly how it is selected); fully offline-capable journeys. Slug: EXACTLY `react-cypress-rwa` — literal directories only.

HOLDOUT DISCIPLINE (this is a falsification run): this application must never influence product code. Your unit is evidence-only — any finding that would "need an adapter tweak" is a finding to record, never an action. The five frozen subtrees (packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis) are fingerprint-locked (d9f75ef6…, recorded in evidence/trust/current/adapter-freeze.json).

LFS lesson: check `.gitattributes` for LFS routing BEFORE trusting in-tree assets; record LFS state explicitly; oid-verified deviation recipe if payloads are needed.

Admission gates, all verified BEFORE acquisition counts (record evidence for each): MIT LICENSE file content at the exact pinned revision (license TEXT bytes, not sidebar); real substantive application; React CRA era; pinned revision date coherent; browser UI plausibly supporting ≥3 substantive user journeys. Gate failure → record append-only and return blocked (no fallback candidate; the holdout is Judge-selected).

Network policy: acquisition only, under consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; every URL/digest recorded. After acquisition, offline.

Deliverable per the established evidence shape (evidence JSON/ndjson + `fixtures/react-cypress-rwa/fixture.json`): immutable source identity, license/rights evidence, provenance, dependency closure with honest lock state, declared legacy Node/bundler cell (record what the repo declares — .nvmrc/engines/CI — and what the host offers; react-scripts 4 era suggests Node 12-16), and one baseline install + build attempt with truthful outcome (the API server boot is part of the baseline surface — record whether it starts and serves on loopback). Driver scripts are working tools; PM merges only evidence records + fixture.json (strict-TS policy).

## File contract

- `fixtures/react-cypress-rwa/**`
- `evidence/ingests/react-cypress-rwa/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract; ZERO frozen-subtree influence.
- No candidate substitution; no secrets/tokens/usernames/host-paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything (the harness commits your worktree at stop).

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/react-cypress-rwa/source.json'
sh -c 'ls evidence/ingests/react-cypress-rwa/attempt.json'
```

The receipt must carry digests, URLs, gate evidence, the JWT-mode selection facts, the API-server boot outcome, and the build-attempt outcome — the real verification surface, PM-reviewed.

## Blocked permission

If any admission gate fails, the local JWT mode cannot be selected without external auth network, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
