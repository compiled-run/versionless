# versionless

Behavior-preserving legacy migration toolkit — frees apps from framework-version lock-in.

Versionless migrates pinned legacy React- and Angular-lineage applications to modern stacks under a characterization oracle: semantic analysis for ingestion, deterministic transforms where possible, and a direct-Witness browser proof that the migrated application behaves the same as the original **on the cells this repository has actually counted green**.

Part of the same family as [frameless](https://github.com/jacksm5pro) and markless.

> **Status: active evidence program.** Support is exactly the set of counted green cells derived in the generated matrix — nothing wider. Cells outside it are unsupported, not-tested, or unknown, and they are named as such in the same documents as the successes. This is evidence, not certification: no cell is warranted, no SLSA level is claimed, signer authenticity is not established, and locality is process-scoped rather than OS-wide isolation.

## Enterprise evidence report

One machine artifact and one human document are generated from the canonical receipts and carry the whole picture — sources and rights, tool and target versions, hashes, commands, locality, journeys, results, deviations, unsupported and unknown states, the supported/unsupported matrix, and the claims-and-non-claims one-pager:

- [`evidence/trust/current/enterprise-report.json`](evidence/trust/current/enterprise-report.json) — the machine artifact
- [`evidence/trust/current/enterprise-report.md`](evidence/trust/current/enterprise-report.md) — the human document

```sh
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline --verify-only
```

Both files are **derived, never authored**. Every green cell is filtered out of the Judge counting ledger the corpus derived and cross-checked against that corpus numerator and denominator, so a cell edited into either file fails verification instead of changing a claim. The two published holdouts are quoted with the exact outcome strings their receipts carry and are counted in no lineage numerator, the recorded REDs are retained as permanent falsification history, and the declared Angular 16 pre-Ivy support boundary is published with its prevalence and population statement beside the successes.

## React Boilerplate v4 proof

The first slice migrates the active `LocaleToggle` at React Boilerplate v4 commit
`d19099afeff64ecfb09133c06c1cb18c0d40887e` from `connect`/`createSelector`
wiring to React-Redux hooks. It verifies immutable source and license hashes,
uses Yuku 0.7.0 for syntax and semantic preconditions, applies minimal byte-span
edits, updates only `react-redux` and its deterministic npm v1 lock entry, and
runs both independently built applications through the same Playwright journey.

Network use is split into explicit phases:

```sh
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=T008-tool-bootstrap pnpm install --frozen-lockfile
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=T008-fixture-ingest pnpm run fixture:ingest -- --fixture react-boilerplate-v4 --allow-network --consent-id T008-fixture-ingest
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture react-boilerplate-v4 --offline --receipt evidence/runs/react-boilerplate-v4/t008-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/react-boilerplate-v4/t008-run.json
```

The final receipt records SHA-256 integrity only. Authenticity is not
established. Locality enforcement covers Versionless-spawned Node/npm/webpack
children and Playwright browser requests; it is not OS-wide process isolation.

## Angular PhoneCat special-track proof

The next slice uses MIT-licensed Angular PhoneCat at commit
`ef6f6eb672ded472b4e442d598f5df40d0e0642c`. It preserves the constructable
`PhoneDetailController` and its dependency-injection annotation while replacing
the exact `self` alias and regular `Phone.get`/`setImage` callbacks with lexical
`this` arrow callbacks through three semantics-gated byte-span edits. The
legacy lane runs under pinned Node 16.20.2/npm 8.19.4; the independently
prepared target lane runs under maintained Node 24.15.0. Both use the unchanged
upstream npm lock, disabled lifecycle scripts, and the same explicit `copy-libs`
command before the static application is served directly.

```sh
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=T014-fixture-ingest pnpm run fixture:ingest -- --fixture angular-phonecat --allow-network --consent-id T014-fixture-ingest
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture angular-phonecat --offline --receipt evidence/runs/angular-phonecat/t014-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/angular-phonecat/t014-run.json
```

This is AngularJS special-track and maintained-target-tooling evidence only. It
does not satisfy the designated Angular pilot. Receipt hashes establish
integrity, not signer authenticity, and locality controls cover spawned
Node/npm children and Playwright routing rather than OS-wide isolation.

The separate `angular-phonecat-route-resolve` lane keeps the same static,
no-bundler corpus and moves both list and detail data acquisition into explicit
route resolves over the frozen local JSON files. Resolved values enter the real
components through one-way bindings, while detail image initialization uses the
component lifecycle and thumbnail switching remains unchanged:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture angular-phonecat-route-resolve --offline --receipt evidence/runs/angular-phonecat-route-resolve/t032-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/angular-phonecat-route-resolve/t032-run.json
```

This remains AngularJS special-track evidence. It does not prove Angular 2+,
Angular CLI/AOT, adjacent-major behavior, a designated pilot, or bundler support.

## React Boilerplate maintained-runtime proof

The separate `react-boilerplate-v4-node24` lane reconstructs the same pinned
`d19099` corpus and LocaleToggle transform, then updates only the target package
manifest and complete npm v1 lock delta from webpack 4.30.0 to 4.47.0. Its one
consented ingest verifies registry metadata, tarball integrity, MIT license text,
and exact Node 24.15.0 darwin-arm64 tooling. All acceptance work is offline and
loopback-only:

```sh
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=T022-react-node24-ingest pnpm run fixture:ingest -- --fixture react-boilerplate-v4-node24 --allow-network --consent-id T022-react-node24-ingest
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture react-boilerplate-v4-node24 --offline --receipt evidence/runs/react-boilerplate-v4-node24/t022-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/react-boilerplate-v4-node24/t022-run.json
```

The verifier performs a clean install and production build, repeats the unchanged
locale/navigation journey twice, restores webpack 4.30.0 and its original lock
state to require the intended Node 24 MD4 failure, and then restores webpack
4.47.0 byte-identically and passes again without the legacy OpenSSL provider.
TakeNote, Angular2-HN, old Vite, generic adapter portability, governance,
authenticity, certification, and OS-wide isolation remain explicitly unproved.

## React Boilerplate Vite 8 proof

The separate `react-boilerplate-v4-vite8` lane reuses the same pinned source,
approved LocaleToggle migration, cached Node 24.15.0 runtime, dependency tree,
and Chromium executable. A fixture-specific strict-TypeScript adapter builds the
real application with the root Vite 8.0.16 installation; webpack is not invoked.
The verifier stays offline, runs the locale/navigation journey twice over
loopback, requires an intended LocaleToggle mutation failure, restores the file
byte-identically, rebuilds, and repeats the passing journey:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture react-boilerplate-v4-vite8 --offline --receipt evidence/runs/react-boilerplate-v4-vite8/t028-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/react-boilerplate-v4-vite8/t028-run.json
```

This proves one modern second bundler on one real corpus. It does not prove old
Vite, generic or unplugin portability, either designated pilot, authenticity,
certification, Git/signing provenance, or OS-wide isolation.

## Offline corpus conformance

The offline static surface verifier pins and scans the exact legacy and target
deployment entrypoints for all nine verified verticals. It hashes every local
script and linked resource, records external resource and receipt-observed
network differences, and rejects malformed, missing, ambiguous, semantically
rebound, or unaccounted static tags:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run script-surface:verify
```

This covers eighteen exact static deployment entrypoints. Payment-page
applicability is not established, dynamic script insertion is not tested, PCI
compliance is not claimed, and hash evidence is not certification or proof of
authenticity.

The qualified-journey runtime observer complements that static inventory by
running the applicable React locale, React data-flow, or Angular PhoneCat
journey twice in every canonical lane. It records script-element mutations,
script requests, final elements, local file hashes, blocked resources, browser
errors, synthetic interceptions, and live-egress observations:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run runtime-script-observation:verify -- --offline --config trust/runtime-script-observation.json --output evidence/runtime-script-observation/current
```

This is evidence for the exact qualified journeys, not global
dynamic-insertion coverage. The isolated detector mutation proves that a
synthetically inserted external script is observed and refused without writing
an application worktree. Payment-page applicability remains unestablished;
PCI compliance, certification, authenticity, signed provenance, and OS-wide
isolation remain unclaimed.

The runtime configuration pins every journey and synthetic payload by path and
SHA-256. Before evidence is emitted or accepted into a trust package, the
semantic verifier independently rebinds all lanes to the static surface,
rehashes every observed local script, reconciles requests and element state,
and rejects altered projections, classifications, browser errors, detector
truth, assurance boundaries, or normalized-run results—even if enclosing trust
hashes have been recomputed.

The read-only corpus verifier independently checks every canonical receipt,
its linked artifacts, and exact aggregate membership before grouping the
verified verticals into their immutable source applications. The vertical and
application counts are derived by that verifier and published in
`evidence/trust/current/corpus-conformance.json` rather than restated here:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run corpus:verify
```

For the five React Boilerplate verticals, conformance is limited to their common
locale-and-heading projection. Runtime, bundler, receipt shape, and blocked-font
observations remain distinct; the Vite adapter is fixture-specific, while old
Vite, a generic adapter, and unplugin portability remain not-tested. The two
PhoneCat migrations remain distinct AngularJS special-track verticals
whose linked journey digest is identical. They are not Angular 2+, Angular
CLI/AOT, adjacent-major, or designated-pilot proof. Corpus and trust
digests establish hash integrity only, not authenticity or certification, and
locality remains process-scoped rather than OS-wide isolation.

## Angular PhoneCat composed-transform proof

The `angular-phonecat-composed` lane starts twice from the same immutable
PhoneCat source and applies the lexical-this and route-resolve/component-binding
transforms in both orders. Exact known-shape preconditions produce the same
three-file output in either order. The unchanged PhoneCat journey remains
identical, and isolated initial-image and one-way-binding mutations each prove
their intended failure, byte-identical restoration, and reproduced pass:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture angular-phonecat-composed --offline --receipt evidence/runs/angular-phonecat-composed/t048-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/angular-phonecat-composed/t048-run.json
```

This is a sixth migration vertical but remains one of the same two source
applications. It is AngularJS special-track/static evidence, not Angular 2+,
Angular CLI/AOT, adjacent-major, designated-pilot, or bundler proof. Integrity,
authenticity, certification, and locality retain the existing narrow nonclaims.

## React data-flow migration proof

The `react-boilerplate-v4-data-flow` lane starts both sides from the immutable,
verified Vite 8 target and changes exactly `HomePage` and `RepoListItem` from
`connect`/structured-selector wiring to `useSelector` and `useDispatch`
wrappers while preserving their named prop-driven components. Both lanes build
byte-identically on repeat and pass the same synthetic two-repository browser
journey twice. Isolated dispatch-suppression and current-user selector
mutations prove the intended failures, restoration, rebuild, and reproduced
pass:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture react-boilerplate-v4-data-flow --offline --receipt evidence/runs/react-boilerplate-v4-data-flow/t054-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/react-boilerplate-v4-data-flow/t054-run.json
```

This seventh vertical remains within the same React Boilerplate source
application. Its Vite adapter is fixture-specific, and it does not establish
generic React transform coverage, designated-pilot support, authenticity,
certification, compliance, or OS-wide isolation.

## React cumulative atomic migration proof

The `react-boilerplate-v4-composed` vertical starts both lanes from the immutable
original source. Before any target write, it verifies the three application
files plus package and npm-lock-v1 hashes, plans the locale and data-flow
transforms in both orders, and verifies the already-proven maintained package
and lock outputs. Both actual invocation orders produce the same five target
files. An injected staged-write failure leaves the published target absent and
cleans its sibling stage; the complete validated target is published with one
same-filesystem directory rename.

The original Node 16 lane builds with webpack 4.30.0 and the maintained Node 24
target builds with the pinned fixture-specific Vite 8.0.16 adapter. Each build
is reproduced byte-for-byte, including canonicalization of webpack-offline's
generated wall-clock service-worker version field. Both lanes pass the same
locale plus synthetic GitHub data-flow journey twice. Locale-dispatch and
repository-load mutations each fail their intended assertion, restore
byte-identically, rebuild, and reproduce the pass:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture react-boilerplate-v4-composed --offline --receipt evidence/runs/react-boilerplate-v4-composed/t060-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/react-boilerplate-v4-composed/t060-run.json
```

This eighth vertical remains the same React Boilerplate source application and
is not a designated pilot, third application, generic adapter, old-Vite, or new
framework/bundler support claim. Payment applicability, PCI compliance,
certification, authenticity, signed/Git provenance, global dynamic-insertion
coverage, and OS-wide isolation remain unestablished or unclaimed.

The three Vite-8 React verticals use one fixture-specific same-origin service
worker whose cache name contains the full SHA-256 of its sorted, rehashable
local precache manifest. Activation removes every obsolete Versionless cache,
and fetches query only the exact current cache. Isolated Chromium evidence
upgrades the base and transformed data-flow targets in both orders on one
unchanged origin, observes exactly one current cache with the exact manifest
inventory, reloads offline, reruns each exact qualified journey twice, and
proves a registration-disabled mutation fails before byte-identical
restoration. This is journey-scoped service-worker parity only.
It is not global offline or PWA correctness.

## Angular PhoneCat Vite 8 proof

The ninth vertical starts from the same immutable PhoneCat revision and executes
both proven AngularJS special-track transforms in both orders. The exact three
outputs are identical before a fixture-specific Vite 8.0.16 adapter builds a
self-contained, sorted, rehashable runtime inventory. The legacy app remains a
Node 16 static lane; target tooling runs on Node 24 and the browser loads only
the Vite output. Its 65-file `app/lib` dependency closure is an immutable,
content-addressed task input keyed by the verified `811fb0f…` tree digest; a
sorted path/hash manifest and provenance bind it to the pinned PhoneCat lock and
the prior preparation proof, without reading any historical worktree.
Publication uses one validated sibling-stage rename, while an
injected staged-output failure leaves the published target unchanged and cleans
the failed stage. Binding and emitted-template mutations fail as intended,
restore byte-identically, rebuild, and pass the existing PhoneCat journey.

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run fixture:verify -- --fixture angular-phonecat-vite8 --offline --receipt evidence/runs/angular-phonecat-vite8/t069-run.json
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/angular-phonecat-vite8/t069-run.json
```

This is not Angular 2+, Angular CLI/AOT, a designated pilot, generic adapter,
old Vite, or unplugin portability proof; those portability claims are
not-tested. Service worker behavior and PWA behavior are out of scope, and no
worker is emitted. Authenticity, certification, signed provenance, PCI
compliance, and OS-wide isolation remain unclaimed.
