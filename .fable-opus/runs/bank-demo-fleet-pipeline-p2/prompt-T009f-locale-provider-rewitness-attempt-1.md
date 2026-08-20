Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T009f-locale-provider-rewitness
Fable-Opus-Timeout-Minutes: 30

## Goal

Close the second i18n defect the migration-faithful way, re-witness live, and this time judge the lanes on **application-level signals, not `parity.identical`** — T009e proved that flag can read TRUE across one healthy and one broken lane. Expected end state, stated in advance: the migrated lane bootstraps, routes to `/gallery/`, makes `GET /api/notifications` and `GET /api/gallery/content/` (both 200), renders three `app-gallery-grid-photo` tiles and "3 Images / 3 items" — the baseline's exact healthy readings from T009d.

What you inherit — read first:

- `evidence/runs/angular-13cell/pigallery2-live-witness-2.json` (T009e): defect two verbatim — `Cannot find module './messages.en-US.xlf'` from `translationsFactory` at `13cell/frontend/app/app.module.ts:114-123` (`{provide: TRANSLATIONS, useFactory, deps:[LOCALE_ID]}`; the factory guards on `locale === 'en'` exactly); Angular 13 dropped `--i18n-locale`, so `LOCALE_ID` falls back to `'en-US'`. The trap section (`headline.theTrap`) — your verify must not repeat it.
- The recipes: `.versionless/work/angular-pigallery2/logs/t009e-migrated-build.sh`, `t009e-backend.sh`, and the T009d witness driver. Reuse; adjust only paths.
- T009d's baseline readings (the target): routes to `/gallery/`, two 200 API calls, three tiles, "3 Images / 3 items".

**PM ruling on the fix (decided, do not re-litigate):** provide `{ provide: LOCALE_ID, useValue: 'en' }` in the app module — the direct, migration-faithful translation of the dropped `--i18n-locale en` flag (the baseline's `LOCALE_ID` WAS 'en', supplied by that flag; this reproduces the era semantics in the one place Angular 13 allows). Do NOT widen the app's guard to `startsWith('en')` — that changes app logic beyond what the era flag did. This is migration-delta item 9: a removed CLI flag translated to its provider equivalent, one import (`LOCALE_ID` from `@angular/core`) + one provider line in `13cell/frontend/app/app.module.ts`. Nothing else.

Deliver:

1. The two-line edit above in the 13cell work area. Rebuild the migrated lane TWICE (t009e recipe), byte-compare, record the webpack hash and which chunks changed (expect main to change this time — the module changed).
2. Re-witness BOTH lanes live in one session (era backend Node 10.24.1, dist symlink, same three PNGs, serialized, loopback-only).
3. **Publish** `evidence/runs/angular-13cell/pigallery2-live-witness-3.json` (same schema family, `versionless.angular-13cell-live-witness.v1`): both lanes verbatim; `migrationDelta.item9` (the provider, and WHY: the dropped flag's provider translation); and — the lesson applied — an `applicationSignals` block PER LANE: `{ bootstrapped: bool, routedTo: <path>, apiCalls: [{url, status}...], gallery: {tiles: n, summaryText: <verbatim|null>}, consoleErrors: [verbatim...] }`, read from the witness host's page/network observations. `parity` must compare THESE, not just outcome strings: `parity.applicationSignalsIdentical` alongside `parity.outcomeStringsIdentical`, and if the two flags disagree, say which is authoritative (signals) and why. `notEstablished` carries: outcome-string parity alone cannot distinguish a healthy from a broken lane in this app class (the T009e trap, restated); auth/settings surfaces untested; 3-image generated gallery only. Integrity sha256. README updated.
4. If a THIRD defect appears behind this one, publish it verbatim and return `blocked` naming it. If the gallery readings match the baseline exactly, say so plainly: the Angular 8 → 13 migration of pigallery2 is live-witnessed end to end, with a nine-item delta, on this evidence.

Budget: 30 minutes. Edit + rebuild by minute 10; witness both by minute 20; publish + verify from minute 24.

## File contract

- `.versionless/work/angular-pigallery2/**`
- `.versionless/cache/**`
- `evidence/runs/angular-13cell/**`
- `evidence/runs/witness-synthesized/**`

## Forbidden moves

- Do not write inside `packages/**`. Why: the vocabulary gap T009e exposed is a later code unit with its own gates; this unit reads the host's observations into its own record instead.
- Do not widen the app's locale guard or make any edit beyond the LOCALE_ID provider. Why: the claim is that the removed flag's provider translation suffices; anything more is a different claim.
- Do not edit T009d's or T009e's records. Why: they are the catch chain.
- Era backend stays Node 10.24.1; loopback only; consented fetches none (everything is on disk). Why: fidelity, gates, posture.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular-13cell/pigallery2-live-witness-3.json');if(r.schemaVersion!=='versionless.angular-13cell-live-witness.v1')throw new Error('schema');for(const k of ['baseline','migrated']){const l=r.lanes&&r.lanes[k];if(!l)throw new Error(k+' missing');if(l.successfulNonLoopback!==0)throw new Error(k+' nonLoopback');const a=l.applicationSignals;if(!a||typeof a.bootstrapped!=='boolean'||!Array.isArray(a.apiCalls))throw new Error(k+' applicationSignals')}const m=r.lanes.migrated.applicationSignals;if(!m.bootstrapped)throw new Error('migrated did not bootstrap: '+JSON.stringify(m.consoleErrors||[]).slice(0,300));if(!m.apiCalls.some(c=>/gallery\/content/.test(c.url)&&c.status===200))throw new Error('migrated made no 200 gallery API call: '+JSON.stringify(m.apiCalls).slice(0,300));if(!(m.gallery&&m.gallery.tiles===3))throw new Error('migrated tiles '+(m.gallery&&m.gallery.tiles));if(!r.migrationDelta||!r.migrationDelta.item9)throw new Error('item9 missing');if(typeof r.parity.applicationSignalsIdentical!=='boolean')throw new Error('parity.applicationSignalsIdentical missing');console.log('13CELL-LIVE-WITNESS-3 ok: signals identical='+r.parity.applicationSignalsIdentical+' migrated tiles=3, gallery API 200')"
test -f evidence/runs/angular-13cell/README.md && echo RECIPE-README-PRESENT
git diff --quiet HEAD -- packages/ && echo NO-PACKAGE-CODE-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: a third defect appears (publish it verbatim first); the provider translation does not resolve LOCALE_ID as expected (say what LOCALE_ID actually resolved to); or the witness host's observations cannot yield the applicationSignals block without a packages/ change (name the seam — then publish outcome strings plus your driver's own page/network readings and say which source each signal came from).
