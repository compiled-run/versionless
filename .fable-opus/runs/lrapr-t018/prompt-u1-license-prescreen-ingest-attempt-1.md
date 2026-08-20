Fable-Opus-Unit: lrapr-t018/u1-license-prescreen-ingest
Fable-Opus-Timeout-Minutes: 30

## Goal

Gate zero of the Angular HOLDOUT (task T018) in /Users/jacksm5pro/dev/open-source/versionless: the MANDATORY license-text-at-pin pre-screen for primary target **pigallery2 1.7.0**, then (only if it passes) the immutable, purpose-bound acquisition. This unit is a HALT-checkpoint: a failed pre-screen is a BLOCKED receipt with the evidence — never a silent substitute.

Do in order:

1. UNUSED-CHECK (local, first — it needs no network): prove pigallery2 was never adapter-designing in this repo. Grep the whole repo (packages/, evidence/, fixtures/, docs/goals/, .versionless if present) for pigallery references. Only the T018 board card naming it as the target is acceptable; any prior ingest/fixture/adapter/witness/receipt reference means the app is NOT unused → blocked. Also confirm it is not one of the excluded names (factoriolab, jira-clone, tiny-translator, super-productivity, realworld, graveyard).
2. LICENSE-AT-PIN: identify the exact immutable revision of pigallery2 release 1.7.0 (github.com/bpatrik/pigallery2 — the v1.7.0 tag's commit SHA). Fetch the LICENSE file AS IT EXISTS AT THAT EXACT REVISION (raw at the pinned commit, not the default branch). Verify it is MIT license text. Record its sha256 as licenseSha256. If the license at pin is NOT MIT (or there is no license at pin), HALT → blocked receipt with what was found; do not pick a substitute app.
3. ACQUIRE IMMUTABLY (only if 1+2 pass): download the source archive for the exact pinned revision (codeload tarball at the commit SHA), record: exact remote URL(s) accessed, the commit SHA, the archive sha256, byte size, and the purpose-bound consent ID `VL-LEGACY-CORPUS-2026-08-10`. Store the archive under the repo's established ingest convention (see the sibling dirs under `evidence/ingests/` — e.g. react-taskcafe-v032 — and mirror their `source.json`/`attempt.json` shape; use a new `evidence/ingests/angular-pigallery2-v1-7-0/` directory). Do NOT extract into the corpus/work area yet (the baseline stage is the next unit).
4. DETECT (read-only, from the archive): unpack to a scratch location only (not the corpus), and record starting facts without strengthening unknowns: Angular version, Angular CLI/builder generation, Node version expectations (.nvmrc/engines), package manager, monorepo/backend shape (pigallery2 has an Express+sqlite backend — record what its package.json actually declares), native deps (e.g. sharp) as-declared. Put these facts in attempt.json. Unknowns stay recorded as unknown.

Network use is authorized ONLY for step 2+3 (github.com/codeload.github.com for this exact repo at this exact pin) under consent VL-LEGACY-CORPUS-2026-08-10; record every URL touched. Everything else offline.

## File contract

- `evidence/ingests/angular-pigallery2-v1-7-0/**`

## Forbidden moves

- No substitute application if pigallery2 fails any gate — blocked receipt instead. No extraction into fixtures/ or .versionless corpus/work areas (next unit). No code changes anywhere (this is an evidence-only unit; tsc/lint must pass trivially because nothing in packages/\*\* changes). No default-branch license fetch — license MUST be read at the pinned revision. No credentials/tokens/PII in evidence; no host-specific absolute paths inside the recorded evidence files. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'ls evidence/ingests/angular-pigallery2-v1-7-0 && node -e "const s=require(\"./evidence/ingests/angular-pigallery2-v1-7-0/source.json\"); if(!s.licenseSha256||!s.sha256||!s.revision) throw new Error(\"missing pinned identity fields\"); console.log(\"pinned:\", s.revision.slice(0,12), \"license:\", s.licenseSha256.slice(0,12))"'
```

## Blocked permission

If the LICENSE at the exact v1.7.0 pin is not MIT (bring the actual license text/SPDX found), pigallery2 appears anywhere in prior repo evidence as adapter-influencing (bring the paths), the v1.7.0 tag/commit cannot be resolved immutably, or network access fails, return status "blocked" with specifics in open_questions instead of improvising.
