# cypress-realworld-app — the holdout, run against the frozen adapters

**Unit** `lrapr-t008/hx2-migration-under-freeze` · **Role** holdout · **Result** baseline green, migrated lane **red**

This is the falsification test the React tranche was built to face. The adapters were frozen
first, the holdout was chosen after, and the adapters were applied to it without a single byte
of change. The migrated lane did not build. That is the finding, and it is recorded as it
happened.

## What was frozen, and that it stayed frozen

The composite fingerprint over the five frozen subtrees was recomputed before any work started
and again by the verification fence:

```
d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77
```

Adapter bytes changed: **0**. Adapter changes proposed and executed: **0**. The red build was
not patched around, and no capability was added to make it pass.

## The application

`cypress-io/cypress-realworld-app` at `refs/tags/v1.0.18`
(`f6b5cf3a1799998dab71181eeed59460f8ada5f4`, 2021-08-06, MIT). create-react-app 4.0.3 over
webpack 4.44.2, React 17.0.2, TypeScript 4.3.4, Material-UI 4, XState 4, react-router 5. It is a
real peer-to-peer payment application with a first-party Express + lowdb backend, not a sample.

Both lanes were materialized from the same digest-verified extraction of the pinned archive and
installed from the same committed `yarn.lock` under `--frozen-lockfile`. **The two lanes share
one dependency closure**; the only variable between them is the bundler.

## Lane 1 — era baseline: green, byte-stable

Built twice in the cell the repository names for itself: Node **14.16.1** (`.nvmrc` and
`.node-version` agree), darwin-x64 under Rosetta 2, the runtime the ingest already acquired and
digest-verified. No deviation from the declared pin was needed and none was taken.

Both builds produced **84 files** with the identical lane digest
`57cea24966c61963914da814e8348c970f11468127228c070def6c6472980028`, under
`sha256(canonicalize(files))` — recomputable from the file list recorded in
`build-profile.json`.

One observation worth stating plainly: the lane runs `yarn build:ci`, not `yarn build`. That is
not a convenience. `build:ci` is what all three of the repository's own CI definitions invoke,
and its `prebuild:ci` hook copies the committed AWS Cognito mock into `src/aws-exports.js`,
which `src/containers/AppCognito.tsx` imports. The plain `build` script omits that hook and
**cannot compile at this revision** — it fails with `Cannot find file '../aws-exports'`. That is
a pre-existing property of the application at its pinned tag. It was observed, recorded, and not
repaired.

## Lane 2 — migrated: red, and red the same way twice

The frozen `createCraViteAdapter` composition applied through
`fixtures/react-cypress-rwa/vite.config.ts` on Vite 8.0.16. Nothing holdout-specific is in that
config. The only application knowledge it carries is what every create-react-app fixture states:
the entry module (`/src/index.tsx`), the public directory, the HTML template, and the
environment — and the environment is not hand-listed, it is read from the application's own
committed `.env` under create-react-app's own `REACT_APP_` prefix rule.

The build transformed **10,181 modules** and then stopped:

```
[UNLOADABLE_DEPENDENCY] Could not load node_modules/faker/lib/locales/it/name/first_name.js
   ╭─[ node_modules/faker/lib/locales/it/name/index.js:5:27 ]
 5 │ name.first_name = require("./first_name");
   │                           ───────┬──────
   │                                  ╰──────── stream did not contain valid UTF-8
```

Both attempts exited identically with the same itemized demand, so this is a measurement rather
than a flake.

## The finding

**Missing capability: non-UTF-8 module source decoding.**

`node_modules/faker/lib/locales/it/name/first_name.js` (faker 5.5.3, 21,980 bytes,
sha256 `02a9f8a9…`) is stored in **ISO-8859-1, not UTF-8**. It carries six invalid UTF-8 bytes,
all of them accented characters in Italian given names — `Esaù` (0xF9 at offset 5170), `Giosuè`
(0xE8 at 6973), `Mosè` (0xE8 at 9233), `Nicolò` (0xF2 at 9538), `Noè` (0xE8 at 9570).

webpack 4 decoded module bytes leniently, so the file reached the bundle with replacement
characters rather than being rejected — which is why the baseline builds. Vite 8's bundler
requires every module source to be valid UTF-8 and refuses to load one that is not.

This is reached from **production application code**, not test-only code:
`src/utils/transactionUtils.ts` does `import faker from "faker"`, and faker's locale index
eagerly `require`s every locale file, so the Italian name list enters the browser graph whether
or not the application uses that locale.

**Why this is not an adapter bug.** The adapter's five capabilities are all about module
*semantics*: tilde CSS specifiers, webpack's sloppy-mode CommonJS wrapper, webpack's Node core
shim table, the ambient `global` identifier, and public directory replication. Source *decoding*
sits below all of them, at the point where the bundler turns bytes into text. Nothing in the
frozen composition is positioned to intervene there. Recording that gap is the whole point of
running a holdout against a frozen adapter.

## Observed but not fatal

Vite externalized `fs` for the browser where `dotenv` requires it. The adapter's shim table
deliberately omits the specifiers webpack itself emitted an empty module for, so this is
reported rather than resolved. It is a warning; the build passed it and continued for 10,181
modules before stopping on the demand above.

## Application files changed

**0** — no application source file was edited by hand, matching the papercups and HospitalRun
precedent.

Three files are generated, none of them hand-authored:

| File | Generated by | Lanes |
|---|---|---|
| `src/aws-exports.js` | the app's own `predev:cognito:ci` | both |
| `aws-exports-es5.js` | the app's own `predev:cognito:ci` | both |
| `index.html` | `craEntryDocument`, from the immutable `public/index.html` | migrated only |

## Service worker

The application registers none. `src/index.tsx` has no `serviceWorker` import and no
registration call, and the tree ships no worker source. create-react-app 4 emits one only on
opt-in, and the baseline output contains **no** worker, precache, or workbox asset. The
registration difference recorded for other fixtures in this corpus therefore does not arise
here, and nothing is claimed either way about runtime caching.

## Parity, and what is not claimed

Build-level parity needs two built lanes; only one built. The baseline inventory is recorded in
full so a future comparison has a fixed reference. Explicitly **not** claimed:

- That this application can be migrated by the frozen adapter. At this revision it cannot.
- That one more capability would make it green. The build stopped at the first unloadable
  module, so every demand behind that point is **unobserved**.
- Any runtime, boot, or behavioural parity. The migrated lane never produced a bundle to boot.
- Anything about the four external auth provider modes; no lane exercised them.
- Anything about the baseline beyond the build. It was not booted in this unit.

## Host deviation

`SKIP_YARN_COREPACK_CHECK=1` was set for both installs. yarn 1 walks every ancestor directory
for a `packageManager` field and refuses to run when it finds one naming another package
manager; the work area lives inside this repository, whose root manifest declares
`pnpm@10.33.2`. The check fires on a fact about the harness, not about the application. Skipping
it restores the application's own install and changes nothing else. It applies to both lanes
equally.

Network was used only for the two consented dependency installs (consent
`VL-LEGACY-CORPUS-2026-08-10`, `registry.yarnpkg.com`, frozen lockfile accepted). Every build
ran offline.
