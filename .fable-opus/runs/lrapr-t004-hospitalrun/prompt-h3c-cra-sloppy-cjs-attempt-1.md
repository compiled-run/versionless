Fable-Opus-Unit: lrapr-t004-hospitalrun/h3c-cra-sloppy-cjs
Fable-Opus-Timeout-Minutes: 35

## Goal

Close the third proven generic CRA→Vite gap in /Users/jacksm5pro/dev/open-source/versionless and bring HospitalRun's migrated build to a proven boot. Evidence (prior unit): after the global-identifier (ce2fbb8) and node-core-module (736c638) capabilities, HospitalRun's Vite target throws `ReferenceError: txt is not defined` — `node_modules/md5-jkmyers/src/md5.js:101` assigns an undeclared variable; webpack 4 evaluated CommonJS in sloppy-mode wrappers where that creates an implicit global, while Vite/rolldown emits strict-mode ESM which throws at load.

1. Add a generic capability to `packages/frameworks/react/src/react-cra-vite-adapter.ts` that reproduces webpack 4's tolerance of implicit globals in CommonJS DEPENDENCY modules (node_modules only — application source stays strict): mechanism is yours within these bounds — it must be generic (no app or package names in the reusable surface), era-faithful (the variable behaves as the shared implicit global it was under webpack, including cross-reference reads), loud rather than silent where it cannot apply, and unit-tested with the established real-Vite-build-in-a-browser-shaped-realm idiom (control build throws `txt is not defined`-style, adapted build evaluates with correct semantics). A scan-and-declare transform over CJS dependency modules or an equivalent targeted approach both qualify; wholesale disabling of strict mode for the entire bundle does not.
2. Rebuild BOTH HospitalRun lanes ×2 offline (baseline in the Rosetta Node 12.14.1 cell; target on workspace Node) — deterministic — and prove BOOT with the repo's Playwright host: `#root` renders non-empty on `/`, zero console errors beyond the known SW-registration inventory, zero failed requests. If boot fails on a FOURTH distinct gap, stop there and report it precisely — do not chase it.
3. Regenerate the HospitalRun canonical build receipt under `evidence/runs/react-hospitalrun/`: adopt the reproducible digest scheme sha256(canonicalize(files)) and record it explicitly; record all THREE runtime breaks the gate caught (global identifier, node core modules, sloppy-CJS implicit globals) and their generic fixes as the migration story; note the superseded receipt's lane digests were not reproducible under any scheme and are replaced.
4. Whole repo gate green. Papercups untouched (separate regeneration unit).

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/react-hospitalrun/**`
- `fixtures/react-hospitalrun/**`

## Forbidden moves

- No app/package-name branching in the reusable surface; guard tests stay green. No packages/core/**, packages/trust/**, evidence/runs/react-papercups*/\*\*, evidence/runs/witness-*/**, aggregate.json, evidence/trust/**, evidence/ingests/**, scripts/**, docs/\*\*.
- Application src stays strict — the capability applies to dependency CJS only. Do not erase the caught-breaks history. Network only for a genuinely-needed consented registry fetch (record it). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-hospitalrun/build-profile.json evidence/runs/react-hospitalrun/t004-run.json'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the capability cannot be built without whole-bundle strict-mode disablement, boot fails on a fourth gap (report exactly — do not chase), determinism fails, or the receipt cannot honestly assert a booting build, return status "blocked" with specifics in open_questions.
