# Versionless coverage report

What the fleet pipeline proved, per application, against the sealed baseline it was proved on. Every figure is read off the support matrix the trust package already derives and verifies; nothing is counted a second time here.

- Schema: `versionless.coverage-report.v1`
- Certification state: **not-certified**
- Canonical SHA-256: `8a5bb938b8a99e3d0790d5fca032ddd5d7f2f9d51817c2fb7ac92a0099539252`
- Integrity: hash-only; authenticity is not established

Every green cell below is filtered out of the Judge counting ledger the corpus derived and cross-checked against that corpus numerator and denominator. No cell is listed by hand, and a cell edited into this record fails re-derivation.

## 1. The sealed baseline, as this report reads it

- angular: **4 counted of 4** proven cells
- react: **6 counted of 6** proven cells
- capabilities: **8 cross-proven** and 51 experimental of 59 enumerated capabilities, at a cross-proven threshold of 2

A capability is claimed general, and therefore in the matrix, only once at least 2 independent applications prove it. The capabilities below are proven on fewer than that and are out of the matrix; they are named rather than silently claimed.

### Demoted from a denominator

- `angular-realworld-v15-to-v16` (angular): Judge-declined and demoted from the denominator: the migration changed applicationFilesChanged=0 application files, so it is an Angular 15-to-16 dependency version bump rebuilt under AOT rather than a proven application migration. Its browser-proof receipt stays verified and retained; it is excluded from the Angular denominator rather than counted, which is why the Angular total is four non-demoted cells and not five.

## 2. Applications

| id | application | framework | status | provenance of status | intervention count | detail |
| --- | --- | --- | --- | --- | --- | --- |
| `angular-factoriolab` | angular-factoriolab | angular | **proven** | sealed-receipts | not-applicable | Judge-accepted: Angular CLI 10.1 to 16.2 browser-builder across six majors with application source really rewritten, proven in the browser with byte-identical mutation restoration. |
| `angular-jira-clone` | angular-jira-clone | angular | **proven** | sealed-receipts | not-applicable | Judge-accepted: Angular CLI 13.2 custom-webpack to 16.2 browser-builder, absorbing a non-default builder and rewriting application source, proven in the browser on a second independent Angular application. |
| `angular-tiny-translator-v0-12-0` | angular-tiny-translator | angular | **proven** | sealed-receipts | not-applicable | Judge-accepted (T016 re-freeze audit): an eleven-major Angular CLI 1.5.4 to 16.2 browser-builder lift with application source really rewritten, proven in the browser with byte-identical mutation restoration. Its era-defect service-worker registration stays recorded rather than masked and does not disqualify the migration from the Angular numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked. |
| `angular-super-productivity-v2-13-15` | angular-super-productivity | angular | **proven** | sealed-receipts | not-applicable | Judge-accepted (T016 re-freeze audit): an eight-major Angular CLI 8.3.4 to 16.2 browser-builder lift with application source really rewritten, proven in the browser. Its declared cross-lane appearance differences and unseeded Sass random() build instability across the supersede boundary stay recorded rather than masked and do not disqualify the migration from the Angular numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked. |
| `react-boilerplate` | react-boilerplate | react | **proven** | sealed-receipts | not-applicable | Judge-accepted: webpack 4.30.0 to Vite 8.0.16 across Node 16 to Node 24 with a direct-Witness browser proof, byte-identical mutation restoration, and a current zero-service-worker policy reconciliation on the same immutable source. |
| `react-papercups-v1-0-0` | papercups | react | **proven** | sealed-receipts | not-applicable | Judge-accepted: a create-react-app 3.4.1 production application really moved to a Vite 8 build, with behavioral parity and mutation restoration proven in the browser rather than inferred from the build. |
| `react-hospitalrun` | react-hospitalrun | react | **proven** | sealed-receipts | not-applicable | Judge-accepted: a create-react-app 3.4.4 application on Node 12 reached a booting Vite 8 build on Node 24, and its baseline/migrated service-worker difference is recorded rather than masked, so the cell is counted with its difference visible. |
| `react-memos-v0-1-3` | react-memos | react | **proven** | sealed-receipts | not-applicable | Judge-accepted (T016 re-freeze audit): a substantive old-Vite-origin React application (Vite 2.9.5 to Vite 8) really migrated with a direct-Witness browser proof and byte-identical mutation restoration. React-lineage is measured by the charter oracle regardless of origin bundler, so it counts toward the React numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked. |
| `next-killedbygoogle-v3-0-0` | next-killedbygoogle-v3-0-0 | react | **proven** | sealed-receipts | not-applicable | Judge-accepted (T016 charter ruling): Next.js-on-React is React-lineage per the charter completion target ("six React-lineage applications ... at least one legacy Next.js app"), so this legacy-Next v3.0.0 vertical is the legacy-Next member of the six and counts toward the React numerator. It carries the informational legacy-next sub-tag; its baseline/migrated document-delivery difference stays recorded rather than masked, and the retired olderNext separate numerator folds into React here. |
| `react-linkfree-v0-72-0` | react-linkfree | react | **proven** | sealed-receipts | not-applicable | Judge-accepted (T016 re-freeze audit): a create-react-app 5 application really migrated to a Vite 8 build with a direct-Witness browser proof and byte-identical mutation restoration. Its synthetic profile corpus is the recorded boundary of the claim, published rather than hidden, and does not disqualify the migration from the React numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked. |
| `holdout-react-cypress-rwa` | cypress-realworld-app | react | **bounded** | sealed-receipts | not-applicable | passed |
| `holdout-angular-eshop-webspa` | eShopOnContainers WebSPA | angular | **bounded** | sealed-receipts | not-applicable | witness-passed-on-bounded-anonymous-catalog-surface |
| `angular-realworld-v15-to-v16` | angular-realworld-v15-to-v16 | angular | **not-admitted** | sealed-receipts | not-applicable | Judge-declined and demoted from the denominator: the migration changed applicationFilesChanged=0 application files, so it is an Angular 15-to-16 dependency version bump rebuilt under AOT rather than a proven application migration. Its browser-proof receipt stays verified and retained; it is excluded from the Angular denominator rather than counted, which is why the Angular total is four non-demoted cells and not five. |
| `angular-kubernetes-dashboard` | .versionless/cache/angular-kubernetes-dashboard-stage-t678/acquisition/source | angular | **not-admitted** | run-record | 0 | run-did-not-proceed:defect |
| `angular2-hn` | .versionless/cache/angular2-hn/acquisition/source | angular | **not-admitted** | run-record | 0 | run-did-not-proceed:defect |
| `react-ant-design-pro-v5-2-0` | .versionless/work/react-ant-design-pro-v5-2-0/baseline | react | **refused** | run-record | 0 | era-cell.node-major-not-inferable |
| `react-antd-admin-template-v2-0-0` | .versionless/work/react-antd-admin-template-v2-0-0/baseline | react | **not-admitted** | run-record | 0 | run-did-not-proceed:defect |
| `react-colorme-2019-06-06` | .versionless/work/react-colorme-2019-06-06/baseline | react | **refused** | run-record | 0 | install.lockfile-absent |
| `react-coverview-a1470b01` | .versionless/work/react-coverview-a1470b01/baseline | react | **not-admitted** | run-record | 0 | run-did-not-proceed:defect |
| `react-cra-redux-1a06509b` | .versionless/work/react-cra-redux-1a06509b/baseline | react | **refused** | run-record | 0 | install.lockfile-foreign |
| `react-flame-v2-4-0` | .versionless/work/react-flame-v2-4-0/baseline | react | **proven** | run-record | 0 | proven on this run and bounded by what the run recorded; the bounds are stated with this row in section 3 |
| `react-mycrypto` | .versionless/work/react-mycrypto/baseline | react | **refused** | run-record | 0 | ingest.acquisition-journal-does-not-match-the-tree |
| `react-your-spotify-1-5-0` | .versionless/work/react-your-spotify-1-5-0/baseline | react | **refused** | run-record | 0 | install.lockfile-foreign |

Totals: 11 proven, 2 bounded, 5 refused, 5 not-admitted, of 23 rows.

### Counting notes carried by the bounded rows

- `holdout-react-cypress-rwa`: This holdout passed, and it is still counted in no lineage numerator: a passing holdout shows the frozen adapter carrying one further application, not a migrated-application product count. It is published rather than folded into any numerator.
- `holdout-angular-eshop-webspa`: Never counted in any lineage numerator by this record. The migrated production build is green and repeatable, and the Witness is green on the anonymous catalog surface — twice per lane, one parity digest, with a mutation-red and byte-restore proof under it. What that leaves unproven is stated beside it: every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent. Whether a holdout proven on a bounded surface should ever reach a numerator is the Judge's decision, taken on the Judge's ledger and not here. The install RED under the frozen f1a63359 composite is retained beside all of it as the record of what the frozen adapter did.

## 3. The intervention rule

An application admitted through `versionless run` is recorded proven only if its run record exists, carries `interventions.count === 0`, and every one of its stage rows reads `ran`. A run record that does not assert an intervention count cannot yield a proven application: it is recorded `not-admitted` with `intervention-count-not-asserted`, because an unmeasured intervention count is not a measured zero. A run that proceeded with a stage that did not run is recorded `not-admitted` with `stages-not-all-ran`, which is the same bar the intervention harness and the corpus conformance admission path already hold. Applications whose status derives from sealed receipts are outside this rule; their status is what the Judge counting ledger and the holdout ledger already carry.

- `angular-kubernetes-dashboard`: not-admitted — intervention count 0 (run-did-not-proceed:defect)
- `angular2-hn`: not-admitted — intervention count 0 (run-did-not-proceed:defect)
- `react-ant-design-pro-v5-2-0`: refused — intervention count 0
- `react-antd-admin-template-v2-0-0`: not-admitted — intervention count 0 (run-did-not-proceed:defect)
- `react-colorme-2019-06-06`: refused — intervention count 0
- `react-coverview-a1470b01`: not-admitted — intervention count 0 (run-did-not-proceed:defect)
- `react-cra-redux-1a06509b`: refused — intervention count 0
- `react-flame-v2-4-0`: proven — intervention count 0
  - source: `pawelmalak/flame` at ref `refs/tags/v2.4.0`, revision `069b6690d9fa7a24a6e7727386ab85148c89b90e`, licence MIT `fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43` — read from `evidence/runs/react-flame-v2-4-0/run-record.json` (basis: run-record)
  - bounded by: Dependency install scripts: the install row declares the install-script policy and names 3 package(s) the lockfile marks as carrying an install script. It records no reading of which of them npm started and which npm skipped by policy — that reading was added to the install row after this run — so this proof does not establish that any of those scripts ran.
  - bounded by: Route reach: the witness row records 1 journey(s) replayed and carries no per-journey route reading — the journeys were added to the witness row after this run — so how many of the application's declared routes the replay reached is not recorded on this proof.
- `react-mycrypto`: refused — intervention count 0
- `react-your-spotify-1-5-0`: refused — intervention count 0

## 4. Boundary prevalence

- Published (**5-of-6**): The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.
- Population: Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.
- Tranche two: No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.

## 5. Refusal census

Source: `evidence/runs/operator-flows/refusal-census.json`, taken under adapter freeze composite `140ce86e163ddbae2ad6f1504022efca9468641cc50fd3dca354c6aba8cbb562`.

- `byClassification`: {"defect":5,"refusal":143,"unclassified":50}
- `byOrigin`: {"frozen-adapter":101,"pipeline":97}
- `byStage`: {"acquire":14,"analyze":2,"apply":5,"arguments":8,"batch":6,"build":9,"era-cell":9,"ingest":17,"install":13,"license-at-pin":4,"not-reached":69,"plan":24,"plan-or-build":13,"refusal-census":1,"supported-matrix":1,"witness":1,"witness-synthesize":2}
- `distinctCodes`: 198
- `recordedRefusalSites`: 99
- `sites`: 198

### Sites per code

- `acquire.archive-parity-differs`: 1
- `acquire.archive-root-not-single`: 1
- `acquire.archive-streams-differ`: 1
- `acquire.consent-not-declared`: 1
- `acquire.git-tree-truncated`: 1
- `acquire.identifier-not-declared`: 1
- `acquire.licence-absent-at-pin`: 1
- `acquire.network-mode-not-consented`: 1
- `acquire.no-accepted-responses`: 1
- `acquire.ref-not-declared`: 1
- `acquire.ref-not-resolvable`: 1
- `acquire.ref-not-resolvable-2`: 1
- `acquire.ref-not-resolvable-3`: 1
- `acquire.repository-not-owner-name`: 1
- `analyze.application-root-carries-no-manifest`: 1
- `analyze.application-root-not-a-directory`: 1
- `apply.application-inside-the-lane`: 1
- `apply.lane-already-carries-files`: 1
- `apply.lane-inside-the-application`: 1
- `apply.lane-is-the-application-root`: 1
- `arguments.batch-requires-an-output-lane-root`: 1
- `arguments.flag-requires-a-value`: 1
- `arguments.migrate-requires-an-output-lane`: 1
- `arguments.run-requires-an-output-lane`: 1
- `arguments.single-value-flag-repeated`: 1
- `arguments.unknown-flag`: 1
- `arguments.wrong-positional-count`: 1
- `batch.declared-application-is-not-readable`: 1
- `batch.manifest-declares-no-applications`: 1
- `batch.manifest-declares-no-applications-2`: 1
- `batch.manifest-entry-names-no-root`: 1
- `batch.manifest-is-not-readable`: 1
- `batch.no-applications-declared`: 1
- `build.configuration-absent`: 1
- `build.lane-closure-absent`: 1
- `build.lane-kind-unrecognised`: 1
- `build.no-build-script`: 1
- `build.no-ng-build-script`: 1
- `build.output-path-absent`: 1
- `build.workspace-target-absent`: 1
- `era-cell.arch-not-available`: 1
- `era-cell.cell-not-declared-for-framework`: 1
- `era-cell.declared-architecture-not-recognised`: 1
- `era-cell.declared-cell-not-described`: 1
- `era-cell.declared-node-not-a-version`: 1
- `era-cell.declared-range-excludes-the-lane-runtime`: 1
- `era-cell.node-major-not-inferable`: 1
- `era-cell.node-major-sources-disagree`: 1
- `era-cell.required-node-not-installed`: 1
- `frozen.angular-cli-era-migration.angular-migration-the-package-manifest-is-not-a-json-object`: 1
- `frozen.angular-cli-json-workspace-synthesis.angular-cli-1-x-workspace-synthesis-the-configuration-carries-no`: 1
- `frozen.angular-cli-json-workspace-synthesis.angular-cli-1-x-workspace-synthesis-the-configuration-is-not-a-j`: 1
- `frozen.angular-source-migration.angular-source-migration`: 1
- `frozen.angular-standalone-component.refused`: 1
- `frozen.angular-standalone-component.refused-2`: 1
- `frozen.angular-standalone-component.refused-3`: 1
- `frozen.angular-standalone-component.refused-4`: 1
- `frozen.angular-standalone-component.refused-5`: 1
- `frozen.angular-standalone-component.refused-6`: 1
- `frozen.angular-standalone-component.refused-7`: 1
- `frozen.angular-standalone-component.refused-appmodule-iframecomponent-reference-count-differs`: 1
- `frozen.angular-standalone-component.refused-appmodule-iframecomponent-shape-differs`: 1
- `frozen.angular-standalone-component.refused-exact`: 1
- `frozen.angular-standalone-component.refused-fuxa-gauge-cohort-exact-shape-differs`: 1
- `frozen.angular-standalone-component.refused-fuxa-gauge-cohort-source-sha-256-mismatch`: 1
- `frozen.angular-standalone-component.refused-fuxa-standalone-source-sha-256-mismatch`: 1
- `frozen.angular-standalone-component.refused-iframecomponent-decorator-shape-differs`: 1
- `frozen.angular-standalone-component.refused-migrated-fuxa-gauge-cohort-sha-256-mismatch`: 1
- `frozen.angular-standalone-component.refused-migrated-fuxa-standalone-sha-256-mismatch`: 1
- `frozen.angular-standalone-component.refused-testbed-iframecomponent-reference-count-differs`: 1
- `frozen.angular-standalone-component.refused-testbed-iframecomponent-shape-differs`: 1
- `frozen.angular-standalone-component.refused-transformed-gauge-cohort-shape-differs`: 1
- `frozen.angular-standalone-component.refused-transformed-standalone-shape-differs`: 1
- `frozen.angular-target-cell.angular-manifest-alignment`: 1
- `frozen.angular-target-cell.angular-manifest-alignment-2`: 1
- `frozen.angular-workspace-migration.angular`: 1
- `frozen.angular-workspace-migration.angular-2`: 1
- `frozen.application-source-dependency.application-source-dependency-declaration`: 1
- `frozen.direct-dom-access.direct-dom-input-path-must-be-relative-and-contained`: 1
- `frozen.direct-dom-access.direct-dom-inventory-id-is-required`: 1
- `frozen.direct-dom-access.direct-dom-inventory-paths-must-be-unique`: 1
- `frozen.direct-dom-access.unsupported-direct-dom-source-extension`: 1
- `frozen.ngrx-effects-migration.ngrx-effects-migration`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-app-binding-is-absent`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-avataaars-app-source-sha-256-mismatch`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-avataaars-yuku-diagnostics`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-exact-avataaars-lifecycle-shape-is-absent-or-ambiguous`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-history-is-not-the-single-imported-listener-binding`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-react-hook-bindings-differ`: 1
- `frozen.react-class-lifecycle-to-hooks.refused-transformed-avataaars-shape-is-ambiguous`: 1
- `frozen.react-composed-migration.refused-composed-source-sha-256-mismatch-for`: 1
- `frozen.react-composed-migration.refused-composed-target-sha-256-mismatch-for`: 1
- `frozen.react-composed-migration.refused-locale-transform-was-not-executed`: 1
- `frozen.react-composed-migration.refused-maintained-dependency-closure-mismatch`: 1
- `frozen.react-composed-migration.refused-proven-maintained-package-lock-result-changed`: 1
- `frozen.react-connect-to-hooks.refused`: 1
- `frozen.react-connect-to-hooks.refused-2`: 1
- `frozen.react-connect-to-hooks.refused-exact-transform-span-missing-or-ambiguous`: 1
- `frozen.react-connect-to-hooks.refused-legacy-wiring-remains-after-transform`: 1
- `frozen.react-connect-to-hooks.refused-localetoggle-source-sha-256-mismatch`: 1
- `frozen.react-connect-to-hooks.refused-missing-semantic-symbol`: 1
- `frozen.react-connect-to-hooks.refused-transformed-yuku-diagnostics`: 1
- `frozen.react-connect-to-hooks.refused-yuku-diagnostics`: 1
- `frozen.react-cra-process-global.build-outdir-is-unresolved`: 1
- `frozen.react-cra-vite-adapter.cra-node-core-module-resolution-has-no-application-root`: 1
- `frozen.react-cra-vite-adapter.cra-public-directory-outdir-is-unresolved`: 1
- `frozen.react-cra-vite-adapter.create-react-app-compatibility-the-dependency-module`: 1
- `frozen.react-cra-vite-adapter.create-react-app-compatibility-the-dependency-module-2`: 1
- `frozen.react-cra-vite-adapter.create-react-app-compatibility-this-build-imports-the-node-core-`: 1
- `frozen.react-cra-vite-adapter.node-core-module`: 1
- `frozen.react-data-flow-connect-to-hooks.refused`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-2`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-3`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-exact-transform-span-missing-or-ambiguous`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-legacy-wiring-remains`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-missing-semantic-symbol`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-transformed-yuku-diagnostics`: 1
- `frozen.react-data-flow-connect-to-hooks.refused-yuku-diagnostics`: 1
- `frozen.react-next-static-adapter.next-static-migration`: 1
- `frozen.react-next-static-adapter.next-static-migration-2`: 1
- `frozen.react-next-static-adapter.next-static-migration-3`: 1
- `frozen.react-next-static-adapter.next-static-migration-4`: 1
- `frozen.react-next-static-adapter.next-static-migration-5`: 1
- `frozen.react-next-static-adapter.next-static-migration-6`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration-2`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration-the-era-configuration-could-not-be-parsed-`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration-the-era-configuration-declares`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration-the-era-configuration-declares-the-option-`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration-the-era-configuration-imports`: 1
- `frozen.react-vite-origin-adapter.vite-origin-migration-this-build-imports`: 1
- `frozen.semantic-module.unnamed`: 1
- `frozen.sentry-v8-migration.sentry-v8-migration`: 1
- `frozen.split-element-successor.unnamed`: 1
- `frozen.undeclared-runtime-dependency.undeclared-runtime-dependency-declaration-dependencies-is-not-an`: 1
- `frozen.undeclared-runtime-dependency.undeclared-runtime-dependency-reading-a-package-manifest-declare`: 1
- `frozen.undeclared-runtime-dependency.undeclared-runtime-dependency-reading-a-package-manifest-is-not-`: 1
- `frozen.vite8-adapter.vite-8-kernel-buildstart-lifecycle-differs`: 1
- `frozen.vite8-adapter.vite-8-kernel-closebundle-lifecycle-differs`: 1
- `frozen.vite8-adapter.vite-8-kernel-evidence-profile-differs`: 1
- `frozen.vite8-adapter.vite-8-kernel-lifecycle-evidence-is-incomplete`: 1
- `frozen.vite8-adapter.vite-8-kernel-lifecycle-order-differs`: 1
- `frozen.vite8-adapter.vite-8-kernel-requires-build-lifecycle`: 1
- `frozen.vite8-adapter.vite-8-normalized-output-inventory-digest-differs`: 1
- `frozen.vite8-adapter.vite-8-normalized-output-inventory-is-not-unique-and-sorted`: 1
- `frozen.vite8-adapter.vite-8-output-inventory-contains-a-remote-url`: 1
- `frozen.vite8-adapter.vite-8-output-restoration-is-not-byte-identical`: 1
- `ingest.acquisition-journal-carries-no-consent`: 1
- `ingest.acquisition-journal-carries-no-parity-basis`: 1
- `ingest.acquisition-journal-does-not-match-the-tree`: 1
- `ingest.acquisition-journal-not-source-bound`: 1
- `ingest.acquisition-journal-revision-unreadable`: 1
- `ingest.declared-frontend-root-carries-no-manifest`: 1
- `ingest.declared-lockfile-absent`: 1
- `ingest.declared-revision-is-not-a-commit-sha`: 1
- `ingest.frontend-manifest-unreadable`: 1
- `ingest.frontend-root-ambiguous`: 1
- `ingest.frontend-root-declares-no-framework`: 1
- `ingest.frontend-root-lineage-ambiguous`: 1
- `ingest.frontend-root-not-found`: 1
- `ingest.identifier-not-determined`: 1
- `ingest.lockfile-closure-unreadable`: 1
- `ingest.revision-not-determined`: 1
- `ingest.source-root-not-a-directory`: 1
- `install.closure-registry-unreachable`: 1
- `install.git-dependency-policy-not-declared`: 1
- `install.install-script-policy-conflicts`: 1
- `install.install-script-policy-not-declared`: 1
- `install.lockfile-absent`: 1
- `install.lockfile-foreign`: 1
- `install.lockfile-unreadable`: 1
- `install.network-not-permitted`: 1
- `install.package-manager-not-npm`: 1
- `install.peer-resolution-policy-not-declared`: 1
- `install.remote-tarball-policy-not-declared`: 1
- `install.script-wrote-outside-lane`: 1
- `license-at-pin.identifier-not-recognised`: 1
- `license-at-pin.licence-file-absent`: 1
- `license-at-pin.manifest-field-conflicts-with-licence-text`: 1
- `license-at-pin.root-licence-files-state-different-identifiers`: 1
- `pipeline.apply.migrate-composed-digest-mismatch-for`: 1
- `pipeline.build.build`: 1
- `pipeline.install.install`: 1
- `pipeline.refusal-census.refusal-census`: 1
- `pipeline.run.run-the-apply-stage-was-reached-without-a-plan-this-is-a-defect-`: 1
- `plan.angular.declared-cell-not-published`: 1
- `plan.angular.no-declared-source-root`: 1
- `plan.angular.no-tsconfig`: 1
- `plan.angular.no-workspace-document`: 1
- `plan.angular.source-directory-escapes-the-application-root`: 1
- `plan.lineage-no-frozen-adapter-claims`: 1
- `plan.react.entry-module-unknown`: 1
- `plan.react.no-entry-document-template`: 1
- `plan.react.no-frozen-adapter-claims-this-tree`: 1
- `supported-matrix.trust-package-did-not-verify`: 1
- `witness-synthesize.bound-is-not-a-non-negative-integer`: 1
- `witness-synthesize.no-journey-derived`: 1
- `witness.browser-not-provisioned`: 1

## 6. What this does not establish

- A row recorded `proven` states that the Judge counted that cell off a witness receipt under the frozen adapter. It is not a statement about the application outside the cell, about a later revision of it, or about any application not listed.
- A row recorded `proven` with `provenanceOfStatus: run-record` states a pipeline proof and nothing wider: the command ran unattended, the out-of-band harness counted zero interventions, and every stage in the table it carries read `ran`. No Judge counted a matrix cell from it, it is not counted in any lineage numerator, and the source it names is the one its own run record pinned.
- The `provenBoundedness` lines on a run-record `proven` row are derived from that run record and from nothing else. Each names the field it was read out of; a line saying a reading is absent means the record predates that reading, not that the reading came back empty. What those lines bound is what the row establishes — a route the replay did not reach and an install script npm did not start are unproven by this row rather than proven absent.
- A row recorded `bounded` carries its outcome string verbatim because the outcome is bounded to the surface named in it. Restating it as a whole-application result is the failure this document is guarded against.
- A row recorded `not-admitted` was not proven by this record. Nothing here establishes that it would fail; it establishes only that no receipt in this package counts it.
- The refusal census enumerates refusal *sites* in the operator and frozen-adapter sources. It is a census of what the code can refuse, not a tally of what any run refused.
- The capability figures count enumerated capabilities against the cross-proven threshold. A capability outside the matrix is untested rather than known-absent.
- This document is not certification. It establishes hash integrity only; authenticity is not established, and no SLSA level is claimed.
