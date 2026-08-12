# Versionless project trust package

- Canonical SHA-256: `348fefdd8d2866e861c0b9a76df90d4d87dfcc40e57bd8f137927e53a84d497b`
- Deterministic core: `2e4cb3f13c2a739d19b080dfb83d4cb424f691570034acc89b9d85113206d2de`
- Generated observation: `2026-08-12T19:47:49.926Z`
- Vulnerability input freshness: **verified** (seven-day maximum age)
- Integrity: **hash-only; authenticity is not established**
- Assurance: **this package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation**

## Contents

- [CycloneDX 1.7 dependency graph](dependency-graph.cdx.json) — locally profile-validated; this is not independent or official certification.
- [License inventory](licenses.json) — SPDX expressions: 89 verified, 108 unknown, 0 ambiguous; license texts: 77 verified, 120 unknown, 0 ambiguous.
- [Vulnerability and KEV report](vulnerabilities.json) — cached OSV batch and CISA KEV observations only.
- [SLSA/in-toto-shaped provenance](provenance.json) — shape only; no SLSA level or signer authenticity is claimed.
- [Supported corpus/runtime/bundler matrix](matrix.json) — unsupported and untested cells remain visible.
- [Adapter freeze record](adapter-freeze.json) — the migration engine adapter surface is frozen at commit `57b308a573dd582c844ce401fb1161cd70e9bc66` with composite SHA-256 `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77`; the receipts, corpus, and witness registries are deliberately **outside** the freeze so holdout evidence can still be published additively.
- [Corpus conformance](corpus-conformance.json) — `f0087f090c98c344561676408e7a8d4d3f63edf1cd6fde23f74d5682d7f226db`; 20 verified verticals grouped into exactly 12 source applications; zero designated pilots are verified.
- The immutable Killed by Google Next.js 12 Pages/webpack production vertical is verified only for its exact fixture; synthetic Next.js 12 Pages, 13 transition/App, and 14 App classification lanes remain **not-tested**, and generic Next.js support is not claimed.
- [Static script/resource surface](script-surface.json) — truthfully remains scoped to the prior nine verticals, two applications, and eighteen exact static deployment entrypoints; T220 is **not included** because its script surface was not separately observed; dynamic script insertion: **not-tested**; payment-page applicability: **not established**; PCI compliance is **not claimed**.
- [Qualified-journey runtime script observation](runtime-script-observation.json) — truthfully remains scoped to 36 runs across the prior nine verticals, two applications, and eighteen lanes; T220 is **not included** because its runtime scripts were not separately observed; this is **not global dynamic-insertion coverage**.
- React Boilerplate maintained-runtime proof is limited to Node 24.15.0 darwin-arm64 with webpack 4.47.0 and a separate fixture-specific Vite 8.0.16 build; other maintained targets remain unproved.
- Angular-lineage production readiness: **2/4**; Harness qualification: **0/4**. PhoneCat remains unsupported for the required visible transition and is not counted. Angular RealWorld's browser proof stays verified and retained but is **not counted** toward the numerator: its migration changed zero application files, so it is a dependency version bump rebuilt under AOT rather than a proven application migration.
- React-lineage production readiness: **3/4; Judge approved**.
- React Boilerplate current zero-service-worker policy reconciliation: **verified; the aligned React Boilerplate cell is Judge-counted**. The original offline-first evidence remains retained.
- Papercups v1.0.0 create-react-app→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, and the Judge **counts** it, so React-lineage readiness is **3/4**.
- HospitalRun v2.0.0-alpha.7 create-react-app→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its baseline/migrated service-worker difference is **recorded, not masked**, and the Judge **counts** it with that difference visible, so React-lineage readiness is **3/4**.
- factoriolab Angular CLI 10.1→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, it really rewrote application source across six majors, and the Judge **counts** it, so Angular-lineage readiness is **2/4**.
- jira-clone Angular CLI 13.2 custom-webpack→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, the second counted Angular application, and the Judge **counts** it, so Angular-lineage readiness is **2/4**.
- memos v0.1.3 Vite 2.9.5→Vite 8 old-Vite-origin direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, the first React-lineage vertical whose origin bundler is Vite rather than webpack, and React-lineage readiness stays **3/4** because this vertical is explicitly **not counted**.
- killedbygoogle v3.0.0 Next 12 static-export→Vite 8 client-build direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its baseline/migrated document-delivery difference is **recorded, not masked**, and Next-lineage readiness stays **0/4** because this vertical is explicitly **not counted**.
- LinkFree v0.72.0 create-react-app 5→Vite 8 direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, its proof ran over a **synthetic profile corpus** staged through the application's own codegen rather than the shipped dataset, and React-lineage readiness stays **3/4** because this vertical is explicitly **not counted**.
- tiny-translator Angular CLI 1.5.4→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, an eleven-major lift whose era-defect service-worker registration is **recorded, not masked**, and Angular-lineage readiness stays **2/4** because this vertical is explicitly **not counted**.
- super-productivity Angular CLI 8.3.4→Angular 16.2 browser-builder direct-Witness browser proof: **verified for this exact fixture**; it is a separate immutable source application and a separate vertical, an eight-major lift whose declared cross-lane appearance differences and unseeded Sass random() build instability across the supersede boundary are **recorded, not masked**, and Angular-lineage readiness stays **2/4** because this vertical is explicitly **not counted**.
- Older-Next direct-Witness candidate: **verified, not counted (0/4) pending final Judge audit**.
- Holdout `holdout-react-cypress-rwa` (cypress-realworld-app, react lineage): **attempted; outcome failed**. Baseline lane green, migrated lane red identically across 2 attempts against frozen adapter composite `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77` with 0 adapter bytes changed. Recorded missing capability for the follow-on tranche: **non-UTF-8 module source decoding**. It is **counted in no lineage numerator** and published rather than dropped: [evidence/runs/holdout-react-cypress-rwa/receipt.json](../../../evidence/runs/holdout-react-cypress-rwa/receipt.json) `7ec6f18b27d2967cd533ba89505e8a76590c1866aec8bd7a8d8543cd87743aae`.
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

Frozen at commit `57b308a573dd582c844ce401fb1161cd70e9bc66`; composite SHA-256 `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77` over the newline-terminated `<path> <tree-oid>` lines below, in order.

- `packages/frameworks/react` `ae219d37efe52b2aebd51d116108169a0456ad93`
- `packages/frameworks/angular` `46ed07a7ff95277dfd99e7cddb14bd8cf806719b`
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
- angular: `custom-webpack-absorption`
- angular: `sentry-v8-migration`
- angular: `package-exports-style-imports`
- angular: `modal-content-params-migration`
- angular: `undeclared-runtime-dependency`
- angular: `tslint-toolchain-removal`
- angular: `ngrx-effects-migration`

Angular holdout ingestion is **deferred post-T006**, and no candidate is admitted without a mandatory license-text-at-pin pre-screen.

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
