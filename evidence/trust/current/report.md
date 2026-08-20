# Versionless project trust package

- Canonical SHA-256: `a99892f8323e0b5381d5bee3b10a17db13240a7df9b65221fc2b45cac3c56d4c`
- Deterministic core: `9dc8fe09c4a05ff58889bc68a4335a57037d8a18f1637c619f1feea05d70add4`
- Generated observation: `2026-08-19T01:55:44.723Z`
- Vulnerability input freshness: **verified** (seven-day maximum age)
- Integrity: **hash-only; authenticity is not established**
- Assurance: **this package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation**

## Contents

- [CycloneDX 1.7 dependency graph](dependency-graph.cdx.json) — locally profile-validated; this is not independent or official certification.
- [License inventory](licenses.json) — SPDX expressions: 90 verified, 109 unknown, 0 ambiguous; license texts: 78 verified, 121 unknown, 0 ambiguous.
- [Vulnerability and KEV report](vulnerabilities.json) — cached OSV batch and CISA KEV observations only.
- [SLSA/in-toto-shaped provenance](provenance.json) — shape only; no SLSA level or signer authenticity is claimed.
- [Supported corpus/runtime/bundler matrix](matrix.json) — unsupported and untested cells remain visible.
- [Capability-coverage map](capability-coverage.json) — every exported migration capability with its proving applications and derived generality classification; single-application capabilities are named experimental, not claimed general.
- [Adapter freeze record](adapter-freeze.json) — the migration engine adapter surface is frozen at commit `0ecd410691df10fbc68c9ddcd012dafa86aba536` with composite SHA-256 `27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234`; the receipts, corpus, and witness registries are deliberately **outside** the freeze so holdout evidence can still be published additively.
- [Corpus conformance](corpus-conformance.json) — `101412703cc116969dd562a6ea46dde3d05424ad5194e535aca9750e373bc482`; 20 verified verticals grouped into exactly 13 source applications; zero designated pilots are verified.
- The immutable Killed by Google Next.js 12 Pages/webpack production vertical is verified only for its exact fixture; synthetic Next.js 12 Pages, 13 transition/App, and 14 App classification lanes remain **not-tested**, and generic Next.js support is not claimed.
- [Static script/resource surface](script-surface.json) — truthfully remains scoped to the prior nine verticals, two applications, and eighteen exact static deployment entrypoints; T220 is **not included** because its script surface was not separately observed; dynamic script insertion: **not-tested**; payment-page applicability: **not established**; PCI compliance is **not claimed**.
- [Qualified-journey runtime script observation](runtime-script-observation.json) — truthfully remains scoped to 36 runs across the prior nine verticals, two applications, and eighteen lanes; T220 is **not included** because its runtime scripts were not separately observed; this is **not global dynamic-insertion coverage**.
- React Boilerplate maintained-runtime proof is limited to Node 24.15.0 darwin-arm64 with webpack 4.47.0 and a separate fixture-specific Vite 8.0.16 build; other maintained targets remain unproved.
- Angular-lineage production readiness: **4/4**; Harness qualification: **0/4**. PhoneCat remains unsupported for the required visible transition and is not counted. Angular RealWorld's browser proof stays verified and retained but is **not counted** toward the numerator: its migration changed zero application files, so it is a dependency version bump rebuilt under AOT rather than a proven application migration.
- React-lineage production readiness: **6/6; Judge approved**.
- React Boilerplate current zero-service-worker policy reconciliation: **verified; the aligned React Boilerplate cell is Judge-counted**. The original offline-first evidence remains retained.
- Papercups v1.0.0 create-react-app→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, and the Judge **counts** it, so React-lineage readiness is **6/6**.
- HospitalRun v2.0.0-alpha.7 create-react-app→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its baseline/migrated service-worker difference is **recorded, not masked**, and the Judge **counts** it with that difference visible, so React-lineage readiness is **6/6**.
- factoriolab Angular CLI 10.1→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, it really rewrote application source across six majors, and the Judge **counts** it, so Angular-lineage readiness is **4/4**.
- jira-clone Angular CLI 13.2 custom-webpack→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, the second counted Angular application, and the Judge **counts** it, so Angular-lineage readiness is **4/4**.
- memos v0.1.3 Vite 2.9.5→Vite 8 old-Vite-origin direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, the first React-lineage vertical whose origin bundler is Vite rather than webpack, and the Judge **counts** it toward the React numerator under the T016 charter ruling, so React-lineage readiness is **6/6**.
- killedbygoogle v3.0.0 Next 12 static-export→Vite 8 client-build direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its baseline/migrated document-delivery difference is **recorded, not masked**, and the Judge **counts** it as the legacy-Next member of the React lineage under the T016 charter ruling (Next.js-on-React is React-lineage), so React-lineage readiness is **6/6**.
- LinkFree v0.72.0 create-react-app 5→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its proof ran over a **synthetic profile corpus** staged through the application's own codegen rather than the shipped dataset, and the Judge **counts** it toward the React numerator under the T016 charter ruling, so React-lineage readiness is **6/6**.
- tiny-translator Angular CLI 1.5.4→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, an eleven-major lift whose era-defect service-worker registration is **recorded, not masked**, and the Judge **counts** it toward the Angular numerator under the T016 charter ruling, so Angular-lineage readiness is **4/4**.
- super-productivity Angular CLI 8.3.4→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, an eight-major lift whose declared cross-lane appearance differences and unseeded Sass random() build instability across the supersede boundary are **recorded, not masked**, and the Judge **counts** it toward the Angular numerator under the T016 charter ruling, so Angular-lineage readiness is **4/4**.
- Older-Next direct-Witness candidate: **verified; the olderNext 0/4 separate numerator is retired to an informational React sub-tag under the T016 charter ruling (Next.js-on-React is React-lineage, not a separate oracle lineage)**.
- Holdout `holdout-react-cypress-rwa` (cypress-realworld-app, react lineage): **attempted; outcome failed**. Baseline lane green, migrated lane red identically across 2 attempts against frozen adapter composite `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77` with 0 adapter bytes changed. Recorded missing capability for the follow-on tranche: **non-UTF-8 module source decoding**. It is **counted in no lineage numerator** and published rather than dropped: [evidence/runs/holdout-react-cypress-rwa/receipt.json](../../../evidence/runs/holdout-react-cypress-rwa/receipt.json) `7ec6f18b27d2967cd533ba89505e8a76590c1866aec8bd7a8d8543cd87743aae`.
- Holdout `holdout-angular-pigallery2` (pigallery2, angular lineage): **attempted; outcome failed**. Baseline lane green, migrated lane red identically across 3 attempts against frozen adapter composite `4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7` with 0 adapter bytes changed. Recorded missing capability for the follow-on tranche: **consumption of pre-Ivy-only dependencies with no published Ivy successor at the Angular 16 target cell**. It is **counted in no lineage numerator** and published rather than dropped: [evidence/runs/holdout-angular-pigallery2/receipt.json](../../../evidence/runs/holdout-angular-pigallery2/receipt.json) `39a133ff97c37622a4a1821f20e7c442c9bc22ed7597a3e73cbd31323ab2bb10`.
- Holdout `holdout-angular-eshop-webspa` (eShopOnContainers WebSPA, angular lineage): **attempted; outcome witness-passed-on-bounded-anonymous-catalog-surface**. Baseline lane green; migrated lane red at install against frozen adapter composite `f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012` with 0 adapter bytes changed, and green across 2 byte-identical production builds after the authorized T024 Angular-subtree reopen re-frozen at `27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234`. Witness (`lrapr-t024/u6-eshop-witness-journeys`): **passed-on-bounded-surface** — 4 runs over 7 recorded legs, behaviour parity digest `585ae9ecdf637ace7031624b00750a3c03c7f8f900e60017c55b8ee4f973a363`; browser proof **verified-on-bounded-anonymous-catalog-surface** on the **anonymous-catalog** surface only. Still unproven: **every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent**. This is a **pass on a bounded surface and not a generic pass**, it is **counted in no lineage numerator**, and the earlier RED is published rather than retracted: [evidence/runs/holdout-angular-eshop-webspa/receipt.json](../../../evidence/runs/holdout-angular-eshop-webspa/receipt.json) `fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9`.
- Boundary `angular-16-pre-ivy-only-dependency` at cell `angular-16-browser-builder` (angular lineage): **unsupported** — pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell. Angular 16 removed ngcc, so ViewEngine bytes cannot be consumed at this cell, and a library whose last published version is pre-Ivy has no successor to align to. Carrying such an application would require editing its source at the import sites, which is an application change rather than a migration the engine can perform. Declared by lrapr-t022 boundary ruling (Judge, 2026-08-14); **not-certified: this cell is declared unsupported, not tested-and-failed-once**. Instance evidence: pigallery2, 3 libraries at 6 import sites — `@yaga/leaflet-ng2` (last published 1.1.0; `frontend/app/app.module.ts:14`, `frontend/app/ui/gallery/map/map.gallery.component.ts:7`, `frontend/app/ui/gallery/map/lightbox/lightbox.map.gallery.component.ts:16`), `ng2-slim-loading-bar` (last published 4.0.0; `frontend/app/app.module.ts:31`, `frontend/app/model/network/network.service.ts:4`), `jw-bootstrap-switch-ng2` (last published 2.0.5; `frontend/app/app.module.ts:41`) — recorded RED in [evidence/runs/holdout-angular-pigallery2/receipt.json](../../../evidence/runs/holdout-angular-pigallery2/receipt.json) `39a133ff97c37622a4a1821f20e7c442c9bc22ed7597a3e73cbd31323ab2bb10`.
  - No claim that every application carrying a pre-Ivy-only dependency is unmigratable in general: the boundary is declared at the Angular 16 target cell, which is the only Angular cell this engine has.
  - No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.
  - No claim that the boundary excuses the pigallery2 RED. The RED is permanent falsification evidence and is published unchanged alongside this declaration.
  - Reading rule `successor-across-names` (ecosystem-availability-fact): A successor reading counts across package names: a dependency has a published Ivy successor when registry deprecation metadata names the successor and that named successor ships published Ivy bytes, even where the successor carries a different package name than the dependency it replaces. The rule reads published registry metadata and published bytes only. It says nothing about whether the frozen adapter carries the corresponding migration; that is what a holdout run measures, and a RED there is valid falsification rather than a boundary.
  - Reading rule `declared-but-never-imported-is-not-active-use` (ecosystem-availability-fact): A dependency that a manifest declares but the application never imports is not in active application use, and therefore cannot fail the boundary. Active use means an import site in the pinned application source on the build path. The rule is settled by reading the pinned source for import sites, never by asking what a migration would have to do with the dependency.
  - Prevalence (**5-of-6**, lrapr-t022 boundary ruling, follow-up ruling (Judge, 2026-08-14) after the gate-zero screen): The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5. 1 tested-and-failed (pigallery2); 4 screened-and-failed (cyclos4-ui, ngx-starter-kit, tabby, coreui-free-angular-admin-template); eShopOnContainers carries a first-party-successor removal and is **not counted** in the prevalence.
  - Population: Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.
- [Data-flow and control mappings](controls.json) — review inputs, not audit conclusions.
- [Retention and purge status](retention.json) — unresolved policy remains unknown/not-tested.

The dependency graph is a rooted complete inventory. Exact transitive dependency topology is not proven.

## Receipt preservation

- `evidence/runs/react-boilerplate-v4/t008-run.json`: `4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758` (verified)
- `evidence/runs/angular-phonecat/t014-run.json`: `a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51` (verified)
- `evidence/runs/react-boilerplate-v4-node24/t022-run.json`: `815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593` (verified)
- `evidence/runs/react-boilerplate-v4-vite8/t028-run.json`: `1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849` (verified)
- `evidence/runs/angular-phonecat-route-resolve/t032-run.json`: `aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef` (verified)
- `evidence/runs/angular-phonecat-composed/t048-run.json`: `a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12` (verified)
- `evidence/runs/react-boilerplate-v4-data-flow/t054-run.json`: `2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da` (verified)
- `evidence/runs/react-boilerplate-v4-composed/t060-run.json`: `52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21` (verified)
- `evidence/runs/angular-phonecat-vite8/t069-run.json`: `033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d` (verified)
- `evidence/runs/angular-realworld-v15-to-v16/receipt.json`: `bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1` (verified)
- `evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json`: `a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c` (verified)
- `evidence/runs/witness-angular-realworld/receipt.json`: `122496b1ccb5c1da57945868cdea5bb93fab90164534efa5867025d25c01df34` (verified)
- `evidence/runs/witness-react-boilerplate/receipt.json`: `bfa48f718ee86566f120cb0bc42645b22c989a27d87c102b9c2f256d15661ed7` (verified)
- `evidence/runs/witness-next-killedbygoogle/receipt.json`: `da376ad77386a9f48c9be076fbe2131ebc249338df8f38f415e5830659a3f2ef` (verified)
- `evidence/runs/react-boilerplate-v4-zero-sw/t693-run.json`: `386620d0dadad7d201d62965d72d79f37ee6aad69447669e4691787b3e2ef6e6` (verified)
- `evidence/runs/witness-react-boilerplate-zero-sw/receipt.json`: `dcdc57f078d9d7bdfdfd290a7f6b1abe78924581796ff3aaefa6c7e4ba38b527` (verified)
- `evidence/runs/react-papercups-v1-0-0/t004-run.json`: `b433f214727389676b308332f7689d773ad28dde0984b9bf245f3f780f87d35a` (verified)
- `evidence/runs/witness-react-papercups/receipt.json`: `abd33d566ecef3ce4b24470c3105320520a712db19351f74b6c887b63227f267` (verified)
- `evidence/runs/react-hospitalrun/t004-run.json`: `1fa0278923101efe6af370a44d0ef90e3309ac4c7a823fad448eb196cca37cd8` (verified)
- `evidence/runs/witness-react-hospitalrun/receipt.json`: `275e435c8518f8978782e6c555ad8c4dd0d6e5401e2ef1acef8856f596648aaa` (verified)
- `evidence/runs/witness-angular-factoriolab/receipt.json`: `2e7da3056e489958d868917155b6ded61f014b046ee2b020c20ad71a31d86cdd` (verified)
- `evidence/runs/witness-angular-jira-clone/receipt.json`: `4642564e7ee1ff46668cce76c5db0dc832cce41afe1ceda5611fa2eaf78dfc99` (verified)
- `evidence/runs/witness-react-memos-v0-1-3/receipt.json`: `71964ddaba63710462e1c6faa6322598a4afb0800f3c4826c7ef4e5a6ca01cfa` (verified)
- `evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.json`: `660cb5027139735a5174a5bb8e89fceb9fa6b0327f4a479e174137e789d52a79` (verified)
- `evidence/runs/witness-react-linkfree-v0-72-0/receipt.json`: `2277ad1947280d898f577f418f8b4a34ca775b91156bc1e1de488bde28eae4ba` (verified)
- `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json`: `65b0a976823010e224ee76058e14d4dfee4ac643c8a32826128968a754c083ca` (verified)
- `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json`: `5d8ed797897b7ad05bda5daf2a15c1634aec5252bd3addbe3b31b5a3f327e365` (verified)

## Adapter freeze and capability status

Frozen at commit `0ecd410691df10fbc68c9ddcd012dafa86aba536`; composite SHA-256 `27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234` over the newline-terminated `<path> <tree-oid>` lines below, in order.

- `packages/frameworks/react` `972ca80155bbc2a6eb3779943cd481b71d35e803`
- `packages/frameworks/angular` `4b6e2f4494d98582e4fe9b420c2b412059dc0720`
- `packages/core/src/migrations` `5237ce5990af3623206bcd2301047a59c80731cf`
- `packages/core/src/bundlers` `cec2f0b56fbb7897f38d579be805e19982380ca6`
- `packages/core/src/analysis` `262dc8b7528c92883c2300914eb7d42579fb856b`

Cross-proven on two independent applications each, and therefore in the matrix:

- react: `react-cra-vite-adapter`
- angular: `angular-target-cell`
- angular: `angular-workspace-migration`
- angular: `angular-source-migration`
- angular: `angular-cli-era-migration`

Proven on exactly one application and therefore **experimental / out-of-matrix** pending T006 second-application evidence:

- react: `connect-to-hooks`
- react: `class-lifecycle-to-hooks`
- react: `data-flow-connect-to-hooks`
- react: `composed-migration`
- react: `react-cra-process-global`
- angular: `custom-webpack-absorption`
- angular: `sentry-v8-migration`
- angular: `package-exports-style-imports`
- angular: `modal-content-params-migration`
- angular: `undeclared-runtime-dependency`
- angular: `tslint-toolchain-removal`
- angular: `ngrx-effects-migration`
- angular: `module-with-providers-type-argument`
- angular: `subject-void-type-argument`
- angular: `promise-executor-void-parameter`
- angular: `unparameterised-base-class`
- angular: `deep-import-redirection`
- angular: `family-prefixed-ecosystem-readings`
- angular: `install-stage-successor-readings`
- angular: `compile-stage-published-bytes-verdicts`
- angular: `workspace-engines-retarget`
- angular: `undecorated-angular-base-class`
- angular: `application-source-dependency`
- angular: `departed-dom-lib-member`
- angular: `unread-declaration-silence-reporting`
- angular: `angular-16-community-layer-readings`
- angular: `superseded-era-lockfile`
- angular: `workspace-script-flags`
- angular: `use-position-symbol-successor`
- angular: `removed-static-module-method`
- angular: `rxjs-prototype-patch-and-tilde-sass-composition`
- angular: `http-client-call-surface`
- angular: `package-exports-republished-subpath`

Both Angular holdouts were ingested under the mandatory license-text-at-pin pre-screen and run. pigallery2 1.7.0 is **RED**, at the declared pre-Ivy-only-dependency support boundary above. The eShopOnContainers WebSPA was **RED at install** under the superseded `f1a63359` composite; after the authorized T024 reopen its migrated production build completes twice byte-identically, and the T024 u6 Witness — run after the re-freeze, against the bytes that build emitted — is green across two lanes observed twice each on one behaviour parity digest, with a mutation-red and byte-restore proof and zero successful non-loopback requests. That Witness covers the **anonymous catalog surface only**: identity, basket, orders and campaigns are out of surface, the SignalR hub was never reached, and text entry and drag were not tested, so the entry is published under its exact receipt outcome `witness-passed-on-bounded-anonymous-catalog-surface` — a **pass on a bounded surface** — and never as a generic pass. Both Angular-subtree reopens are recorded in the freeze's supersession record, and every capability either of them produced is in the experimental list above.

## Capability-coverage map

The map is the machine-readable evidence record [capability-coverage.json](capability-coverage.json); classification is derived from the count of distinct independent applications and is never hand-set. A capability is claimed **general** only once at least 2 independent applications prove it.

- React lineage: 1/8 capabilities cross-proven.
- Angular lineage: 7/50 capabilities cross-proven.
- Total: **8 cross-proven (in-matrix)**, **50 experimental (out-of-matrix)** across 58 enumerated capabilities.

Cross-proven on at least two independent applications, and therefore in the matrix:

- react: `react-cra-vite-adapter` — 3 application(s) (papercups, react-hospitalrun, react-linkfree)
- angular: `angular-target-cell` — 4 application(s) (angular-factoriolab, angular-jira-clone, angular-super-productivity, angular-tiny-translator)
- angular: `angular-workspace-migration` — 4 application(s) (angular-factoriolab, angular-jira-clone, angular-super-productivity, angular-tiny-translator)
- angular: `angular-source-migration` — 4 application(s) (angular-factoriolab, angular-jira-clone, angular-super-productivity, angular-tiny-translator)
- angular: `ngrx-effects-migration` — 2 application(s) (angular-factoriolab, angular-super-productivity)
- angular: `webpack-tilde-style-specifier` — 2 application(s) (angular-super-productivity, angular-tiny-translator)
- angular: `barrel-entry-point-split` — 2 application(s) (angular-super-productivity, angular-tiny-translator)
- angular: `angular-cli-era-migration` — 4 application(s) (angular-factoriolab, angular-jira-clone, angular-super-productivity, angular-tiny-translator)

Proven on fewer than two independent applications — single-application or unproven coverage — and therefore **experimental / out-of-matrix**:

- react: `react-cra-process-global` — 1 application(s) (cypress-realworld-app)
- react: `react-next-static-adapter` — 1 application(s) (next-killedbygoogle)
- react: `react-vite-origin-adapter` — 1 application(s) (react-memos)
- react: `react-connect-to-hooks` — 1 application(s) (react-boilerplate)
- react: `react-data-flow-connect-to-hooks` — 1 application(s) (react-boilerplate)
- react: `react-composed-migration` — 1 application(s) (react-boilerplate)
- react: `react-class-lifecycle-to-hooks` — 1 application(s) (react-avataaars)
- angular: `template-analysis` — 1 application(s) (angular-fuxa)
- angular: `semantic-module` — 1 application(s) (angular-super-productivity)
- angular: `undeclared-runtime-dependency` — 0 application(s) (unproven coverage)
- angular: `package-exports-style-imports` — 1 application(s) (angular-eshop-webspa)
- angular: `modal-content-params-migration` — 1 application(s) (angular-jira-clone)
- angular: `custom-webpack-absorption` — 1 application(s) (angular-jira-clone)
- angular: `tslint-toolchain-removal` — 1 application(s) (angular-jira-clone)
- angular: `font-inlining-disable` — 1 application(s) (angular-tiny-translator)
- angular: `angular-cli-json-workspace-synthesis` — 1 application(s) (angular-tiny-translator)
- angular: `builder-package-declaration` — 0 application(s) (unproven coverage)
- angular: `node-core-binding-migration` — 1 application(s) (angular-tiny-translator)
- angular: `node-core-runtime-globals` — 1 application(s) (angular-tiny-translator)
- angular: `template-i18n-runtime` — 1 application(s) (angular-tiny-translator)
- angular: `rxjs-prototype-patch-migration` — 1 application(s) (angular-tiny-translator)
- angular: `deep-import-redirection` — 1 application(s) (angular-tiny-translator)
- angular: `entry-components-removal` — 1 application(s) (angular-tiny-translator)
- angular: `module-with-providers-type-argument` — 1 application(s) (angular-tiny-translator)
- angular: `widened-union-narrowing` — 1 application(s) (angular-tiny-translator)
- angular: `forms-legacy-disabled-state` — 1 application(s) (angular-tiny-translator)
- angular: `template-binding-reorder` — 1 application(s) (angular-super-productivity)
- angular: `declared-type-member-rename` — 1 application(s) (angular-super-productivity)
- angular: `json-module-named-import` — 1 application(s) (angular-super-productivity)
- angular: `promise-executor-void-parameter` — 1 application(s) (angular-super-productivity)
- angular: `removed-entry-point-symbol-successor` — 1 application(s) (angular-super-productivity)
- angular: `sass-mixin-hyphenation-successor` — 1 application(s) (angular-super-productivity)
- angular: `split-element-successor` — 1 application(s) (angular-super-productivity)
- angular: `stylesheet-url-rebase` — 1 application(s) (angular-super-productivity)
- angular: `subject-void-type-argument` — 1 application(s) (angular-super-productivity)
- angular: `successor-fork-package` — 1 application(s) (angular-super-productivity)
- angular: `suggested-export-rename` — 1 application(s) (angular-super-productivity)
- angular: `unparameterised-base-class` — 1 application(s) (angular-super-productivity)
- angular: `web-worker-url-specifier` — 1 application(s) (angular-super-productivity)
- angular: `synthetic-default-import-interop` — 1 application(s) (angular-super-productivity)
- angular: `sentry-v8-migration` — 1 application(s) (angular-jira-clone)
- angular: `workspace-engines-retarget` — 1 application(s) (angular-pigallery2)
- angular: `undecorated-angular-base-class` — 1 application(s) (angular-pigallery2)
- angular: `application-source-dependency` — 1 application(s) (angular-pigallery2)
- angular: `use-position-symbol-successor` — 1 application(s) (angular-eshop-webspa)
- angular: `removed-static-module-method` — 1 application(s) (angular-eshop-webspa)
- angular: `http-client-call-surface` — 1 application(s) (angular-eshop-webspa)
- angular: `superseded-era-lockfile` — 1 application(s) (angular-eshop-webspa)
- angular: `workspace-script-flags` — 1 application(s) (angular-eshop-webspa)
- angular: `departed-dom-lib-member` — 1 application(s) (angular-pigallery2)

## Known gaps

- Root license text: **unknown** (absent; the package manifest expression is not license text).
- SECURITY.md: **unknown** (absent).
- Git provenance and official CI identity: **unknown** (repository metadata is absent).
- Project signing identity and signer authenticity: **unknown**.
- TakeNote designated React pilot: **not-tested**.
- Angular2-HN designated Angular 2+ pilot, Angular CLI, and AOT: **not-tested**.
- Maintained React target coverage is limited to the verified React Boilerplate lane.
- Old-Vite migration and generic/unplugin adapter evidence: **not-tested**.
- Generic Next.js support, synthetic Next.js lanes, Tier, pilot status, and production readiness remain **not-tested** or not claimed; the verified Killed by Google evidence is fixture-specific.
- The Vite adapter is **fixture-specific**; generic adapter: **not-tested**; unplugin portability: **not-tested**.
- React connect-to-hooks data-flow migration proof is limited to the exact HomePage and RepoListItem shapes in the verified fixture.
- Angular PhoneCat is AngularJS special-track/static evidence, not Angular 2+, Angular CLI/AOT, adjacent-major, or designated Angular-pilot proof.
- PhoneCat route-resolve and one-way component-binding proof is limited to the verified AngularJS static lane.
- PhoneCat lexical-this plus route-resolve composition is order-independent for the exact verified AngularJS special-track shapes; it is not Angular 2+ or bundler proof.
- PhoneCat Vite 8 evidence uses a fixture-specific adapter; old Vite and unplugin portability are **not-tested**. Service worker and PWA behavior are **out of scope**.
- Angular RealWorld proves one immutable Angular 15→16 CLI/Architect production-AOT adjacent-major vertical with process-scoped locality; it is not generic Angular support or a designated pilot. Its standalone direct-Witness production-readiness cell is verified for this exact lineage only.
- Locality evidence is process-scoped and does not establish OS-wide isolation.
