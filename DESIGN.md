# Versionless — Design Document

> Migrate legacy apps. Prove nothing changed.

Founding notes, 2026-08-03. This document records the decisions, evidence, and
architecture agreed before the first line of tool code. Everything here was
either measured in a live session or decided explicitly — nothing is
aspirational filler.

## What Versionless is

**Versionless is a behavior-preserving legacy migration toolkit.** It frees
apps from framework-version lock-in: legacy frontend codebases go in, modern
idiomatic code comes out, and every change ships with proof that behavior did
not move.

One-sentence description (npm / GitHub):

> Versionless migrates legacy frontend codebases to modern stacks —
> compiler-grade semantic analysis, deterministic transforms, and
> behavioral-parity verification of every change. React and Angular first;
> the method is framework-agnostic.

Family grammar: **markless** frees the source from markup, **frameless** frees
the component from the framework, **versionless** frees the app from time.
All three name what the _artifact_ is freed from.

The npm name `versionless` is secured (0.0.1 placeholder published
2026-08-03 by `jackshelton`). The `@versionless` npm scope and the
`versionless` GitHub org are held by others (the org is parked and dead since 2024) — neither affects the bare package name. Use `versionlessjs` or a
personal account for hosting if an org is ever needed.

## Thesis

**The oracle is the product. Transforms are commodity.**

Coding agents made generating migration code cheap. Every existing tool can
rewrite code; none can prove the rewrite behaves identically. The industry gap
is precisely the middle of the pipeline:

- Everyone can inventory (dashboards, "mining" products)
- Everyone can generate (agents, codemods)
- **Nobody ships the behavioral-parity harness** — and that is what makes
  migration of high-stakes code (payments, regulated estates) acceptable

Corollary: prioritize migration candidates by **verification cost** ("how
expensive is it to prove this correct?"), never by size or age. Inputs to that
ranking: existing test coverage, coupling edges, hidden-logic signals.
The first migration maximizes _learning_, not impact — and migrating the first
pilot is itself the validation of the ranking method.

## Architecture

Five stages. AI may propose; only deterministic machinery sits in the
reproducible path.

### 1. Ingestion (semantic, not syntactic)

- **JS/TS/JSX/TSX (React-era code): the yuku toolchain** (`yuku-parser`,
  `yuku-analyzer`, `yuku-codegen`). Spec-compliant parse validated against
  Test262/TypeScript/Babel corpora; full binder (scopes, symbols, space-aware
  references, `capturesOf` closure analysis, cross-file `ResolveExport`);
  mutable ESTree identity-shared with the semantic model; native speed.
- **Angular templates: pinned modern `@angular/compiler` `parseTemplate`.**
  Template syntax is additive since v2, so one modern compiler reads the whole
  2+ estate. It is not semver-stable public API — pin the version, wrap it
  behind an adapter (precedent: angular-eslint does exactly this).
- **The Angular seam:** yuku parses component TS (decorators are just syntax),
  the `@Component` decorator argument is an ordinary object expression, the
  template string is extracted from the AST and handed to `parseTemplate`,
  and template references are joined back to class member symbols. ~30 lines
  of glue, proven (see Evidence).
- **AngularJS 1.x (if present in an estate): separate track.**
  `@angular/compiler` is useless there. parse5/htmlparser2 + custom `ng-*`
  directive interpretation + a small parser for the expression dialect.
  ngUpgrade-style hybrid is the live-migration precedent.

Why not the alternatives: tree-sitter/ast-grep are error-tolerant _editor_
grammars with no binder — transforms on them are scope-blind (see the hoist
counterexample in Evidence). jscodeshift is Babel-era and mostly syntactic in
practice. The TS compiler API is correct but heavy; yuku changes the
economics (sub-millisecond parse+bind per file).

### 2. Estate scanner (first deliverable)

Fast, rerunnable, whole-estate inventory. Collection slots:

- Framework + version per app; class-component counts; lifecycle usage
- Node floor, build tool + version, lockfile age, native deps (`node-sass`
  class of blockers), CI image pins
- Dependency graph: drift, duplicates, policy inconsistency, license set
- Test framework + coverage (Enzyme = dead weight; coverage = verification
  readiness signal)
- i18n library, catalog format, locale count (i18n is a **preserve surface**)
- Network endpoints, storage keys, third-party scripts, `window` globals /
  free names (`module.unresolvedReferences`) — the invisible integration
  surface, and compliance evidence (payment-page script inventory)
- Flow-annotation detection (yuku cannot parse Flow; strip with
  `flow-remove-types` first), `createReactClass`, literal `<template>`
  elements (pre-Angular-4 idiom that modern parsers read as plain HTML)

Rule: **define every metric.** A count whose meaning isn't stated is a
property of the miner, not the codebase.

### 3. Transforms (deterministic, semantics-gated)

- Deterministic codemods for the mechanical majority; every transform is
  reviewable once and provably identical across N apps.
- Semantic gates make transforms refuse instead of guess. Canonical example:
  hoisting a nested component is legal **iff** `capturesOf` (filtered to the
  parent scope) is empty; otherwise thread props or emit a report entry, never
  a blind edit.
- AI is allowed to _author_ transforms and to handle judgment gaps — always
  under the oracle, never inside the reproducible execution path. LLM calls
  inside a transform run mean N apps get N different migrations; that is
  disqualifying.
- Two edit modes: whole-file regeneration for cross-framework rewrites
  (yuku-codegen), span-based minimal-diff edits for in-place codemods where
  reviewers need untouched bytes to stay untouched (recast is the reference
  technique to study when this mode is built).
- Cut transforms fine-grained; a transform that can't finish its contract
  returns _blocked with a question_, not a partial guess.

### 4. Conformance gates (conventions as machinery)

Target-side company conventions encoded as mechanical, pluggable checks
(the frameless six-gate idiom-policy pattern). Empty at OSS launch; filled
per estate. Output must be aggressively boring — the code a senior engineer
at the target org would have written, on the build stack their conventions
bless. No novel build-time plugins in the product output, ever; cleverness
lives in the harness, which doesn't ship.

### 5. Characterization oracle (the product)

- Capture legacy behavior as executable scenarios _before_ changing a line:
  DOM state, network calls (including analytics beacons — silently dropped
  tracking breaks someone's dashboard weeks later), golden masters for
  anything that computes money.
- Run identical scenarios against the legacy lane and the migrated lane;
  parity is the merge gate. Locale is a scenario dimension (run per supported
  locale — "identical in English" doesn't prove the French disclosure text
  survived).
- **Every check must be proven able to fail**: mutate the subject, watch the
  check go red, restore byte-identically. A guard never shown to fail
  certifies the rot. Fixture/snapshot self-tests are circular (a codemod
  "passing" fixtures its author wrote, with `-u` regeneration, is a mirror,
  not an oracle) — never use snapshots as the oracle.
- Oracle results emit as **receipts** (reports, not just exit codes): they are
  the change-management/audit evidence regulated orgs need (SOX ITGC,
  PCI-DSS v4 6.4.3/11.6.1 script inventory).

### Delivery

PRs sharded **by codeowner**, sized for an actual review session. Review
throughput, not transform speed, is the bottleneck at estate scale. Ride the
org's existing approved CI — never introduce a second orchestrator. Rollout:
per-app canary, old version one flag away, ideally a parallel-run window
diffing outputs (the oracle promoted into production verification).

## Evidence (all measured 2026-08-03, scripts in `experiments/`)

| Experiment                                                                                                           | Script               | Result                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| yuku parse sweep: RealWorld react-redux (2017 JSX) + GitHub Desktop (production TSX)                                 | `sweep.mjs`          | **903/903 files, 0 failures**, 343 React class components recognized, ~134ms total                                          |
| yuku semantic extraction on a hairy generic class component                                                          | `semantic-demo.mjs`  | 0 diagnostics; lifecycles, setState-written state keys, 19 instance fields, per-method `capturesOf` extracted cleanly       |
| Safe-vs-unsafe hoist discrimination (the anti-ast-grep demo)                                                         | `hoist-check.mjs`    | `Row: UNSAFE (captures setSelected)`, `Footer: safe` — the check pattern-matching cannot express                            |
| Modern `@angular/compiler` (22.1.0) on old templates: ngx-admin @ Angular 4.3 (2017), RealWorld @ Angular 5.2 (2018) | `ng-sweep.mjs`       | **58/58 templates, 0 errors**; `*ngIf`/`*ngFor` desugared correctly; 291 BoundAttribute, 98 BoundEvent                      |
| Full Angular ingestion seam on a real component                                                                      | `angular-ingest.mjs` | yuku 0 diagnostics; template 0 errors; template→class member references joined (`toggleTheme`, `theme`, `currentBoolTheme`) |

Note: the scripts currently resolve yuku via `createRequire` against the
frameless repo's `node_modules` (yuku 0.7.0) and expect the test corpora
(cloned repos) in a scratch directory. First housekeeping task: give this repo
its own dependencies and a `corpus/` bootstrap script.

## Open questions

1. **yuku-codegen trivia/format preservation** — whole-file pretty-print or
   lossless for untouched nodes? Decides how the in-place edit mode is built
   (span edits over source text if codegen is whole-file).
2. **Estate composition unknowns** (answerable only against a real estate):
   Flow share, AngularJS 1.x share, `<template>` element usage, browser floor.
3. **AngularJS expression parser** — build small, only if an estate needs it.

## Positioning (exact wording matters)

The technique is **not** novel and must never be claimed as such — Coccinelle
(semantic patches, 2006), Google's ClangMR/Rosie, OpenRewrite (JVM), and
JetBrains' Java→Kotlin converter are the lineage. What is true:

> Compiler-grade migration tooling is proven practice at Google and in the
> JVM world — Versionless brings that discipline to frontend estates, where
> the ecosystem standard is still pattern matching, and adds behavioral-parity
> verification that no existing tool ships.

Against the commercial platforms (codemod.com et al.): their diagnosis
(verification cost, org failure modes, codeowner sharding) is right and
absorbed here; their execution layer (tree-sitter transforms, LLM calls in
the transform path, registry code execution, SaaS/self-updating agent
integrations) is the set of things regulated orgs cannot approve and this
project deliberately avoids. Versionless is **local-first, no network, no
telemetry, tiny auditable dependency tree** — for regulated estates that is
not a preference, it is the only approvable shape.

## Regulated-estate playbook (motivating context: large payments estates)

- PCI-DSS scope is architectural: never move an app's card-data boundary;
  flag any app where PAN touches application code. PCI v4 6.4.3/11.6.1 make
  payment-page script inventory a compliance object — the scanner produces it
  as a byproduct.
- US banking privacy is GLBA (+ state patchwork), not GDPR (EU-facing lines
  only). SOX wants change-management evidence — oracle receipts are that
  evidence. OCC/FFIEC third-party-risk rules are why tooling must be local
  and boring.
- Approval path: engineering manager sign-off for local static-analysis
  tooling (in writing, casually), not an open-ended question to compliance.
  Give compliance artifacts later, as gifts, through the manager.
- i18n catalogs at banks contain legally reviewed copy — preserve
  byte-identically; migrate mechanism only if forced.

## Tooling (mirror the frameless stack)

Versionless adopts the toolchain frameless already proved out. Nothing here is
installed yet — this section is the spec for when scaffolding starts.

Sibling repos (local paths, reference implementations for all of this):

- **frameless** — `/Users/jacksm5pro/dev/open-source/frameless` (the toolchain
  to copy: root `package.json`, `vite.config.ts`, `tsconfig.json`,
  `pnpm-workspace.yaml`)
- **markless** — `/Users/jacksm5pro/dev/open-source/markless`
- **yuku** — `/Users/jacksm5pro/dev/open-source/yuku` (the toolchain source
  itself; frameless consumes it as `yuku-parser`/`yuku-analyzer`/
  `yuku-codegen` 0.7.0)

The stack, as frameless runs it:

- **pnpm 10.33.2** — workspace + `catalogs:` for version alignment across
  packages (`pnpm-workspace.yaml`); `poc/**` deliberately owns separate
  lockfiles outside the workspace
- **Vite+ (`vite-plus` 0.1.20) as the unified driver** — one tool for the
  whole loop: `vp pack` (build), `vp fmt`, `vp lint`, `vp test`; staged-file
  hook `vp check --fix`; config lives in a single `vite.config.ts` via
  `defineConfig` from `vite-plus`
- **`vp pack` pattern** — per-package `PackUserConfig`: ESM only, `dist/`
  out, `platform: 'node' | 'neutral'`, `neverBundle` regexes for node
  builtins + declared deps (externals stay external)
- **vite 8.0.16 / vitest 4.1.5** — vitest projects split node lane vs
  browser lanes (per-framework browser projects in frameless)
- **TypeScript 5.9.3, strict** — `noEmit` typecheck as the `check` script,
  run per-package; `moduleResolution: "Bundler"`, ES2022 target,
  `allowImportingTsExtensions`
- **fast-check** — property-based testing alongside vitest
- **Formatting** — tabs, `tabWidth: 4`, `printWidth: 100`, LF, single quotes
  (enforced by `vp fmt`, not a separate prettier)
- **Node >= 22**, git hooks via `git config core.hooksPath .githooks`
  (wired by the `prepare` script), `.ruler` (`@intellectronica/ruler`) for
  agent guidance files
- **Version pins to carry over**: yuku `0.7.0` (exact), `@angular/compiler`
  pinned exact (22.1.0 proven in the evidence table) behind the adapter

## Testing stack

Three layers, all riding the same toolchain:

1. **Unit + semantic tests — Vitest node lane** (via `vp test`). Transform
   logic, scanner metrics, gate predicates. **fast-check** for property-based
   coverage (generative corpus over hand-picked examples — the frameless
   testing-audit conclusion: great oracle beats big corpus, and snapshots are
   banned as oracles).
2. **Behavioral browser tests — Vitest browser mode.** Real-browser
   assertions on component behavior, the frameless pattern: per-lane browser
   projects (`vitest --project <lane>-browser`), cross-browser including
   Firefox. For versionless this is where legacy-vs-migrated component
   behavior gets compared at the component granularity.
3. **End-to-end oracle — Witness** (`@async/witness`, local:
   `/Users/jacksm5pro/dev/open-source/witness`; frameless uses it for the
   behavioral SSR proof via `witness run` in `demos/ssr`). Witness runs the
   real Vite pipeline and writes a **receipt** per run to
   `.witness/receipts/` — pass or fail, human- and machine-readable, in the
   pipeline's own vocabulary. This matters to versionless twice over:
    - **The receipt concept is the oracle's output format.** DESIGN already
      requires oracle results as receipts (audit/change-management evidence);
      Witness is the in-family implementation of exactly that idea — adopt or
      extend it rather than inventing a second receipt format.
    - **The box pattern generalizes to migration parity.** A Witness box
      proves "the built app behaves like dev" (build/dev parity); the
      versionless oracle proves "the migrated app behaves like legacy"
      (migration parity). Same shape: drive the real pipeline, assert
      behavior, restore state, emit the receipt. `versionless verify` should
      be evaluated as a Witness-style harness (or a consumer of Witness
      itself) before anything bespoke is built.
    - Note: Witness is early (0.8.0) and its `specs/` directory is the
      product truth — read those before building on it.

Testing rules already binding from the design: every check must be shown to
fail (mutation-proof); locale is a scenario dimension; network golden masters
include analytics beacons; fixtures/`-u` snapshots are never the oracle.

## Roadmap

**v0.1 — Estate scanner.** Port `experiments/` into a real CLI
(`versionless scan`), own dependencies, defined metrics, JSON + report
output, corpus bootstrap for OSS legacy apps. This is also the pre-onboarding
demo artifact.

**v0.2 — Characterization oracle.** `versionless verify`: Playwright
scenario capture/replay, network golden masters, per-locale dimension,
mutation-proof of every check, receipt output.

**v0.3 — First transform.** Class→hooks with `capturesOf` gating, proven
end-to-end on an OSS legacy app: scan → characterize → transform → verify →
sharded PR. The pilot validates the ranking method.

**Later.** Angular component transform (TS via yuku + template via
`@angular/compiler`), conformance-gate plugin layer, more frameworks
(Vue/Svelte/AngularJS — the substrate is JS/TS; the method carries).

## Reading list (cut to what pays)

Deep: Google _Software Engineering at Google_ — Large-Scale Changes chapter;
Angular's control-flow migration source (`angular/angular`,
`packages/core/schematics`) — the only production template-to-template
transform in existence; react-codemod fixture directories (edge-case corpus
to lift).

At the trigger moment: Stripe Flow→TS post + Airbnb ts-migrate post (rollout
strategy); recast design notes (when building minimal-diff mode); Angular
Update Guide (bookmark, reference).

Skip: OpenRewrite source, ts-morph, ast-grep/Hypermod/GritQL/Batch Changes
internals, Coccinelle/ClangMR papers (citation material for the announcement
post, not homework).
