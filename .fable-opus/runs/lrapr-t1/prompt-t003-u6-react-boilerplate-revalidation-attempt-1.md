Fable-Opus-Unit: lrapr-t1/t003-u6-react-boilerplate-revalidation
Fable-Opus-Timeout-Minutes: 35

## Goal

Freshly revalidate the React Boilerplate zero-service-worker vertical in /Users/jacksm5pro/dev/open-source/versionless through every canonical production-readiness gate, producing regenerated evidence. This is the tranche numerator step: success means React 1/3 under the fresh oracle.

The intended entrypoint is `scripts/revalidate-production-baseline.ts` (written by a prior run, never executed to completion). Read it first. The required semantics for this unit:

- React-only invocation for fixture `react-boilerplate-v4-zero-sw`: two offline production builds (deterministic), Witness browser runs via the local `link:../witness` dependency — baseline 2/2 and migrated 2/2 — with at least three substantive user journeys (real clicks, typing, keyboard, hover, scroll with visible state assertions; not page loads), a semantic mutation that turns the parity gate red followed by byte-identical restoration and a green rerun, zero successful non-loopback network traffic, redacted canonical artifacts and digest, and independent offline receipt verification.
- If the script's CLI cannot run React-only (e.g. it hard-requires an --angular argument), adapt the script minimally so it can — strict TypeScript, magic-regexp/pathe/ufo, no new schema or reporting layer. If it needs more than minimal adaptation (a rewrite, or its design contradicts the semantics above), return blocked with specifics instead.
- Refresh only this vertical's evidence under `evidence/runs/react-boilerplate-v4-zero-sw/**` and `evidence/runs/witness-react-boilerplate-zero-sw/**` as the canonical flow dictates. Do not touch any other evidence.
- Evidence hygiene is release-blocking: no credentials, tokens, payment data, usernames, or host-specific absolute paths in any generated artifact; preserve unknown/not-tested states; no certification language.

Working caches under `.versionless/work/**` and build output are fair game via Bash as the existing flow requires.

## File contract

- `scripts/**`
- `evidence/runs/react-boilerplate-v4-zero-sw/**`
- `evidence/runs/witness-react-boilerplate-zero-sw/**`

## Forbidden moves

- Do not modify product code (packages/**), fixtures/**, or any evidence outside the two contracted evidence directories. Why: this unit proves the existing curated spine; a product change here would invalidate the proof.
- Do not weaken any gate to pass it: no journey-count reduction, no skipping mutation/restoration, no relabeling red as green, no fabricated or hand-edited evidence values. Why: the receipt is only worth what the gate actually measured.
- Do not replace link:../witness with a registry copy; no network access at all — builds and verification run offline from the existing ingest.
- Do not commit or stage anything.

## Verification

```verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm exec tsx scripts/revalidate-production-baseline.ts --offline --react react-boilerplate-v4-zero-sw --build-repetitions 2 --witness-repetitions 2 --minimum-journeys 3 --mutation-red --restore-bytes --independent-verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
pnpm exec tsc --noEmit
pnpm exec vp lint
```

## Blocked permission

If the script cannot express React-only revalidation without redesign, if the Witness/Playwright browser cannot launch, if the app surface genuinely cannot support three substantive journeys (report exactly what it supports — do not pad), if determinism fails across the two builds, or if any gate goes red for a reason that looks like a real product defect, return status "blocked" with the exact command output in open_questions instead of improvising.
