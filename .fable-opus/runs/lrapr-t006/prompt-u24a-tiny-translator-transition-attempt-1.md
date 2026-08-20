Fable-Opus-Unit: lrapr-t006/u24a-tiny-translator-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the tiny-translator aggregate/conformance/trust transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change (the factoriolab/jira-clone Angular single-member precedent; u24's reconnaissance produced the turnkey map below). Commit `c609eb1`: witness receipt at `evidence/runs/witness-angular-tiny-translator-v0-12-0/` (digest 65b0a976, single-member sealing its build receipts).

Turnkey map (from u24 reconnaissance, verified against the code):

- **Predecessor state**: `react-linkfree-browser-proof` (current tip via `deriveCorpusTransactionState`). New kind: `angular-tiny-translator-browser-proof`.
- **Append fixture** `packages/cli/src/fixture/angular-tiny-translator-aggregate-append.ts`: mirror `angular-factoriolab-aggregate-append.ts` exactly (single Witness member = `witnessAngularTinyTranslatorAggregateMember(verifyWitnessAngularTinyTranslatorEvidence().digest)`, digest 65b0a976; refuse anything but the exact predecessor kind OR the exact already-appended kind; atomic staged `.t006a.tmp` write + re-derive + rename). Run it `--append` for real.
- **conformance rows**: mirror `angularFactoriolabConformanceRows` but adapt to tiny-translator's REAL fields — `receipt.scrollAbsence.state`, `receipt.serviceWorkerAttempt` (NO `receipt.serviceWorker`), `receipt.persistence{store,backend,stubbed,survivesOnlineReload}`, `receipt.source{repository,ref,tagKind,revision,rootTreeSha,archiveSha256,archiveBytes,frontendRoot,license,licenseSha256}`, `receipt.locality{...}`, `receipt.readiness.angularLineage{ready:1,total:4,counted:false}`.
- **trust**: `ANGULAR_TINY_TRANSLATOR_TRUST_RECEIPTS=26`, `_MATRIX_CELLS=24`; wire `verifyTrustReceipt` dispatch + has\*Receipts flag + receipts[] + the matrix-cell-count disjunction arm + the verify cell block (mirror the jira-clone verify block) + the generate matrix-cell block (mirror the jira/factoriolab block) + render.ts verified flag + prose (angularLineage stays 2/4, new cell visible-but-uncounted).
- **MEASURED targets** (pin what reality yields, report if different): 26 receipts / 19 verticals / 11 apps / 24 matrix cells, resolvedDependencies 39. angularLineage judgeCounting stays 2/4 (counted:false).
- **Order of ops**: (1) write all source, (2) tsc/lint green, (3) run the append fixture --append for real, (4) vp pack, (5) trust:generate, (6) full 7-gate verify, (7) move pins to the measured values (`core/test/corpus-conformance.test.ts`, `cli/test/aggregate-pre-append.ts`, `trust/test/trust-package.test.ts`, staged-copy re-append tests).

Both revisions pass the existing generic admission — no payment-signals change, no scan trip expected (a trip is blocked, not worked around).

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `packages/trust/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`

## Forbidden moves

- No other packages/core/src changes (incl. payment-signals.ts); no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened; rows derive from receipts; no hand-edited evidence; no forced cells; counted flags untouched. No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

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

If any count cannot derive, any pin would loosen, a scan trips, or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
