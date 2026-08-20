Fable-Opus-Unit: lrapr-t004-hospitalrun/h3b-cra-node-core-modules
Fable-Opus-Timeout-Minutes: 35

## Goal

Close the second proven generic CRA→Vite gap in /Users/jacksm5pro/dev/open-source/versionless and bring HospitalRun's migrated build to boot. Evidence (prior unit): after the global-identifier fix (commit ce2fbb8), HospitalRun's Vite target still fails at load — webpack 4 auto-polyfilled Node core modules via node-libs-browser, Vite resolves them to `__vite-browser-external` stubs, so `require('stream')` yields undefined and readable-stream 1.x throws `TypeError: Object prototype may only be an Object or null: undefined` at `inherits`. Twelve stub requires across `stream` (sublevel-pouchdb + level-iterator-stream + root readable-stream), `util` (BufferList, debuglog), `crypto` (pouchdb-quick-search).

1. Add a generic CRA node-core-module capability to `packages/frameworks/react/src/react-cra-vite-adapter.ts` per the PM ruling: reproduce webpack 4's node-libs-browser resolution table by aliasing each needed core module to the browser shim package resolved FROM THE APPLICATION'S OWN dependency closure (that is what webpack 4 actually did — react-scripts' transitive closure carries the shim packages), failing loudly with a clear error naming the module when the shim is absent from the closure. No app names; wired into `createCraViteAdapter` like the existing capabilities; unit tests per the established idiom (real Vite build of a module using `require('stream')`/`util.inherits`, evaluated in a browser-shaped realm).
2. Rebuild the HospitalRun target ×2 offline — deterministic — and prove BOOT with the repo's Playwright host: `#root` renders non-empty on `/` with zero console errors beyond the known SW-registration inventory. Rebuild the baseline lane ×2 as well (Rosetta Node 12.14.1 cell) so both lanes are fresh under the final adapter.
3. Regenerate the HospitalRun canonical build receipt under `evidence/runs/react-hospitalrun/`: adopt the reproducible papercups digest scheme (sha256(canonicalize(files))) and record it explicitly; record BOTH runtime breaks the gate caught (global identifier; node core modules) and their generic fixes as the migration story; note the superseded receipt's lane digests were not reproducible under any scheme and are replaced.
4. Whole repo gate green. Papercups is NOT touched this unit (its regeneration is scheduled separately).

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/react-hospitalrun/**`
- `fixtures/react-hospitalrun/**`

## Forbidden moves

- No app-name branching in the reusable surface; guard tests stay green. No packages/core/**, packages/trust/**, evidence/runs/react-papercups*/\*\*, evidence/runs/witness-*/**, aggregate.json, evidence/trust/**, evidence/ingests/**, scripts/**, docs/\*\*.
- Do not erase the caught-breaks history — it is the receipt's story. Network only if an install genuinely needs the consented registry (record it). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-hospitalrun/build-profile.json'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a needed shim is absent from the app's closure (name it), boot still fails after this capability (exact error), determinism fails, or the receipt cannot honestly assert a booting build, return status "blocked" with specifics in open_questions.
