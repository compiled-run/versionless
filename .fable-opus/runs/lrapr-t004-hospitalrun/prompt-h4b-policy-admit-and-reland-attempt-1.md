Fable-Opus-Unit: lrapr-t004-hospitalrun/h4b-policy-admit-and-reland
Fable-Opus-Timeout-Minutes: 35

## Goal

Re-land the HospitalRun aggregate/trust transition in /Users/jacksm5pro/dev/open-source/versionless. Unit h4 built the whole transition and left it verified-inert in the working tree (derived append tool `packages/cli/src/fixture/react-hospitalrun-aggregate-append.ts`, `react-hospitalrun-browser-proof` state + derived conformance rows, trust wiring); it blocked ONLY because `trust:generate` refuses HospitalRun's immutable revision `8156955145551d0366df10faa28e724f3377dea1` — its leading 13-digit run trips `panLike` in `packages/core/src/policy/payment-signals.ts`, and the permitted-context list is a closed enumeration that was outside h4's contract. That file is now IN contract, with this PM ruling baked in:

1. Extend the permitted-context closed list per its existing idiom (`isT124OfficialTreeObjectId`, `isT138OfficialTreeObjectId`, `isCycloneDxSha256Content`): admit a value that is EXACTLY a lowercase 40-hex git object id appearing under a revision-context key (`revision`, `parentRevision`, `targetRevision` — mirror the keys derived corpus provenance actually publishes) in derived corpus/trust provenance. Nothing else loosens: a bare 13–19 digit run must still trip panLike; a 40-hex value under a non-revision key must still trip; uppercase/mixed-case or wrong-length values must still trip. Add tests pinning all of these, positive and negative, including HospitalRun's exact revision as the positive case and its embedded digit run alone as a negative case.
2. Re-run the append for real (expect kind=react-hospitalrun-browser-proof, receipts 20, verticals 13, source apps 6 — measured 20/13/6 by h4 before its clean revert; re-derive, never author).
3. Complete `trust:generate` for real this time; MEASURE the trust receipt and matrix cell counts generation actually produces (h4's 20 receipts / 18 matrix cells were predicted, not measured — pin what reality yields, and report if reality disagrees with the prediction).
4. Move every pre-append test pin to the exact measured post-append value (pins move, never loosen), following the d7 change surface: papercups witness staged-copy re-append tests, corpus-conformance counts, fixture counts.
5. React-lineage readiness stays honest: HospitalRun's receipt declares `counted: false` pending Judge; matrix cell appears only if derivation produces it.
6. Whole repo gate green; report exactly which counts moved with receipt-backed justification.

## File contract

- `packages/core/src/policy/payment-signals.ts`
- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `packages/trust/src/**`
- `packages/trust/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`

## Forbidden moves

- No other packages/core/src changes; no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- The payment-signals change is exactly the closed-list admission described above — no broadening of any other detector, no threshold changes, no blanket allowances, no removal of existing checks. The no-payment-data gates are release-blocking; this admission must strengthen provenance honesty without weakening PAN detection.
- Nothing loosened elsewhere: every repointed pin asserts the new exact measured value; conformance rows derive from receipts; no hand-edited evidence; no forced matrix cells.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If the admission cannot be made without loosening an existing detector behavior, measured counts contradict derivation, any pin would have to loosen rather than move, or another closed enumeration outside this contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
