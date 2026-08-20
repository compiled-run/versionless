Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T009c-pigallery2-witness-parity
Fable-Opus-Timeout-Minutes: 30

## Goal

The browser proof for the Angular 13 cell: witness **both pigallery2 lanes** — baseline (Angular 8 build) and migrated (13-cell build) — with real Chromium, serialized, loopback-only, using the pipeline's synthesized-witness machinery, and publish a parity record with bounded, measured-pins outcomes. This is the last proving step before T010's freeze supersession: it turns "both lanes build byte-identically" into "both lanes serve and the migrated lane measures the same on the surfaces reached."

What you inherit — read first:

- `evidence/runs/angular-13cell/pigallery2-lanes.json` (T009b): baseline `t009b-baseline-run1` under `.versionless/work/angular-pigallery2/baseline/`, migrated `t009b-migrated-run1` under `.versionless/work/angular-pigallery2/13cell/` — 13 files each, byte-identical double builds. The record's `notEstablished` explicitly leaves runtime behaviour unproven; this unit proves the bounded slice of it.
- The synthesized-witness path (T006/T019/T020): `packages/cli/src/witness/real-app-run.ts` `runSynthesizedWitnessRealApp` — driver selection records `journeySource`; pigallery2 has NO hand-authored driver in `packages/cli/src/witness/` (verify: no `pigallery2-run.ts`), so the synthesized path is the default, no `--journeys` override needed. Crawl fallback (pigallery2 ships no Cypress/Playwright suite — verify in the baseline tree). Loopback gate `successfulNonLoopback: 0`. Chromium resolves from the host Playwright install (T037's browser.ts).
- Precedent record shape: `evidence/runs/witness-synthesized/react-papercups-v1-0-0/record.json` (T020) — journey outcomes are the closed measured-pins vocabulary; `replayabilityRatio` recomputed by the parser.
- IMPORTANT CAVEAT the record must state: pigallery2 is a client-server app (the frontend expects its Express/backend API). Served statically on loopback, API calls will fail — the crawl measures the shell/login surface, not the gallery. That is a BOUNDED outcome, exactly like the eShop precedent; the vocabulary has strings for reached/not-reached. Do not stub a backend, do not fake API responses.

Deliver:

1. **Witness the baseline lane** (`t009b-baseline-run1` output as the served tree) through `witness:real-app` / the synthesized path — one journey set, serialized, loopback-only. Then **witness the migrated lane** (`t009b-migrated-run1`). Use the same crawl parameters (depth, route cap) for both so the comparison is like-for-like.
2. **Publish** `evidence/runs/angular-13cell/pigallery2-witness-parity.json` (schema `versionless.angular-13cell-witness-parity.v1`): per lane — the witness record digest, journeySource, journeys run, per-journey outcome strings VERBATIM from the closed vocabulary, successfulNonLoopback (must be 0); a `parity` block comparing the two lanes' outcome strings (identical | differing, named); the client-server caveat in `notEstablished` (what a static loopback serve can and cannot measure for this app); integrity sha256. Update the README.
3. If the witness machinery cannot serve an Angular-8-era `index.html` (base href, hashing, whatever) — that is a finding about the generic runner, name it verbatim and block; do not hand-edit the built lanes.

Budget: 30 minutes. Baseline witness by minute 10, migrated by minute 18, publish + verify from minute 20. If one lane witnesses and the other cannot, publish the one with the failure named and return `blocked` — not `partial`.

## File contract

- `.versionless/work/angular-pigallery2/**`
- `evidence/runs/angular-13cell/**`
- `evidence/runs/witness-synthesized/**`

## Forbidden moves

- Do not write inside `packages/**`. Why: the runner is proven (T020, T042); if it cannot handle this app, that is a named finding for a code unit with its own gates.
- Do not stub, mock, or fake the pigallery2 backend, and do not let any journey leave loopback. Why: `successfulNonLoopback: 0` is the gate; a faked API is a faked measurement.
- Do not hand-edit the built lane outputs or any published record. Why: emitted artifacts only.
- Do not run the two lanes' witnesses concurrently. Why: witness serializes per host.
- Do not use outcome strings outside the closed vocabulary. Why: the honesty guard; bounded outcomes stay bounded.
- Consented fetches: none should be needed (everything is on disk). Why: audited posture.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular-13cell/pigallery2-witness-parity.json');if(r.schemaVersion!=='versionless.angular-13cell-witness-parity.v1')throw new Error('schema');for(const k of ['baseline','migrated']){const l=r.lanes&&r.lanes[k];if(!l)throw new Error(k+' missing');if(l.successfulNonLoopback!==0)throw new Error(k+' nonLoopback '+l.successfulNonLoopback);if(!Array.isArray(l.outcomes)||!l.outcomes.length)throw new Error(k+' outcomes')}if(!r.parity||typeof r.parity.identical!=='boolean')throw new Error('parity');if(!Array.isArray(r.notEstablished)||!r.notEstablished.some(x=>/backend|API|server/i.test(x)))throw new Error('client-server caveat missing');if(!r.integrity||!r.integrity.sha256)throw new Error('integrity');console.log('13CELL-WITNESS-PARITY ok: identical='+r.parity.identical+' baseline outcomes '+r.lanes.baseline.outcomes.length+' migrated '+r.lanes.migrated.outcomes.length)"
test -f evidence/runs/angular-13cell/README.md && echo RECIPE-README-PRESENT
git diff --quiet HEAD -- packages/ && echo NO-PACKAGE-CODE-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the generic runner cannot serve either lane (name the error verbatim); Chromium cannot launch; or a journey cannot run without leaving loopback beyond what the bounded vocabulary can honestly record.
