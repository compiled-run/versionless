# Operator flows

Five framework-neutral commands — `analyze`, `plan`, `migrate`, `verify`, `supported-matrix` — are the public entry points over the frozen migration engines. They live in `packages/cli/src/operator` and are wired into `packages/cli/src/cli.ts`.

They are composition and nothing else. Every decision about *what to change* comes from the frozen adapters (`migrateAngularCliEraWorkspace` for the Angular lineage, the create-react-app and Vite-origin adapters for the React lineage). The flows read the tree, hand the readings over, and report what came back. They add argument validation, a machine-readable output mode, and a refusal for every input this repository cannot answer for.

Every flow is local and offline: none opens a socket, and none writes into the application it was pointed at.

## What is established, and what is not

- A composed changeset is a set of edits, not a build. Nothing these flows print establishes that a migrated tree installs, compiles, or emits anything.
- A cell verdict is a reading of a published registry, not an installation. A range printed here has not been resolved against a lockfile.
- A dependency the target cell has no reading for is reported `unknown`. `unknown` is neither `supported` nor `unsupported`, and it is never strengthened into either.
- Support is exactly the counted set in the derived matrix. Pointing these flows at an application does not add it to that set.

## `analyze <app-root>`

```sh
node --experimental-strip-types packages/cli/src/cli.ts analyze <app-root> [--json] [--record <file>]
```

Reads declarations and reports them: lineage and the package it was detected from, the declared framework version, the builder (from `angular.json`/`.angular-cli.json` for Angular, from `react-scripts`/a Vite config/`next` for React), the Node era (`.nvmrc`, `.node-version`, then `engines.node`), the package manager (lockfiles present, plus any `packageManager` field; several lockfiles are reported `ambiguous`), and the target cell's verdict on every declared dependency.

The Angular target cell is the only per-package registry either lineage publishes. A React or Next.js tree is therefore reported as having **no cell** — with the reason — rather than as having a cell that read nothing.

## `plan <app-root>`

```sh
node --experimental-strip-types packages/cli/src/cli.ts plan <app-root> \
  [--source-dir <dir>]... [--template-dir <dir>]... [--style-dir <dir>]... \
  [--entry <module>] [--json] [--record <file>]
```

Composes the changeset and reports it without writing into the tree: files changed with their before/after digests and per-file change lines, files the changeset removes, unhandled findings, and the differences the migration declares it no longer carries.

The Angular source directories default to the `sourceRoot` the workspace declares for its own build target. A workspace that declares none is **refused**, not guessed at: scanning the wrong directory would report a clean changeset for a tree nothing was read from. `--source-dir` is repeatable, for a workspace whose compilation unit reaches past its own `sourceRoot` (pigallery2 declares `frontend` and its browser build also compiles `common`).

`plan` reports `readings supplied`. The Angular capabilities gated on a compiler diagnostic (`TS2314`, `TS2339`) or on an installed closure stand down when the caller supplies no reading, which is a different thing from the tree having nothing for them to do. Programmatic callers supply them through `composeAngularPlan({ readings })`.

For a create-react-app tree the hop rewrites exactly one file — the Vite entry document the adapter derives from the application's own `public/index.html` — because everything else that hop does is a build-time composition rather than an edit. For a Vite-origin tree the flow reports the configuration translation plan and refuses on any option or plugin the adapter has no rule for.

## `migrate <app-root> --out <dir>`

```sh
node --experimental-strip-types packages/cli/src/cli.ts migrate <app-root> --out <lane> \
  [--materialize] [--json] [--record <file>]
```

Applies the composed changeset into a separate output lane. Three refusals are structural: the lane may not be inside the application, the application may not be inside the lane, and a lane that already carries files is refused rather than overwritten. `--out` is required; there is no in-place mode.

By default the lane carries only the files the changeset rewrites — the cheap artifact to review — and `removed` is then what the changeset says the tree should no longer carry, not a deletion the run performed. `--materialize` copies the application into the lane first (`node_modules` and `.git` excluded) and performs the removals, so the lane is a whole tree.

Every written file's digest is re-checked against the composed digest before the run reports success.

## `verify`

```sh
node --experimental-strip-types packages/cli/src/cli.ts verify [--receipt <path>]... [--trust-dir <dir>] [--json]
```

Runs the offline verifications in one summary, each through the same function the single-purpose command calls:

| check | what it does |
| --- | --- |
| `freeze:subtrees` | recomputes each frozen adapter subtree object id from the checkout with `git rev-parse` and compares it to the declared freeze, and recomputes the composite from its own subtree list |
| `trust:verify` | verifies the published trust package |
| `corpus:verify` | re-derives corpus conformance |
| `receipt:verify` | verifies a receipt (the composed React run by default; `--receipt` is repeatable) |

A failing check is reported beside the passing ones instead of aborting the summary. A check that could not run at all — no Git checkout to read, for instance — is reported `unknown`, which is neither a pass nor a failure. The exit code is non-zero unless every check passed.

## `supported-matrix`

```sh
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix [--trust-dir <dir>] [--json] [--record <file>]
```

Verifies the trust package first, then reads the support matrix out of the enterprise report the package carries, so what reaches stdout is the verified artifact rather than whatever happens to be on disk. It prints the counted cells per lineage with their acceptance strings and witness receipts, the demotions, the holdouts with their **exact** outcome strings and counting notes, the permanent falsification history, the declared boundaries, the boundary prevalence with its population statement, and the out-of-matrix capability counts.

The rendered text is handed to the enterprise surface's own honesty guard (`assertEnterpriseSurfaceHonesty`) before it is returned. Blanket-support vocabulary, a bounded outcome restated as a generic pass, or a dropped prevalence figure each stop the render instead of being printed. One figure is deliberately withheld: a declared boundary records the rounded prevalence it may never be published as, so the renderer walks boundary records key by key and drops that key rather than dumping the boundary verbatim.

## Byte identity with the fixture-driven drivers

The flows must not become a second migration pipeline that agrees with the first only approximately. That is a claim about bytes, so it is measured:

```sh
node --experimental-strip-types packages/cli/src/fixture/operator-flow-byte-identity-run.ts
```

- **Angular** — `composeAngularPlan` on the pigallery2 1.7.0 holdout corpus, handed the driver's own source directories and readings, produces an `AngularMigration` whose canonical digest equals the one `angular-pigallery2-migration-run.ts` produces. The comparison covers every file, digest, declared difference and unhandled finding.
- **React** — `composeReactPlan` on the cypress-realworld-app migrated lane produces an entry document byte-identical to the one the holdout driver wrote, from the application's own template, detected entry module, and `REACT_APP_` environment.

The record is `evidence/runs/operator-flows/byte-identity.json`, and both identities are also asserted in `packages/cli/test/operator-flows.test.ts`. The identity is measured on one application per lineage over the overlap between the two paths; it is not a claim about every application either path could be pointed at.

## Recorded runs

`evidence/runs/operator-flows/` carries the flows run against two real corpus applications — the Angular holdout corpus at its pinned revision and the React holdout's migrated lane — plus the unified verification and the rendered matrix:

| file | flow |
| --- | --- |
| `analyze-angular-pigallery2-v1-7-0.json` | `analyze` on the Angular holdout corpus |
| `plan-angular-pigallery2-v1-7-0.json` | `plan` on the same tree |
| `migrate-angular-pigallery2-v1-7-0.json` | `migrate` into a changeset lane under `.versionless/work/operator-flows` |
| `analyze-react-cypress-rwa.json` | `analyze` on the React holdout lane |
| `plan-react-cypress-rwa.json` | `plan` on the same lane |
| `verify.json` | the unified offline verification |
| `supported-matrix.json` | the derived matrix as JSON |
| `byte-identity.json` | the overlap measurement above |
