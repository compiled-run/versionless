Fable-Opus-Unit: lrapr-t006/u4-ingest-killedbygoogle
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest the LEGACY-NEXT React candidate for the Versionless portfolio (board task T006). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-11, unit lrapr-t006/u2, license blob bytes read at pin): **codyogden/killedbygoogle @ commit `56809c31592e6ca1edce8af9bfe842fbcdf71f4d`** (2022-02-06). Scout facts to re-verify at ingest, not trust: MIT LICENSE blob `a7069eea…`, 1067 B, "Copyright (c) 2020 Cody Ogden" (re-verified today, not inherited); next ^12.0.10, react ^17.0.2, react-select 5.2.2, TS ^4.5.5, pages/ router, `next export` in the preview script; no engines, yarn.lock v1 (256,958 B); zero backend — all data local `graveyard.json` (91 KB); 72 blobs / 370,006 B archive; no `.gitattributes` → verify zero LFS anyway.

IMPORTANT — retired-goal residue: `evidence/ingests/next-killedbygoogle/` contains a retired-goal artifact (schema `versionless.immutable-single-ingest.v1`, T001-ruled not grandfathered). Do NOT touch, reuse, or extend that directory. Your slug is EXACTLY `next-killedbygoogle-v3-0-0` — fresh, literal directories only. You MAY read the old artifact for cross-checking facts (archive sha256 c28878d0…, tree b8ac7b4f…) and record agreement/disagreement honestly.

Admission gates, all verified BEFORE acquisition counts: MIT LICENSE text bytes at pin; real substantive application; legacy Next 9-12 era with pages/ router (this is the required legacy-Next shape); era-coherent date; journey surface per the PM ruling — 2 strong journeys (search-by-name/description with count assertion; react-select type filter with count assertion, both shipped as upstream Playwright specs) + 1 compound (search×filter state), admissible under the charter's "where the application surface allows it" qualifier with the single-route limitation recorded as a truthful non-claim. Record the three third-party script destinations that witness units must block (analytics.bale.media/umami.js unconditional client-side; card.codyogden.com prod-only; carbonads in components/Carbon.tsx) and the press-outlet logo/trademark asset facts for the asset-exclusion policy.

Network policy: acquisition only, consent `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; every URL/digest recorded; offline after.

Deliverable per the established evidence shape (evidence JSON/ndjson + `fixtures/next-killedbygoogle-v3-0-0/fixture.json`): immutable source identity, license evidence, provenance, dependency closure with honest lock state, declared legacy Node/bundler cell (Next 12 era ≈ Node 14/16; declare and justify), and one baseline install + production build attempt (`next build`, and record whether `next export` also succeeds — the static-export path is the migration story) with truthful outcome. Driver scripts are working tools inside your contract; PM merges only evidence records + fixture.json.

## File contract

- `fixtures/next-killedbygoogle-v3-0-0/**`
- `evidence/ingests/next-killedbygoogle-v3-0-0/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/**, evidence/ingests/next-killedbygoogle/** (the retired artifact) or any path outside the contract; zero core enum edits.
- No candidate substitution; no secrets/usernames/host paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/next-killedbygoogle-v3-0-0/source.json'
sh -c 'ls evidence/ingests/next-killedbygoogle-v3-0-0/attempt.json'
```

## Blocked permission

If any admission gate fails against the scout's claims, the baseline build requires network beyond the consented acquisition, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
