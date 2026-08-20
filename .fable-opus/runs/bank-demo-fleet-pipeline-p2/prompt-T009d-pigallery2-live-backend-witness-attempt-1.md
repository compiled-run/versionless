Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T009d-pigallery2-live-backend-witness
Fable-Opus-Timeout-Minutes: 30

## Goal

Get the pigallery2 witness past the static shell: stand up **pigallery2's own Express backend** (the app renders `index.html` server-side — T009c proved a static serve can never bootstrap it), point it at each built lane in turn, witness both through the pipeline's witness host with real Chromium, loopback-only, and publish a parity record whose outcomes are about the **running application**, not the loading shell. This is the browser proof T010's freeze supersession needs.

What you inherit — read first:

- `evidence/runs/angular-13cell/pigallery2-witness-parity.json` (T009c): the EJS finding verbatim (`<base href="<%= clientConfig.urlBase %>/">`, `ServerInject`), six identical shell outcomes, and the conclusion that a gallery-reaching witness needs the live-backend seam.
- The app: `.versionless/work/angular-pigallery2/baseline/` — `"main": "./backend/index.js"`, `"start": "node ./backend/index"`. Its Express server renders index.html and serves the frontend from a configured directory. Read `backend/` enough to find: how the frontend dist directory is configured (config file / env / CLI flag), what persistent state it needs (SQLite by default in this era, a media/images directory, a config dir), and what port it binds.
- The live-backend precedent: `packages/cli/src/witness/live-backend.ts` — how the eShop witness declared a live backend origin (loopback), what the witness host permits (`isWitnessLoopbackUrl`), and how bounded outcomes were recorded on a live surface. You are OPERATING this seam, not changing it.
- Node runtimes on disk: node-v10.24.1 x64 (era, works under Rosetta — T009b) in `angular-pigallery2-v1-7-0-runtime`; node-v16.20.2 in the 13cell runtime cache.
- A frozen media tree: the backend needs a gallery directory. Create a TINY deterministic one in the work area (3–5 small images you GENERATE locally — solid-color PNGs via a node script are fine; no fetches) so the gallery surface has content whose rendering can be measured identically across lanes.

Deliver:

1. **Backend recipe** in `.versionless/work/angular-pigallery2/logs/t009d-backend.sh` + config: run pigallery2's backend at its era Node (10.24.1 — the backend is the era artifact; do NOT modernize it), configured to serve lane 1 (baseline build) from a loopback port, with the generated media dir and a scratch SQLite/config dir. Wait for readiness (poll the port). Then the same for lane 2 (migrated build) — same backend, same media, different frontend dist dir. One at a time, serialized.
2. **Witness each** through `witness:real-app` synthesized path against the live backend origin (the runner's `--baseline`/`--migrated` may point at built dirs while the served origin is the backend — read how live-backend.ts declared this for eShop and follow that pattern; if the CLI cannot take a live origin for a synthesized run, run the witness host directly the way the eShop fixture did and say so). Loopback only; `successfulNonLoopback: 0`.
3. **Publish** `evidence/runs/angular-13cell/pigallery2-live-witness.json` (schema `versionless.angular-13cell-live-witness.v1`): per lane — backend origin, readiness time, journeys, outcome strings VERBATIM (closed vocabulary), routes reached (the gallery route reached or honestly not), successfulNonLoopback; `parity` (identical | differing named); `media` (the generated set, digests); `notEstablished` (a 3-image generated gallery is not the fleet's media diversity; auth surfaces untested if not reached; etc.); integrity sha256. Update the README.
4. If the era backend cannot run on this host (native dep, port, SQLite build), name it verbatim and — fallback — run the backend at Node 16 ONLY for serving purposes, recording that the backend era moved for the serve and what that does and does not bound. If neither runs, block with the exact error.

Budget: 30 minutes. Backend up + lane 1 witnessed by minute 14; lane 2 by minute 22; publish + verify from minute 24. If lane 2 cannot finish, publish lane 1 with the failure named and return `blocked` — not `partial`.

## File contract

- `.versionless/work/angular-pigallery2/**`
- `.versionless/cache/**`
- `evidence/runs/angular-13cell/**`
- `evidence/runs/witness-synthesized/**`

## Forbidden moves

- Do not write inside `packages/**`. Why: the witness machinery is proven; if it cannot take a live origin, run the host directly per the eShop precedent and record it — code changes get their own unit.
- Do not modernize the backend (its era is the point), and do not hand-edit the built lane outputs. Why: era fidelity; emitted artifacts.
- Do not fetch media or anything else from the network; generate the gallery locally. Why: consent posture; determinism.
- Do not let any journey leave loopback; the backend binds loopback only. Why: `successfulNonLoopback: 0` is the gate.
- Outcome strings only from the closed vocabulary. Why: the honesty guard.
- Do not run the two lanes' witnesses concurrently, and kill the backend between lanes. Why: witness serializes; a shared warm backend could mask a lane difference.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular-13cell/pigallery2-live-witness.json');if(r.schemaVersion!=='versionless.angular-13cell-live-witness.v1')throw new Error('schema');for(const k of ['baseline','migrated']){const l=r.lanes&&r.lanes[k];if(!l)throw new Error(k+' missing');if(l.successfulNonLoopback!==0)throw new Error(k+' nonLoopback');if(!Array.isArray(l.outcomes)||!l.outcomes.length)throw new Error(k+' outcomes')}if(!r.parity||typeof r.parity.identical!=='boolean')throw new Error('parity');if(!r.media||!Array.isArray(r.media.files)||!r.media.files.length)throw new Error('media');if(!Array.isArray(r.notEstablished)||!r.notEstablished.length)throw new Error('notEstablished');if(!r.integrity||!r.integrity.sha256)throw new Error('integrity');console.log('13CELL-LIVE-WITNESS ok: identical='+r.parity.identical+' outcomes '+r.lanes.baseline.outcomes.length+'/'+r.lanes.migrated.outcomes.length)"
test -f evidence/runs/angular-13cell/README.md && echo RECIPE-README-PRESENT
git diff --quiet HEAD -- packages/ && echo NO-PACKAGE-CODE-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the era backend cannot run AND the Node-16 fallback cannot either (exact errors verbatim); the witness host cannot be pointed at a live loopback origin without a packages/ change (name the seam); or the gallery route cannot be reached on EITHER lane (then the bounded shell outcome from T009c stands and T010's claim must be priced on it — say so).
