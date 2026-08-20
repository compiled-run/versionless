Fable-Opus-Unit: lrapr-t004/t004-c1-papercups-fixture-ts
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Make `react-papercups-v1-0-0` a first-class fixture of the Versionless generic ingest machinery, in strict TypeScript. Isolated worktree; bootstrap with `pnpm install --prefer-offline`.

Background: a completed ingest lane produced canonical evidence for papercups v1.0.0, but the CLI `fixture:ingest` allowlist and the tier-f `FixtureId` union are closed lists that don't know this candidate, and the lane's five ad-hoc `.mjs` drivers violate the strict-TS policy so they were not merged. Their content is preserved on branch `worktree-agent-aeb089a27a4e00e12` (read it with `git show worktree-agent-aeb089a27a4e00e12:evidence/ingests/react-papercups-v1-0-0/<file>`; drivers: probe.mjs, blob.mjs, acquire.mjs, closure.mjs, baseline.mjs; data: admission.json, license.json, provenance.json, attempt.json, source.json, closure.json, baseline-attempt.json, probe-ledger.ndjson, probe-tree.json; plus fixtures/react-papercups-v1-0-0/fixture.json).

Do, in order:

1. Copy the evidence DATA files (json/ndjson, NOT the .mjs drivers) and fixture.json from that branch into your worktree at their canonical paths (they are in your contract).
2. Port the drivers' acquisition/closure/baseline logic into the cli fixture machinery as strict-TypeScript, GENERIC and parameterized by fixture configuration — not a papercups-named exported product API; follow the repo's existing fixture-scoped idioms (see how existing tier-f fixtures are wired), use magic-regexp for regexes, pathe for paths, ufo for URLs. Extend the tier-f `FixtureId` union / `fixture:ingest` allowlist to include `react-papercups-v1-0-0`.
3. Implement an OFFLINE verification path (command or test — match repo idiom) that validates the papercups ingest evidence's internal consistency: source archive digest fields, blob-manifest reconciliation counts, closure totals, license digest, baseline-attempt shape. No re-acquisition, no network — this validates documents, not remotes.
4. Add/extend tests covering the new wiring, and leave the whole repo gate green.

## File contract

- `packages/cli/src/**`
- `packages/cli/test/**`
- `evidence/ingests/react-papercups-v1-0-0/**`
- `fixtures/react-papercups-v1-0-0/**`

## Forbidden moves

- No network. Why: everything needed is on the review branch and in the store.
- No `.js`/`.mjs`/`.cjs` files; strict TypeScript only, with magic-regexp/pathe/ufo policy.
- No writes to packages/core/**, packages/frameworks/**, packages/trust/**, scripts/**, docs/\*\*, or any other evidence directory. Why: parallel-lane disjointness (another unit owns other ingest dirs) and this unit is fixture wiring, not adapter work.
- Do not alter the evidence data values themselves — copy them verbatim; your verification must validate what the lane produced, not repair it. If a document is internally inconsistent, that is a blocked finding, not something to fix silently.
- Do not weaken or delete existing tests. Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c '! find evidence/ingests fixtures packages/cli -name "*.mjs" -newer package.json | grep -q .'
```

## Blocked permission

If the drivers' logic cannot be expressed generically without redesigning the tier-f machinery, if the evidence documents turn out internally inconsistent, or if the wiring genuinely requires files outside the contract, return status "blocked" with specifics in open_questions.
