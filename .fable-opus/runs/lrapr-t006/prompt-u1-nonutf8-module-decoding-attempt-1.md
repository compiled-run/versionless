Fable-Opus-Unit: lrapr-t006/u1-nonutf8-module-decoding
Fable-Opus-Timeout-Minutes: 35

## Goal

Implement the holdout-named generic capability in /Users/jacksm5pro/dev/open-source/versionless: **non-UTF-8 module source decoding** for the CRA→Vite adapter path. The T008 holdout falsified the frozen adapter exactly here (canonical receipt `evidence/runs/holdout-react-cypress-rwa/receipt.json`, digest 7ec6f18b): rolldown refuses module sources that are not valid UTF-8, while webpack 4 decoded leniently — measured on faker 5.5.3's ISO-8859-1 Italian locale (`node_modules/faker/lib/locales/it/name/first_name.js`, six invalid bytes at recorded offsets: 0xF9 'Esaù', 0xE8 'Giosuè', etc.), reached from production code via faker's eager locale index. The adapter surface is OFFICIALLY REOPENED for this tranche (T999 audit; the d9f75ef6 freeze is superseded — a NEW Judge freeze boundary comes before any holdout re-run; record in the capability docs that it postdates the tranche-one freeze).

Capability spec:

1. Generic detection + decoding: when a module source fails UTF-8 validation during the adapter's dependency processing, decode it per webpack 4's actual lenient semantics (it read files as UTF-8 with replacement/latin1 fallback behavior — MEASURE what webpack 4.44 actually did with these exact bytes rather than assuming: the baseline dist exists in `.versionless/cache/react-cypress-rwa-baseline` and contains the strings webpack actually emitted for those names; your decoded output must match the baseline's observable behavior, byte-provable). The capability must be keyed on measured encoding facts (invalid-UTF-8 byte detection, best-effort legacy decode per the observed webpack semantics), never on package names or paths.
2. Scope honesty: the capability handles dependency (node_modules) sources; state exactly what it does NOT claim (e.g. app-source files with invalid UTF-8, BOM cases, UTF-16) — non-claims recorded, negatives tested.
3. Regression fixture: a fixture-scoped minimal reproduction (an invalid-UTF-8 module in a tiny fixture graph) proving red-without/green-with, per the repo's fixture idiom — plus the real-world check against the faker bytes from the committed holdout evidence (read-only from the cache; do not re-run the full holdout — that is a later unit under the new freeze).
4. Tests per idiom (positive decode matching webpack-observed output; negatives: valid UTF-8 untouched byte-for-byte, unsupported encodings refuse with a truthful error, no name/path keying — extend the overfitting guard to assert no faker/cypress references in the capability); whole repo gate green.

## File contract

- `packages/frameworks/react/**`
- `packages/core/src/bundlers/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `fixtures/**`
- `evidence/runs/react-cypress-rwa/**`

## Forbidden moves

- No packages/frameworks/angular/**, packages/core/src/{migrations,analysis}/** unless the decoding genuinely lives there architecturally (if so, return blocked naming the exact seam — do not improvise a cross-subtree change); no packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No app/package-name branches in product code; no fabricated evidence; no test weakening; the holdout's canonical FAIL receipt is immutable — this unit does not touch evidence/runs/holdout-react-cypress-rwa/\*\*.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If webpack 4's lenient semantics cannot be established from the baseline evidence (state what you measured), the decoding seam architecturally belongs in a subtree outside the contract, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
