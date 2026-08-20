Fable-Opus-Unit: bank-demo-fleet-pipeline-p2e/T024-derive-provenapps
Fable-Opus-Timeout-Minutes: 35

## Goal

Board task T024, the oracle's capability conjunct: derive each capability's `provenApps` from the receipt set instead of the string-literal arrays in `packages/core/src/receipts/capability-coverage.ts`, so a future capability proof enters the matrix WITHOUT a source edit — the capability matrix must be able to move strictly above the sealed baseline by derivation, exactly as the application coverage learned to in T028/T033 (run records entered the coverage report by derivation; this is the same move one level up).

The bar: the derivation must reproduce EXACTLY the current sealed numbers — 8 cross-proven / 51 experimental of 59 at threshold 2 — and `evidence/trust/current/capability-coverage.json` must come out BYTE-IDENTICAL from `trust:generate` after the change (the emitted artifact is the proof the derivation equals the literals it replaces). If any capability's derived provenApps differ from its literal array, THAT IS A FINDING: either the literal was wrong (name it, with the receipts that prove it) or the derivation is (fix it). Do not paper over a mismatch by special-casing.

Approach constraints:

1. Read `packages/core/src/receipts/capability-coverage.ts` end to end first: entry shape, where provenApps literals live, what `buildCapabilityCoverage()` computes, the threshold-2 cross-proven rule, and how `packages/core/test/capability-coverage.test.ts` pins it.
2. The honest source for "which applications proved capability X" is the receipt set this repository already seals — find where receipts record capability attribution (the sealed corpus receipts in `packages/core/src/receipts/`, their entryPoints/capabilities fields, and whatever T021/T024-era wiring exists — the freeze record's `capabilitiesExtracted` slices name capabilities per reopen). If the receipts do NOT carry per-app capability attribution today, STOP BLOCKED with the exact gap — inventing an attribution source is the misfire this task exists to avoid.
3. The literals may remain in the file as HISTORY (a sealed-baseline record) if the derivation needs a baseline to compare against — but the LIVE surface (`buildCapabilityCoverage()` output) must come from derivation. Follow whatever pattern `deriveRunRecordApplications`/`runRecordSource` set in T033/T034 (the trust package's model for literal→derived transitions).
4. Tests: derivation reproduces the sealed numbers; a synthetic receipt carrying a new capability proof moves the derived matrix WITHOUT a source edit (the test constructs it in memory, not on disk); threshold-2 boundary pinned; mismatch between literal-baseline and derivation is a NAMED failure, not silence.
5. `trust:generate` (offline env, u10 ordering if census moves — it should not; this touches no operator refusal site) then `trust:verify`; the byte-identity of capability-coverage.json is the acceptance test. If byte-identity is impossible because the derived form legitimately carries MORE information (per-app basis fields), the emitted artifact may change shape ONLY with the totals {8,51,59} reproduced and the change described field-by-field in your receipt — and say so in open_questions rather than deciding alone if the shape change is substantial.

GUARDS: coverage totals {23,11,2,5,5}; matrix react 6/6 + angular 4/4; composite `140ce86e`; census 196 (unmoved expected); frozen subtrees and packages/trust/src untouched — wait: `packages/trust/src` untouched UNLESS the derivation seam genuinely lives there (T033 put derivation in trust/src/coverage-report.ts); if you must touch `packages/trust/src/**`, it is IN CONTRACT below but freeze.ts is NOT — freeze.ts is u10's single point forever.

## File contract

- `packages/core/src/receipts/capability-coverage.ts`
- `packages/core/src/receipts/*.ts`
- `packages/core/test/**`
- `packages/trust/src/coverage-report.ts`
- `packages/trust/src/generate.ts`
- `packages/trust/test/**`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- Do not touch `packages/trust/src/freeze.ts`, `packages/frameworks/**`, or `packages/core/src/{migrations,bundlers,analysis}/**`. Why: the supersession point and the frozen subtrees are owner territory.
- Do not weaken threshold 2 or change what cross-proven means. Why: the sealed baseline's semantics are the oracle's denominator.
- Do not edit any sealed receipt's substantive content — reading them is the point; changing them to make attribution derivable is manufacturing evidence. (Adding a well-typed accessor/export that exposes what a receipt already states is fine; changing what it states is not.)
- No git commit, no stash/checkout/reset/clean.

## Verification

```verify
pnpm exec vp test --project node
npm run trust:verify -- --offline
node -e "const c=require('./evidence/trust/current/capability-coverage.json');const s=c.summary||c;const a=s.angular&&s.angular.total?s:c;console.log(JSON.stringify(a).slice(0,200));"
node -e "const r=require('./evidence/trust/current/coverage-report.json');const cb=r.sealedBaseline&&r.sealedBaseline.capabilities;if(!cb)throw new Error('no capabilities baseline');if(cb.crossProven!==8||cb.total!==59||cb.experimental!==51)throw new Error(JSON.stringify(cb));console.log('CAPABILITY-NUMBERS-REPRODUCED 8/51/59')"
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/trust/src/freeze.ts packages/frameworks packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-POINT-AND-SUBTREES-UNTOUCHED
```

## Blocked permission

If the receipts do not carry per-app capability attribution (the honest source does not exist), if byte-identity conflicts with a legitimately richer derived shape, or if any literal-vs-derived mismatch cannot be resolved by naming which side is wrong, return status "blocked" with the question in open_questions instead of improvising.
