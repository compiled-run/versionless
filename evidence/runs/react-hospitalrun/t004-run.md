# T004 — HospitalRun v2.0.0-alpha.7: create-react-app 3.4.4 to Vite 8, build and boot

- Run: `T004-react-hospitalrun-cra-to-vite8-boot`
- Receipt: `evidence/runs/react-hospitalrun/t004-run.json` (canonical digest `1fa0278923101efe6af370a44d0ef90e3309ac4c7a823fad448eb196cca37cd8`)
- Build profile: `evidence/runs/react-hospitalrun/build-profile.json` (canonical digest `17a9ae73d5a4ee2788b47b48299311558c4382865d1351c43a39a9ca3193d2fc`)
- Compatibility resolution: `evidence/ingests/react-hospitalrun/compatibility-resolution.json`
- Supersedes: `T004-react-hospitalrun-cra-to-vite8-build` (canonical digest `4f498c3cc7496af2d93a9be8a9aafec551178dfec150d8b34196abc64fc8d0ad`)

## Source

`HospitalRun/hospitalrun-frontend` at `refs/tags/v2.0.0-alpha.7`
(`8156955145551d0366df10faa28e724f3377dea1`), archive
`c9d07e8ee7ffaa174dff597dcecbd00c8eb0b6d525bb7a3f9a7d48e6a46ec306`, MIT. Baseline and target lanes were
materialized from the reconciled archive into `.versionless/work/react-hospitalrun/{baseline,target}`.

## Why this receipt replaces the previous one

The superseded receipt claimed a build-stage pass with lane digests `302e499b…` (baseline) and `9fedeeb1…`
(target). Neither is recomputable from the file list recorded beside it — not under
`sha256(canonicalize(files))`, not under `sha256(JSON.stringify(files))`, and not under a sha256 over
newline-joined `path:sha256` lines. The point is sharpest on the baseline: its recorded file list is
byte-for-byte the list recorded here, and the reproducible digest of that list is
`ddbb90ad0f3347c25409bccb38cb09b8680a84e3963bd322de7865763b7201c6`, not the `302e499b…` that was claimed.

This receipt states its scheme and holds to it: **every lane digest is `sha256(canonicalize(files))` over the
file list printed next to it**, using `packages/core/src/receipts/canonicalize.ts` — the same canonicalizer
the integrity block uses. A reader can recompute all four lane digests from this evidence alone.

The superseded receipt also recorded no browser evidence at all. That mattered: the target lane it certified
as a passing build did not, in fact, boot.

## Three runtime breaks, three generic fixes

Each break was found the only way it could be: by running the migrated build in a real browser. Each was
closed in the reusable create-react-app surface, with no application, package, or revision name anywhere in
it.

| # | Symptom | webpack 4 behaviour Vite does not reproduce | Generic fix |
| --- | --- | --- | --- |
| 1 | `ReferenceError: global is not defined` | webpack declares the ambient `global` identifier for browser targets (`node.global` defaults true on the pinned line) | `createCraGlobalIdentifierPlugin` — a compile-time substitution of the one free identifier onto `globalThis` (`ce2fbb8`) |
| 2 | Node core modules arriving as `__vite-browser-external` stubs; `process` / `Buffer` / `setImmediate` arriving free | webpack resolved bare core-module requires to the `node-libs-browser` shims from the application's own closure, and injected those four bindings into every module | `createCraNodeCoreModulePlugin` + the `craNodeGlobalsModuleId` bootstrap — lazy resolution out of the application's closure, a bootstrap evaluated before the entry, and a hard named failure when a shim is absent (`736c638`) |
| 3 | `ReferenceError: txt is not defined`, thrown at load | webpack wrapped non-harmony modules in a plain function in the bundle's own mode, and create-react-app's bundles are not strict, so a CommonJS dependency's assignment to an undeclared name created a shared global | `createCraSloppyCommonJsGlobalsPlugin` — this unit |

### The third break in detail

`node_modules/md5-jkmyers/md5.min.js`, reached through `pouchdb-quick-search`, assigns `txt` without ever
declaring it, and does so from a top-level self-check that runs at load. Under webpack that created
`window.txt`. Under Vite the module is ECMAScript, ECMAScript modules are always strict, and a write to an
unresolvable reference throws before React can mount.

The fix reproduces webpack's tolerance without unpicking strict mode anywhere:

- Only modules under a dependency directory are scanned. **Application source is never touched and keeps
  every strict-mode diagnostic** — a unit test builds first-party code with the same undeclared assignment and
  asserts it still throws.
- Only modules webpack would have wrapped in sloppy mode are scanned. A dependency carrying `import`/`export`
  was harmony, hence strict, under webpack too, and is left exactly as it is.
- The scan rides a real scope resolution (`yuku-analyzer`): a name counts only when a write reference
  resolves to no binding in any enclosing scope. A parameter, a local, a `catch` binding, or a hoisted `var`
  of the same name elsewhere in the module never produces a false report, and a `let` confined to a sibling
  block never hides a genuine implicit global.
- For each name found, a prelude creates the property on `globalThis` **if nothing already holds it**. Strict
  mode rejects only *unresolvable* references, and a property of the global object is resolvable, so the
  original assignment evaluates unchanged — and because the binding lives on the global object rather than in
  the module, a second module reading the same free name finds the same value webpack's implicit global gave
  it. A unit test proves exactly that cross-module read.
- A dependency module that parses as neither script nor module is a hard failure naming the module and the
  parser diagnostic. It is never a silent skip.

Whole-bundle strict-mode disablement was not used and is not needed.

The capability had to touch exactly one module in this application's entire closure:

| Module | Implicit globals |
| --- | --- |
| `node_modules/md5-jkmyers/md5.min.js` | `txt` |

## Builds

| Lane | Toolchain | Runtime | Runs | Result |
| --- | --- | --- | --- | --- |
| Baseline (compatibility) | react-scripts 3.4.4 / webpack 4.42.0 | node 12.14.1 darwin-x64 under Rosetta 2 | 2 | deterministic, digest `ddbb90ad…`, 19 files |
| Target | root Vite 8.0.16 | node 24.15.0 darwin-arm64 | 2 | deterministic, digest `84155b0a…`, 8 files |

Both lanes were rebuilt under `npm_config_offline=true` and `VERSIONLESS_NETWORK_MODE=offline`. The baseline
runs `npm run build` in its own cell with `CI` forced empty rather than inherited, so create-react-app 3 does
not promote warnings to errors on any host. The target build consumed the unmodified application source:
**zero edits under `src/`**. The only file added to the target lane is the root `index.html` entry document,
generated from `public/index.html` by `craEntryDocument`.

## Boot

Each lane was served from a Node static host bound to `127.0.0.1` on an ephemeral port and loaded in
Playwright 1.58.2 Chromium, with every non-loopback request refused.

| Lane | `#root` | Title | First heading | Page errors | Console errors | Failed requests | Non-loopback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | 13423 bytes | HospitalRun | Dashboard | 0 | 2 — service-worker registration only | 0 | 0 |
| Target | 13423 bytes | HospitalRun | Dashboard | 0 | **0** | 0 | 0 |

The baseline's two console errors are the whole known inventory: `src/index.tsx` calls
`serviceWorker.register()`, and the create-react-app worker's own script does not evaluate under the offline
loopback host. The Vite target emits no service worker, so it raises none of them and boots with a completely
silent console.

Equal rendered byte counts, titles and first headings across the two lanes are a **boot-level** signal. They
are not behavioral parity.

## The baseline is an explicitly labeled compatibility baseline

The pinned revision commits **no lockfile**. The floating resolution observed on 2026-08-10 installs but does
not build: the repository's own pinned `typescript` 3.8.3 cannot parse several present-day `@types` releases
(`evidence/ingests/react-hospitalrun/baseline-attempt.json`, which this unit leaves unaltered). Eight
type-only packages were pinned to the newest version published on or before the annotated tag date
(`2020-11-07T10:12:53Z`) and inside the range the closure already declared. `package.json` and every file
under `src/` are byte-identical to the pinned revision. Full pin table, tarball URLs, publish dates and
tarball digests are in the build profile.

## Reusable surface

`packages/frameworks/react/src/react-cra-vite-adapter.ts` grew one capability this unit
(`createCraSloppyCommonJsGlobalsPlugin` and the scan behind it). The overfitting guard is asserted from the
fixture, which fails if the string `hospitalrun` appears anywhere in the reusable React surface. Every new
export is named for the webpack behaviour it reproduces, not for the application or the package that needed
it.

Fixture-scoped orchestration lives in `packages/cli/src/fixture/react-hospitalrun-vite8-run.ts` and
`packages/cli/src/fixture/react-hospitalrun-vite8.ts`, the Vite configuration in
`fixtures/react-hospitalrun/vite.config.ts`, and the tests in
`packages/cli/test/react-hospitalrun-vite8.test.ts` and
`packages/frameworks/react/test/react-cra-vite-adapter.test.ts`.

## Parity signals

- Shared output paths: 5 (`favicon.ico`, `index.html`, `logo.png`, `manifest.json`, `robots.txt`); byte
  identical: 4 — every replicated `public/` asset.
- `index.html` differs by construction: webpack injects hashed chunk scripts and an inlined runtime, Vite
  injects one hashed module script, one stylesheet, and the injected-globals bootstrap.
- Baseline-only outputs: 14, including `service-worker.js` and `precache-manifest.*.js`.
- Target-only outputs: 3 (one hashed JS chunk, its source map, one hashed CSS chunk).

## Not established

Behavioral parity beyond boot, browser journeys, mutation/restoration and service-worker parity are all
`not-run` / `not-tested` and remain the Witness unit's work. Determinism establishes only that each bundler
reproduced its own output. Nothing here claims that no fourth unreproduced webpack behaviour remains — only
that none surfaced on this application at boot. Hash integrity establishes no signer authenticity, and no
pilot, production-readiness, certification, or legal claim is made.
