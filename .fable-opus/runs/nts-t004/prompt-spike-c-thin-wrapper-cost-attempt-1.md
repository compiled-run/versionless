Fable-Opus-Unit: nts-t004/spike-c-thin-wrapper-cost
Fable-Opus-Timeout-Minutes: 60
Fable-Opus-Effort: high
Effort-Justification: This spike measures the true post-industrialization per-app cost — the number the owner's end-to-end-automation decision will be priced on — by running a never-completed app through the frozen React adapter via the thin-wrapper path with honest per-stage clocking; conflating authoring time with machine time or fudging a bounded outcome would misprice the whole next tranche.

## Goal

SPIKE C (T003 Judge package) in /Users/jacksm5pro/dev/open-source/versionless: measure the REAL amortized per-app cost after industrialization. Candidate: `react-shlink-web-client` (existing consented ingest at evidence/ingests/react-shlink-web-client/); fallback `react-sqlpad-v5-5-0`. UNCOUNTED spike evidence only — no matrix/coverage/corpus changes.

Do, clocking wall-time per stage and counting new TS lines as you go (the LEDGER of costs is the product of this spike):

1. LICENSE PRE-SCREEN (mandatory gate zero, T018-u1 method): license-text-at-pin MIT with recorded licenseSha256 at the exact pinned revision recorded in the existing ingest. If it fails, fall back to react-sqlpad-v5-5-0; if both fail, blocked (that is a finding).
2. COMPLETE THE INGEST if partial (double-fetch byte-identical archive at pin, sha256, parity — the established method; consent VL-LEGACY-CORPUS-2026-08-10, URLs recorded; offline after).
3. BASELINE: era cell per the app's own declarations; install; production build x2 byte-compared (the app is CRA/webpack-era React — record what it actually is).
4. MIGRATE under the FROZEN React adapter (composite 27741d9c — recompute before/after; zero frozen-subtree edits; a gap is a named finding, never a fix): operator/fixture flow, install, build x2 byte-compared.
5. WITNESS via the THIN-WRAPPER path ONLY: per-app wrapper <= ~120 lines over real-app-run.ts (the dejavu/fuxa pattern), generic witness-real-app schema, NO per-app module in packages/core/src/receipts (if one appears required, that IS the finding — record and stop witness work). 2+2 serialized passes with calibration (max 3 calibration rounds; overrun is itself the answer). Real interactions, settled anchors, locality, honest bounded outcome if surfaces are limited.
6. EVIDENCE to evidence/spikes/thin-wrapper-cost/: per-stage wall-clock ledger, new-TS-line count by file, outcomes (build digests, witness digests or bounded-outcome wording), capability firings observed (recorded only — no coverage regeneration), and the verdict: is ~3u/app credible post-industrialization? What remains manual and how long did each manual act take?

## File contract

- `evidence/ingests/react-shlink-web-client/**`
- `evidence/ingests/react-sqlpad-v5-5-0/**`
- `evidence/spikes/thin-wrapper-cost/**`
- `packages/cli/src/fixture/react-shlink-web-client-migration-run.ts`
- `packages/cli/src/fixture/react-sqlpad-v5-5-0-migration-run.ts`
- `packages/cli/src/witness/react-shlink-web-client-run.ts`
- `packages/cli/src/witness/react-sqlpad-v5-5-0-run.ts`
- `packages/cli/test/**`
- `docs/goals/next-tranche-strategy/**`

## Forbidden moves

- ZERO frozen-subtree edits (freeze recompute == 27741d9c before/after). No per-app packages/core/src/receipts module (its necessity is a finding, not a task). No packages/cli/src/operator/\* changes. No enterprise-report/capability-coverage/matrix regeneration. No parallel witness passes. Network only for the pinned acquisition/license reads under the consent ID. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes; leave nothing listening.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'node -e "const v=require(\"./evidence/spikes/thin-wrapper-cost/verdict.json\"); if(!v.stageLedger||!v.verdict) throw new Error(\"incomplete\"); console.log(\"thin-wrapper verdict:\", v.verdict.threeUnitsCredible, \"outcome:\", v.verdict.outcome)"'
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 27741d9c && echo FREEZE-INTACT'
```

## Blocked permission

If both candidates fail license-at-pin (bring the texts), the frozen adapter cannot carry the app (named gap = valuable finding, record and stop), a per-app receipts module appears required (record and stop witness), the 5h/3-round budget hits (partials are the answer), or verification fails twice, return status "blocked" with specifics in open_questions instead of improvising.
