# cypress-realworld-app — the holdout, re-run against the re-frozen adapters

**Unit** `lrapr-t017/h1-cypress-rwa-holdout-rerun` · **Role** holdout · **Result** baseline green, migrated lane **red on a new, strictly-later gap**

This re-runs the tranche-one React holdout against the **re-frozen** adapter composition. The
tranche-one attempt (`lrapr-t008/hx2-migration-under-freeze`) failed on exactly one gap —
non-UTF-8 module source decoding (faker's ISO-8859-1 Italian locale) — and the follow-on tranche
added that generic capability before re-freezing. This run measures whether the unseen holdout
now migrates. It advances past the tranche-one blocker and stops on a different, later gap. The
tranche-one FAIL receipt stays immutable; this is a new dated record superseding it by reference.

## What was frozen, and that it stayed frozen

The composite fingerprint over the five frozen subtrees was recomputed before any work started:

```
5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c
```

Adapter bytes changed: **0**. Adapter changes proposed and executed: **0**. The red build was
not patched around, and no capability was added to make it pass. No harness path branches on the
holdout's identity, revision, or exact source.

## The application

`cypress-io/cypress-realworld-app` at `refs/tags/v1.0.18`
(`f6b5cf3a1799998dab71181eeed59460f8ada5f4`, 2021-08-06, MIT). create-react-app 4.0.3 over
webpack 4.44.2, React 17.0.2, TypeScript 4.3.4. A real peer-to-peer payment application with a
first-party Express + lowdb backend. Both lanes were materialized from the same digest-verified
extraction of the pinned archive and share one dependency closure resident from the ingest; the
only variable between them is the bundler. Every build ran offline.

## Lane 1 — era baseline: green, byte-stable, reproduces the recorded baseline

Rebuilt **twice** in the cell the repository names for itself: Node **14.16.1** (`.nvmrc` and
`.node-version` agree), darwin-x64 under Rosetta 2, via the repository's own `yarn build:ci`
path. Both builds produced **84 files** with the identical lane digest

```
57cea24966c61963914da814e8348c970f11468127228c070def6c6472980028
```

under `sha256(canonicalize(files))` — the same digest the tranche-one baseline recorded. The
era baseline is invariant to the adapter freeze, and reproducing it byte-for-byte confirms the
cell is unchanged.

## Lane 2 — migrated: the tranche-one blocker is gone; a new one appears

The frozen `createCraViteAdapter` composition applied through
`fixtures/react-cypress-rwa/vite.config.ts` on Vite 8.0.16 / rolldown 1.0.3, nothing
holdout-specific in the config. Built twice; both attempts exited identically.

**The build now transforms 10,182 modules — one more than tranche-one's 10,181 — and completes
the entire transform phase**, reaching the rendering-chunks stage before failing:

```
✓ 10182 modules transformed.
rendering chunks...
✗ Build failed in 1.61s

[MISSING_EXPORT] "bpfrpt_proptype_WindowScroller" is not exported by
  "node_modules/react-virtualized/dist/es/WindowScroller/WindowScroller.js".
   ╭─[ node_modules/react-virtualized/dist/es/WindowScroller/utils/onScroll.js:74:10 ]
74 │ import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js";
   │          ───────────────┬──────────────
   │                         ╰──────────────── Missing export
```

## The tranche-one blocker is handled by the frozen capability

Tranche-one stopped **during the transform phase**, unable to load
`node_modules/faker/lib/locales/it/name/first_name.js` — the ISO-8859-1 file whose six invalid
UTF-8 bytes rolldown refused. The re-frozen adapter carries the generic
`craModuleSourceEncoding` capability (non-UTF-8 module source decoding), and this run **transforms
that file**: the module count advances by exactly one (10,181 → 10,182), the transform phase
completes, and the build reaches a strictly later stage before stopping on a different demand.
The faker non-UTF-8 blocker is gone. The capability works on the unseen holdout.

## The new finding

**Missing capability: missing-export tolerance for a self-inconsistent dependency ES module.**

`react-virtualized` 9.22.3 ships a `dist/es` build produced with
`babel-plugin-flow-react-proptypes`, which inserts `import { bpfrpt_proptype_* }` statements for
Flow proptype markers that the corresponding modules never export.
`dist/es/WindowScroller/utils/onScroll.js:74` does
`import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js"`, but `WindowScroller.js`
(10,304 bytes, sha256 `e1ca7edf…`) exports no such name — and no file in the ES build does. **28
files across that ES build carry the same dangling import**; this is the first one rolldown
resolves and rejects.

webpack 4 resolved an import of a non-existent named ESM binding to `undefined`, so the baseline
builds. Vite 8's bundler treats a missing named export as a hard error at the binding-resolution
stage and refuses to render the chunk.

Reached from **production application code**:
`src/components/TransactionInfiniteList.tsx:4` does
`import { InfiniteLoader, List, Index } from "react-virtualized"`, so react-virtualized is
genuinely in the browser module graph.

**Why this is not an adapter bug.** The adapter's generic capabilities cover module *semantics*
and byte-level *decoding* — tilde CSS specifiers, webpack's sloppy-mode CommonJS wrapper,
webpack's Node core shim table, the ambient `global` identifier, public directory replication,
and non-UTF-8 source decoding. Dangling named-export tolerance is a distinct semantic in the
bundler's binding-resolution stage. Nothing in the frozen composition is positioned to intervene
there. Naming that gap to the byte is the whole point of a holdout against a frozen adapter.

## Two-attempt identity proof

Both attempts transformed 10,182 modules and stopped with the identical demand
(`MISSING_EXPORT` on `bpfrpt_proptype_WindowScroller` at `onScroll.js:74:10`), so the red is a
measurement rather than a flake.

## Application files changed

**0** — no application source file was edited by hand. `src/aws-exports.js` and
`aws-exports-es5.js` are copied by the application's own `predev:cognito:ci`; `index.html` is
generated by the migration's `craEntryDocument` from the immutable `public/index.html`. The
migrated lane produced no JavaScript output.

## Parity, and what is not claimed

Build-level parity needs two built lanes; only the baseline built. Explicitly **not** claimed:
that this application can be migrated by the frozen adapter (it cannot, at this revision); that
one more capability would make it green (the build stopped at the first dangling-export module,
so every demand behind it is unobserved); any runtime, boot, or behavioural parity; anything
about the four external auth provider modes; anything about the baseline beyond the build. No
browser evidence exists for either lane in this re-run.

## Host deviation

`SKIP_YARN_COREPACK_CHECK=1` was set for the baseline build, and `CI=false` cleared so lint
warnings were not promoted to compile errors — both facts about the harness, not the
application, and identical to the tranche-one run. Network was used for nothing: the dependency
closure was already resident from the ingest under consent `VL-LEGACY-CORPUS-2026-08-10`, and
every build ran offline.
