# cypress-realworld-app — holdout re-run falsification receipt

- Outcome: **failed** — the frozen adapter does not yet carry this application at this revision
- Recorded reason: missing generic capability — **missing-export tolerance for a self-inconsistent dependency ES module**
- Canonical SHA-256: b64cd0a929c32e37d6ee1874357ae580a39bc1517adc24dbfb5551aabc44cac6
- Unit: `lrapr-t017/h1-cypress-rwa-holdout-rerun`
- Supersedes by reference: `lrapr-t008/hx2-migration-under-freeze` (`evidence/runs/holdout-react-cypress-rwa/receipt.json`, digest `7ec6f18b27d2967cd533ba89505e8a76590c1866aec8bd7a8d8543cd87743aae`) — the tranche-one FAIL stays immutable
- Source: https://github.com/cypress-io/cypress-realworld-app at `refs/tags/v1.0.18` (`f6b5cf3a1799998dab71181eeed59460f8ada5f4`, MIT), create-react-app 4.0.3 over webpack 4.44.2, React 17.0.2, TypeScript 4.3.4
- Frozen adapter fingerprint: `5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c` over 5 subtrees, recomputed by this unit; adapter bytes changed: 0; adapter changes proposed and executed: 0
- Derived from committed run evidence: `evidence/runs/react-cypress-rwa/rerun-2026-08-12/build-profile.json` (`981fbff5b2c8a4e257544bf6ba6abb25334c686fd56605edd6e0a89f4795d1ae`), `evidence/runs/react-cypress-rwa/rerun-2026-08-12/run.md` (`33d9cb4cfee97a2317b207e74480813e561ad9eac03aec41f6daa48816e45d26`), `evidence/runs/react-cypress-rwa/rerun-2026-08-12/migrated-error.log` (`6dd02948f7dd8bb2d6b140ade19e318dee8948fc5f0b91ed4d44d514dd5ac435`)

## The tranche-one blocker is now handled

The tranche-one attempt failed on **non-UTF-8 module source decoding**. That gap is closed: craModuleSourceEncoding — the generic CRA non-UTF-8 module source decoding capability, now inside the frozen react adapter. Tranche-one stopped DURING the transform phase, unable to load node_modules/faker/lib/locales/it/name/first_name.js (the ISO-8859-1 file). The re-run transforms that file (module count advances by one, from 10181 to 10182) and completes the entire transform phase, reaching the rendering-chunks stage before failing on a strictly later, different demand. The faker non-UTF-8 blocker is handled by the frozen capability. Module count advanced from 10181 to 10182.

## Both lanes

- Shared closure: Both lanes were materialized from the same digest-verified extraction and installed the same committed yarn.lock under --frozen-lockfile, so the only difference between them is the bundler, not the dependency closure. The closure was already resident from the ingest; no new network install was required for this re-run and every build ran offline.
- Baseline (yarn build:ci, Node 14.16.1 declared by .nvmrc and .node-version): **green**, built 2x byte-stable, 84 files, lane digest `57cea24966c61963914da814e8348c970f11468127228c070def6c6472980028` under sha256(canonicalize(files)) — reproduces the tranche-one baseline
- Migrated (vite build --config fixtures/react-cypress-rwa/vite.config.ts, Node 24.15.0, Vite 8.0.16, rolldown 1.0.3): **red**, 2 attempts, exit 1 after 10182 transformed modules, failing at rendering chunks (binding resolution), after the transform phase completed; no JavaScript output produced
- Two-attempt identity proof: Both attempts exited the same way with the same itemized demand, so the red is a measurement rather than a flake. Demand multiset digest `f07a56c46e6b23720ada6b3a3d34c2aed637b31c84b7442c81892a0c6fa196e8`.

## The new finding

**Missing capability: missing-export tolerance for a self-inconsistent dependency ES module.**

react-virtualized 9.22.3 ships an ES-module build whose files import babel-plugin-flow-react-proptypes marker bindings (bpfrpt_proptype_*) that the corresponding modules never export. node_modules/react-virtualized/dist/es/WindowScroller/utils/onScroll.js imports { bpfrpt_proptype_WindowScroller } from ../WindowScroller.js, but WindowScroller.js exports no such name. webpack 4 tolerated an import of a non-existent named ESM binding by resolving it to undefined, so the baseline builds. Vite 8's bundler (rolldown) treats a missing named export as a hard error and refuses to render the chunk. The frozen composition has no capability covering dangling named-export tolerance, so the build stops.

- Exact demand: `MISSING_EXPORT` — "bpfrpt_proptype_WindowScroller" is not exported by "node_modules/react-virtualized/dist/es/WindowScroller/WindowScroller.js".
- At `node_modules/react-virtualized/dist/es/WindowScroller/utils/onScroll.js:74:10`: `import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js";`
- Offending module: `node_modules/react-virtualized/dist/es/WindowScroller/WindowScroller.js` (react-virtualized@9.22.3, 10304 bytes, sha256 `e1ca7edf3407b5e97e106986a792a0fe4c0141f7d347041a7b9e626a1d610458`) — exports the demanded name: false
- Scope: 28 files across the ES build carry the same dangling import pattern
- Reached from application code: `src/components/TransactionInfiniteList.tsx` — `import { InfiniteLoader, List, Index } from "react-virtualized";`

**Why this is not an adapter bug.** The adapter's generic capabilities are about module semantics and byte-level decoding: tilde CSS specifiers, webpack's sloppy-mode CommonJS wrapper, webpack's Node core shim table, the ambient global identifier, public directory replication, and non-UTF-8 source decoding. Dangling named-export tolerance is a distinct semantic: it lives in the bundler's binding-resolution stage, where an import of a name a module never exported is either resolved to undefined (webpack) or rejected (rolldown). Nothing in the frozen composition is positioned to intervene there.

Action taken: none. Recorded as a finding. No adapter change was proposed or executed.

## Influence, parity, and non-claims

The holdout influenced nothing. Zero adapter bytes changed and zero application source files were hand-edited; the red build was recorded, not repaired. Application files changed: 0. Adapter bytes changed: 0.

Observed but not fatal: `fs` for `node_modules/dotenv/lib/main.js`. Vite externalized fs for the browser where dotenv requires it, exactly as in tranche-one. The adapter's shim table deliberately omits the specifiers webpack itself emitted an empty module for, so this is reported rather than resolved. It is a warning, not the failure; the build passed it and transformed all 10182 modules before stopping at the rendering-chunks stage.

Build-level parity needs two built lanes. Only the baseline built; the migrated lane produced no output at all (only the replicated public assets were written before the build failed at rendering chunks). The baseline inventory is recorded in full so a future comparison has a fixed reference.

- No claim that this application can be migrated by the frozen adapter. It cannot, at this revision, and that is the recorded result.
- No claim that a single additional capability would make it green: the build stopped at the first dangling-export module rolldown rejected, so any demand behind that point is unobserved.
- No runtime, boot, or behavioural parity is claimed. The migrated lane never produced a bundle to boot.
- No claim about the four external auth provider modes; the local passport-session mode is the only one exercisable offline and no lane exercised it.
- The baseline lane is a build measurement only. It was not booted in this unit.
- No browser evidence exists for either lane in this re-run. No journey ran, no page was loaded, and nothing is claimed about behavior.
