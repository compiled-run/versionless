# T004 — papercups v1.0.0: create-react-app 3.4.1 to Vite 8, build stage

- Run: `T004-react-papercups-v1-0-0-cra-to-vite8-build`
- Receipt: `evidence/runs/react-papercups-v1-0-0/t004-run.json` (canonical digest `b433f214727389676b308332f7689d773ad28dde0984b9bf245f3f780f87d35a`)
- Build profile: `evidence/runs/react-papercups-v1-0-0/build-profile.json` (canonical digest `4c12638d87753650bee305d3f30cb5d77f60a8d7b50081df9ab7c61083d48a40`)

## Source

`papercups-io/papercups` at `refs/tags/v1.0.0` (`3546a5f60c52fcc86fe9cbcc3bbac07356ba134f`), archive
`f8a6576c0399e1eca5e1936a9e5e5b311798cccf3cb7c6fcce0cecbf8b46ea8f`, MIT. The migrated application is the
React 16.13.1 / TypeScript operator console under `assets/`. Baseline and target lanes were materialized into
`.versionless/work/react-papercups-v1-0-0/{baseline,target}`.

## Dependency acquisition

Consent `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`, registry `registry.npmjs.org`
plus `codeload.github.com` for the source archive. Install was `npm ci --ignore-scripts --no-audit --no-fund`
against the committed lockfileVersion 1 `assets/package-lock.json`
(`210db3017977d391aa49968787cc674f5ed135fd658aa9f56563288ea5e9848f`, matching the fixture record), 1989
placements per lane, lifecycle scripts disabled. Every later step ran offline.

## Builds

| Lane | Toolchain | Runtime | Runs | Result |
| --- | --- | --- | --- | --- |
| Baseline | react-scripts 3.4.1 / webpack 4.42.0 | node 16.20.2 | 2 | deterministic, digest `0345d36b…` inventory equal |
| Target | root Vite 8.0.16 | node 24.15.0 | 2 | deterministic, inventories equal |

The target build consumed the unmodified application source: zero edits to `src/`. Note that the closest prior
create-react-app 3.4.1 attempt in this corpus (SQLPad, T665) failed on both counts — a nondeterministic
baseline and `UNRESOLVED_ENTRY` on the immutable `public/index.html`. Both are resolved here by generic
capability, not by application-specific patching.

## Reusable capability added to `@versionless/react`

`packages/frameworks/react/src/react-cra-vite-adapter.ts`, unit tested in
`packages/frameworks/react/test/react-cra-vite-adapter.test.ts`. Nothing in it names an application, revision,
or source string; the fixture asserts that absence.

- `substituteCraTemplatePlaceholders` / `craEntryDocument` — create-react-app `%KEY%` template semantics
  (known keys substituted, unknown `%REACT_APP_*%` preserved verbatim, matching `InterpolateHtmlPlugin`) plus
  module-script injection, which turns the immutable `public/index.html` into a Vite entry document.
- `craProcessEnvironmentDefines` — `process.env.<KEY>` and whole-`process.env` inlining.
- `rewriteWebpackTildeCssImports` / `createCraTildeCssImportPlugin` — webpack tilde specifiers in CSS
  (`@import '~antd/dist/antd.css'`) rewritten to bare specifiers.
- `craPublicAssetPaths` / `createCraPublicDirectoryPlugin` / `createCraViteAdapter` — `public/` replication into
  the build output excluding the HTML template.

Fixture-scoped orchestration lives in `packages/cli/src/fixture/react-papercups-v1-0-0-vite8.ts` and the Vite
configuration in `fixtures/react-papercups-v1-0-0/vite.config.ts`.

## Parity signals — build level only

- Shared output paths: 8; byte identical: 7 (every replicated `public/` asset).
- `index.html` differs by construction: webpack injects hashed chunk scripts and an inlined runtime; Vite
  injects one hashed module script and one stylesheet.
- Baseline-only outputs: 14, including `service-worker.js` and the create-react-app precache manifest, which
  the Vite target does not emit.

## Not established

Behavioral parity, browser journeys, real-server operation, locality, mutation/restoration and service-worker
parity are all `not-run` / `not-tested` and remain the Witness unit's work. Hash integrity establishes no signer
authenticity, and no pilot, production-readiness, certification, or legal claim is made.
