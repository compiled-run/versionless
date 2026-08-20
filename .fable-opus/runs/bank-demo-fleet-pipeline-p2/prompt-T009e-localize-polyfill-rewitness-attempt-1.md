Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T009e-localize-polyfill-rewitness
Fable-Opus-Timeout-Minutes: 30

## Goal

Close the `$localize` defect T009d caught, the standard Angular-9+ way, and prove it with the same live-backend witness that caught it. Expected end state, stated in advance: the migrated lane bootstraps, routes to `/gallery/`, makes the two API calls, renders the three photo tiles — and the live parity record reads `identical: true` on outcome strings that describe a _running application_.

What you inherit — read first:

- `evidence/runs/angular-13cell/pigallery2-live-witness.json` (T009d): the defect verbatim — `ReferenceError: $localize is not defined` at `main.4b2fa472bc230245.js:1:241772`, before bootstrap, zero API calls; the baseline lane's healthy readings (routes to `/gallery/`, `GET /api/notifications` + `GET /api/gallery/content/` both 200, three `app-gallery-grid-photo` tiles, "3 Images / 3 items"); the backend recipe (`.versionless/work/angular-pigallery2/logs/t009d-backend.sh`, era Node 10.24.1, `dist` symlink, port, media at `.versionless/work/angular-pigallery2/serve/media/`).
- The 13cell work area: `.versionless/work/angular-pigallery2/13cell/` — package.json, tsconfig.13cell.build.json (its `files` includes `polyfills.ts`), angular.json, the T009b build recipe and `t009b-migrated-run1/2` outputs.
- The open question T009d posed: no rebuild with `@angular/localize/init` was attempted, so sufficiency is NOT established. This unit establishes it.

Deliver:

1. **The fix, the standard way:** add `@angular/localize@13.4.0` as a dependency of the 13cell work area (consented install — `VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=VL-LEGACY-CORPUS-2026-08-10`; this is exactly what `ng add @angular/localize` does) and `import '@angular/localize/init';` at the top of the polyfills file the build already includes. Nothing else. If the CLI offers the canonical `ng add` path at 13.3.11 offline-after-install, prefer it; otherwise the two edits by hand are the documented equivalent — say which you did. This becomes migration-delta item 8 (T009b counted 7).
2. **Rebuild the migrated lane TWICE** (same commands as T009b), byte-compare; record the new webpack hash and whether `$localize` references remain unresolved in the emitted main bundle (grep the bundle for `$localize` — the tag should now be defined at runtime by the polyfill; presence of the identifier is fine, the polyfill defines it).
3. **Re-witness live**, exactly the T009d recipe: era backend at Node 10.24.1, dist symlink at the NEW migrated build, same three PNGs, same witness-host driver (`t009d-live-witness.mjs` — reuse it; adjust only paths), serialized after a fresh baseline pass (re-run the baseline too so both readings are from the same session), loopback-only.
4. **Publish** `evidence/runs/angular-13cell/pigallery2-live-witness-2.json` (schema `versionless.angular-13cell-live-witness.v1`, same shape as T009d's): both lanes' outcomes verbatim, `parity`, the fix recorded as `migrationDelta.item8` (dependency + one-line polyfill import, and WHY: Angular 9+ builds emit `$localize`-tagged i18n constants that need the runtime tag even when the app itself uses no template i18n), `notEstablished`, integrity. Update the README. Do NOT edit T009d's record — it stands as the catch.
5. If the rebuilt lane STILL fails to bootstrap (a second defect behind the first), record the new error verbatim, publish, and return `blocked` naming it — that is a finding about the cell, not a failure of this unit.

Budget: 30 minutes. Fix + rebuild by minute 12; witness both lanes by minute 22; publish + verify from minute 24.

## File contract

- `.versionless/work/angular-pigallery2/**`
- `.versionless/cache/**`
- `evidence/runs/angular-13cell/**`
- `evidence/runs/witness-synthesized/**`

## Forbidden moves

- Do not write inside `packages/**`. Why: measurement units; the cell enters the pipeline in T010.
- Do not edit T009d's published record. Why: it is the catch; this unit's record is the fix.
- Do not fix anything beyond the two named edits (dependency + polyfill import). Why: the claim is that the STANDARD migration step closes the defect; a broader fix is a different claim.
- Do not modernize the backend; era Node 10.24.1 stays. Why: era fidelity.
- Loopback only; consented fetch only for @angular/localize; no media fetches. Why: gates and posture.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular-13cell/pigallery2-live-witness-2.json');if(r.schemaVersion!=='versionless.angular-13cell-live-witness.v1')throw new Error('schema');for(const k of ['baseline','migrated']){const l=r.lanes&&r.lanes[k];if(!l)throw new Error(k+' missing');if(l.successfulNonLoopback!==0)throw new Error(k+' nonLoopback');if(!Array.isArray(l.outcomes)||!l.outcomes.length)throw new Error(k+' outcomes')}if(!r.parity||typeof r.parity.identical!=='boolean')throw new Error('parity');if(!r.migrationDelta||!r.migrationDelta.item8)throw new Error('item8 missing');if(!Array.isArray(r.notEstablished)||!r.notEstablished.length)throw new Error('notEstablished');if(!r.integrity||!r.integrity.sha256)throw new Error('integrity');console.log('13CELL-LIVE-WITNESS-2 ok: identical='+r.parity.identical)"
test -f evidence/runs/angular-13cell/README.md && echo RECIPE-README-PRESENT
git diff --quiet HEAD -- packages/ && echo NO-PACKAGE-CODE-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: @angular/localize@13.4.0 cannot be installed under consent; the rebuilt lane fails to bootstrap on a NEW error (publish it verbatim first); or the backend/witness recipe from T009d no longer reproduces (name what changed).
