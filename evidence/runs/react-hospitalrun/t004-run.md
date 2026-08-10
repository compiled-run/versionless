# T004 — HospitalRun v2.0.0-alpha.7: create-react-app 3.4.4 to Vite 8, build stage

- Run: `T004-react-hospitalrun-cra-to-vite8-build`
- Receipt: `evidence/runs/react-hospitalrun/t004-run.json` (canonical digest `4f498c3cc7496af2d93a9be8a9aafec551178dfec150d8b34196abc64fc8d0ad`)
- Build profile: `evidence/runs/react-hospitalrun/build-profile.json` (canonical digest `fa642d00e8fb7d1e55628c3b5c00cf2bcbaa287e42c580abb1bdc6a278fd7b9a`)
- Compatibility resolution: `evidence/ingests/react-hospitalrun/compatibility-resolution.json`

## Source

`HospitalRun/hospitalrun-frontend` at `refs/tags/v2.0.0-alpha.7`
(`8156955145551d0366df10faa28e724f3377dea1`), archive
`c9d07e8ee7ffaa174dff597dcecbd00c8eb0b6d525bb7a3f9a7d48e6a46ec306`, MIT. Baseline and target lanes were
materialized from the reconciled archive into `.versionless/work/react-hospitalrun/{baseline,target}`.

## The baseline is an explicitly labeled compatibility baseline

The pinned revision commits **no lockfile**. The floating resolution observed on 2026-08-10 installs but does
not build: the repository's own pinned `typescript` 3.8.3 cannot parse several present-day `@types` releases
(`evidence/ingests/react-hospitalrun/baseline-attempt.json`, which this unit leaves unaltered). There is no
upstream-committed resolution to reproduce, so what is recorded here is a construction, dated to the tag, and
it is labeled as such everywhere it appears. It is **not** the upstream-committed state.

Cutoff: the annotated tag date, `2020-11-07T10:12:53Z`. Discovery was mechanical — run
`tsc --noEmit -p tsconfig.json` under the cell's own typescript 3.8.3, pin only the package the compiler
actually failed on, repeat. Eight packages were needed, all of them type-only, none of them a declared
application dependency:

| Package | Pinned | Published | Why it drifted |
| --- | --- | --- | --- |
| `@types/babel__traverse` | 7.0.15 | 2020-09-25 | mapped-type key remapping (needs TS 4.1) |
| `@types/lodash` | 4.14.165 | 2020-11-05 | `infer … extends` in a template-literal type (needs TS 4.7) |
| `@types/minimatch` | 3.0.3 | 2018-01-04 | current release is a types-free stub → TS2688 |
| `@types/ms` | 0.7.31 | 2019-09-04 | current release is a 2.x major that post-dates the tag |
| `@types/react-bootstrap-typeahead` | 3.4.6 | 2020-05-15 | later in-range patch adopted newer syntax |
| `@types/react-datepicker` | 3.1.1 | 2020-08-02 | later in-range patch adopted newer syntax |
| `@types/react-redux` | 7.1.11 | 2020-11-04 | later in-range patch adopted newer syntax |
| `@types/react-router` | 5.1.8 | 2020-06-22 | later in-range patch adopted newer syntax |

Each pin is the newest version published on or before the cutoff *and* inside the range the closure already
declared, extracted from a registry tarball whose registry-declared shasum was re-verified from the wire
(tarball URL, publish date and sha256 per pin in the build profile). `package.json` and every file under
`src/` are byte-identical to the pinned revision. `tsc` still reports type errors inside `src/__tests__/**`;
create-react-app 3 excludes test files from its build-time typecheck, so they do not affect the build, and
they are upstream properties of an alpha revision — recorded, not fixed.

## Builds

| Lane | Toolchain | Runtime | Runs | Result |
| --- | --- | --- | --- | --- |
| Baseline (compatibility) | react-scripts 3.4.4 / webpack 4.42.0 | node 12.14.1 darwin-x64 under Rosetta 2 | 2 | deterministic, digest `302e499b…`, 19 files |
| Target | root Vite 8.0.16 | node 24.15.0 darwin-arm64 | 2 | deterministic, digest `9fedeeb1…`, 8 files |

The target build consumed the unmodified application source: **zero edits under `src/`**. The only file added
to the target lane is the root `index.html` entry document, generated from `public/index.html` by
`craEntryDocument`; the repository has no root `index.html`, so nothing was overwritten.

## Reusable capability: unchanged, and that is the finding

HospitalRun is the create-react-app capability's **second independent application**. The generic adapter
proven on papercups (`packages/frameworks/react/src/react-cra-vite-adapter.ts`) carried it with **no
extension at all** — no new export, no new branch, no application-named symbol. The overfitting guard is
asserted from the fixture, which fails if the string `hospitalrun` appears anywhere in the reusable React
surface.

Shapes this application exercised: `%PUBLIC_URL%` template placeholders, `process.env.NODE_ENV` /
`process.env.PUBLIC_URL` inlining, and `public/` replication excluding the template. Shapes it did **not**
exercise, and which were therefore not invented for it: svgr (no `.svg` module is imported), jsx-in-`.js`
(every non-test source file is `.ts`/`.tsx`), absolute imports (no `baseUrl`), `REACT_APP_*` variables (none
is read in `src` or `public`), and webpack tilde CSS specifiers (none in `src/index.css`).

Fixture-scoped orchestration lives in `packages/cli/src/fixture/react-hospitalrun-vite8.ts`, the Vite
configuration in `fixtures/react-hospitalrun/vite.config.ts`, and the tests in
`packages/cli/test/react-hospitalrun-vite8.test.ts`.

## Parity signals — build level only

- Shared output paths: 5 (`favicon.ico`, `index.html`, `logo.png`, `manifest.json`, `robots.txt`); byte
  identical: 4 — every replicated `public/` asset.
- `index.html` differs by construction (2291 bytes webpack vs 1794 bytes Vite): webpack injects hashed chunk
  scripts and an inlined runtime, Vite injects one hashed module script and one stylesheet.
- Baseline-only outputs: 14, including `service-worker.js` and `precache-manifest.*.js`. `src/index.tsx`
  calls `serviceWorker.register()`; the Vite target emits no service worker, so that call has no artifact to
  register in the target. Recorded, not resolved.
- Target-only outputs: 3 (one hashed JS chunk, its source map, one hashed CSS chunk).

## Not established

Behavioral parity, browser journeys, real-server operation, locality, mutation/restoration and service-worker
parity are all `not-run` / `not-tested` and remain the Witness unit's work. Determinism establishes only that
each bundler reproduced its own output. Hash integrity establishes no signer authenticity, and no pilot,
production-readiness, certification, or legal claim is made.
