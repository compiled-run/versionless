Fable-Opus-Unit: bank-demo-fleet-pipeline-p2c/T043-a-ingest-ledger-revision
Fable-Opus-Timeout-Minutes: 35

## Goal

Item (a) of board task T043, the highest-leverage admission unblocker T012-b1 measured: ingest must be able to adopt the revision from the acquisition ledger that sits in the SAME cache directory as the staged tree — today `ingest.revision-not-determined` refuses 5+ staged corpus apps whose revision is on disk beside them, and the operator's only remedy is hand-carrying `--revision` (which T012-b2 proved works, at the cost of a human reading the ledger — exactly the intervention-shaped friction the one-command goal forbids).

Read first:

- `packages/cli/src/operator/ingest.ts` — the journal seam (~:683-721 region historically; the four gates: source-bound, consentId, parity basis, digest matches walked tree; adoption of commitSha+repository+ref; per-field `*ReadFrom` basis) and the pin assembly. T033/T034 history: gates were never weakened, never added around.
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md` — b1's finding: staged trees under `.versionless/cache/<id>/acquisition/source` refuse at ingest while the acquisition ledger with the revision sits in the same `<id>` directory. b2's run shows what a declared revision produces (`commitShaSource: "declared"`).

What to build: when ingest walks a tree that is the staged output of THIS repository's own acquire (the acquisition ledger/journal in the adjacent directory), the revision reading may be ADOPTED from that ledger through the SAME four-gate discipline the journal seam already applies — the ledger must bind to this source (same source identity/URL), carry the consentId, provide the parity basis, and its digest must match the walked tree; a ledger failing ANY gate leaves the refusal exactly as it is today (`ingest.revision-not-determined`, same message class). An adopted revision records its basis per-field (`commitShaSource`/`*ReadFrom` naming the ledger file path), distinct from `declared` — the record must let a reader tell "operator declared it" from "adopted from the acquisition ledger at <path>". Declared flags still win over adoption. Do NOT invent a second read path — extend the existing journal-seam mechanism to recognize the acquisition-cache layout; if the existing seam ALREADY handles it and merely isn't wired to the cache directory layout, say so in the receipt and wire it minimally.

Tests (`packages/cli/test/operator-ingest.test.ts`): adoption happy path (all four gates pass → pin carries the ledger revision with ledger basis); each gate failing individually → today's refusal unchanged; declared `--revision` beats adoption; the basis field distinguishes declared vs adopted.

Proof on the real corpus: after your change, run the batch/run against ONE of the staged apps b1 enumerated as blocked by `ingest.revision-not-determined` (pick the smallest; the note lists them) WITHOUT any `--revision` flag — ingest must adopt and the run must proceed past stage 2 to whatever honest outcome comes next (likely a later refusal; that is fine and is the point: the wall moves from stage 2 to wherever truth stops it). Record that outcome in a NEW run-record under `evidence/runs/` and publish per the batch ordering if a record lands. Do NOT re-run apps that already have records.

GUARDS: react 6/6 verbatim, angular 4/4 (may only grow), composite `140ce86e`, coverage proven 11 may only grow, census regenerated only if your ingest edits shifted refusal-site lines (they will — ingest.ts is scanned; regenerate and say so).

## File contract

- `packages/cli/src/operator/ingest.ts`
- `packages/cli/test/operator-ingest.test.ts`
- `evidence/runs/**`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- Do not weaken, remove, or reorder any of the four gates; do not add a bypass. Why: the gates are the admission integrity of the whole trust chain — a revision adopted past a failed gate poisons every downstream claim.
- Do not touch `packages/frameworks/**`, `packages/core/src/{migrations,bundlers,analysis}/**`, or `packages/trust/src/**`. Why: composite 140ce86e is one commit old; T044's frozen-cell fix is owner-gated and not yours.
- Do not touch `batch.ts` or `install.ts` — items (b) and (c) are separate units. Why: one admission concern per unit.
- No `git commit`, no `git stash` / `checkout --` / `reset` / `clean`.

## Verification

```verify
pnpm exec vp test --project node
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE-140ce86e')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If the acquisition-cache ledger genuinely cannot satisfy one of the four gates by construction (e.g. it lacks a parity basis), if adoption cannot be expressed without a second read path, or if the staged-app proof run hits something needing a human hand, return status "blocked" with the question in open_questions instead of improvising.
