Fable-Opus-Unit: lrapr-t023/u2-gate-zero-replacement-selection
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: The selection must survive a selection-bias audit — the pre-screen is strictly limited to the declared boundary condition and the candidate must be committed before any trial work, so the ordering rationale, the per-candidate evidence, and the refusals all have to be defensible on the record.

## Goal

Stage 3 of T023 in /Users/jacksm5pro/dev/open-source/versionless: gate-zero SELECT and immutably ACQUIRE the replacement Angular holdout candidate, under the T022 anti-cherry-picking discipline (notes/t022-boundary-ruling.md). NO baseline build, NO migration, NO trial of any migrated tree (stage 4+).

DISCIPLINE (violations void the holdout):

- Build an ordered candidate list FIRST, ranked by fleet-shape fit (real legacy MIT Angular apps; materially different age/architecture from the existing verticals; the owner fleet is mostly webpack-era enterprise shapes; Angular CLI/build generations the matrix doesn't already cover are a plus). Record the ordering rationale BEFORE screening.
- Excluded: factoriolab, jira-clone, tiny-translator, super-productivity, realworld, pigallery2, anything in the graveyard/prior-candidate evidence (grep evidence/ and the board notes), and anything adapter-designing.
- Then screen candidates IN ORDER, each with exactly three checks, all read from manifests/registry/repo metadata ONLY:
    1. LICENSE-AT-PIN: MIT at the exact pinned release revision (tag -> commit -> LICENSE blob at that tree; the T018 u1 method), recorded licenseSha256. Placeholder copyright ("[year]/[fullname]") fails.
    2. UNUSED: zero prior use in this repo beyond, at most, being named in a candidate list.
    3. BOUNDARY: the app's manifest at pin must NOT declare a no-successor pre-Ivy dependency in ACTIVE application use (check each Angular-ecosystem dependency's registry dist-tags/peers the u2/u3-of-T021 way — a dependency whose newest line is still pre-Ivy/ViewEngine-only or full-compilation-against-old-Angular fails the boundary). Devdeps that don't reach the build path do not fail it. Record per-dependency verdicts.
- COMMIT to the FIRST candidate that passes all three. No trial migration/install/build. If none passes, HALT (blocked receipt with the full screening record).
- Then ACQUIRE the committed candidate immutably (the T018 u1 method): codeload tarball at the pinned commit, double-fetch byte-identical, sha256, blob-parity vs the git tree, consent VL-LEGACY-CORPUS-2026-08-10, every URL recorded. Store under `evidence/ingests/<slug>/` with source.json/attempt.json/license-at-pin.txt and a .gitignore for archive bytes (the established convention). Record detection facts (Angular version, CLI/builder generation, Node engines, package manager, native deps, backend shape) with unknowns preserved.

Network is authorized ONLY for registry/GitHub metadata + the pinned acquisition under the consent ID; record every URL.

## File contract

- `evidence/ingests/**`
- `docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md`

## Forbidden moves

- No trial migration/install/build of any candidate (voids the holdout). No packages/\*\* edits at all. No pre-screen checks beyond the three (screening on "looks easy to migrate" is the exact selection bias the Judge forbade). No silent substitution or reordering after screening starts. No credentials/PII/host paths in evidence. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'ls docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md'
sh -c 'D=$(ls -d evidence/ingests/*/ | while read d; do test -f "$d/source.json" && node -e "const s=require(\"./$d/source.json\"); if(s.consentId===\"VL-LEGACY-CORPUS-2026-08-10\"&&s.licenseSha256&&s.sha256&&s.revision&&!/pigallery2|taskcafe|sqlpad|graphql-playground|netlify-cms|parse-dashboard|redux-realworld|shlink/.test(\"$d\")) console.log(\"$d\")" ; done | tail -1); test -n "$D" && echo "committed candidate ingest present: $D"'
```

## Blocked permission

If no candidate passes the three-check screen (bring the complete per-candidate record), the boundary check cannot be decided from published bytes for a dependency (name it — do not guess), the pinned revision cannot be resolved immutably, or network fails, return status "blocked" with specifics in open_questions instead of improvising.
