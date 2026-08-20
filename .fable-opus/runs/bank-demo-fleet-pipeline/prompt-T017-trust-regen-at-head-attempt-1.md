Fable-Opus-Unit: bank-demo-fleet-pipeline/T017-trust-regen-at-head
Fable-Opus-Timeout-Minutes: 25

## Goal

Regenerate the trust package at the current source so `evidence/trust/current/provenance.json` matches the `packages/cli/dist` actually on disk — restoring `npm run trust:verify -- --offline` and the 3 operator-flows tests that call `verifyTrustPackage` — without moving a single sealed number.

Why. `packages/cli/dist/**` is gitignored AND a provenance subject. During an earlier unit, `pnpm exec vp pack` rebuilt dist from current source after trust:verify had already passed; provenance was generated before that. Right now `npm run trust:verify -- --offline` fails at `packages/trust/src/verify.ts:569` with `Error: Provenance subjects differ from the exact distribution inventory`, and `supported-matrix` refuses to render (it verifies trust first at `packages/cli/src/operator/matrix.ts:43`). Three subjects differ: `packages/cli/dist/cli.js` (provenance `48040241…` vs disk `b5744ab2…`), `packages/cli/dist/index.js` (`8e5feacb…` vs `8ca0c409…`), and a chunk renamed `verify-B7NXJ3SC.js` → `verify-CgUOZUgO.js`.

Read first: `packages/trust/src/verify.ts` around :520-575 (the inventory check), `packages/trust/src/generate.ts` (what `trust:generate` writes and from where), `package.json` scripts `trust:generate` / `trust:verify` / `trust:ingest`, and the two precedent unit outcomes `.fable-opus/state/outcome-u3-trust-regen-at-head.json` and `.fable-opus/state/outcome-t003-u7-trust-regeneration.json` — they did this before; follow their shape.

Then: decide whether dist on disk reflects current source deterministically. If yes, do NOT rebuild — regenerate trust against what is there. If dist is itself inconsistent with current source (e.g. partial), you may rebuild ONCE as the very first step, and you must say so explicitly in the receipt, because a rebuild is exactly the action that caused this. Then run the trust regeneration path (`npm run trust:generate` with whatever offline flag it needs — read the script), and confirm every gate below.

Invariants — these are the whole point:

- The freeze composite in `evidence/trust/current/adapter-freeze.json` at `freeze.composite` MUST still begin `27741d9c`. The five frozen subtrees are untouched; a moved composite means the regeneration did something it must not.
- `supported-matrix --offline` MUST render again and MUST still read react **6/6** and angular **4/4**. Record the two counts verbatim from its output in the receipt.
- The capability count stays 8 cross-proven in-matrix. If the enterprise report or capability-coverage.json changes any counted number, stop and report; do not publish.
- The trust digest WILL change (was `572a0f06…` in `manifest.json` and `enterprise-report.json`). That is expected whenever CLI source changes and is chain-recorded. Record old and new digests in the receipt.
- Regenerate from receipts. Do not hand-edit any file under `evidence/trust/current/`.
- Do not restate any bounded claim more generally anywhere.

## File contract

- `evidence/trust/current/**`

## Forbidden moves

- Do not write anywhere under `packages/`. Why: this unit regenerates evidence about the source; it does not change the source. The dirty files under `packages/cli/src/` and `packages/cli/test/` are two earlier units' legitimate uncommitted work — leave them exactly as they are.
- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`; a write there is freeze motion.
- Do not fetch from the network to regenerate. Why: the trust package is an offline-verifiable artifact; if generation needs the network, that is a finding to report as blocked, not something to satisfy.
- Do not run `vp fmt` repo-wide. Why: it touches 249 pre-existing files (a separate later unit).

## Verification

```verify
npm run trust:verify -- --offline
npm run receipt:verify
npm test
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; expected green is 2545/2545 once trust is restored (the 3 current failures are all this cause). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: `trust:generate` requires network access; the regenerated freeze composite or any supported-matrix / capability number differs from the sealed value; or making trust:verify pass would require touching anything under `packages/`.
