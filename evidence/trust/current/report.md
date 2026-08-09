# Versionless project trust package

- Canonical SHA-256: `4c113b0567e0019fb7d88851c639fdad1e687af3a0232126887386c31044a791`
- Deterministic core: `8c4c293b8e6b6044f886f96fe48f99288448ec2ed462ac28e1c319aa478d659f`
- Generated observation: `2026-08-09T10:40:50.015Z`
- Vulnerability input freshness: **verified** (seven-day maximum age)
- Integrity: **hash-only; authenticity is not established**
- Assurance: **this package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation**

## Contents

- [CycloneDX 1.7 dependency graph](dependency-graph.cdx.json) — locally profile-validated; this is not independent or official certification.
- [License inventory](licenses.json) — SPDX expressions: 89 verified, 108 unknown, 0 ambiguous; license texts: 77 verified, 120 unknown, 0 ambiguous.
- [Vulnerability and KEV report](vulnerabilities.json) — cached OSV batch and CISA KEV observations only.
- [SLSA/in-toto-shaped provenance](provenance.json) — shape only; no SLSA level or signer authenticity is claimed.
- [Supported corpus/runtime/bundler matrix](matrix.json) — unsupported and untested cells remain visible.
- [Corpus conformance](corpus-conformance.json) — `e74c36bce753d7f0c0193fffb562ae3803458c4682426021b9a26a166eb8c032`; 11 verified verticals grouped into exactly 4 source applications; zero designated pilots are verified.
- The immutable Killed by Google Next.js 12 Pages/webpack production vertical is verified only for its exact fixture; synthetic Next.js 12 Pages, 13 transition/App, and 14 App classification lanes remain **not-tested**, and generic Next.js support is not claimed.
- [Static script/resource surface](script-surface.json) — truthfully remains scoped to the prior nine verticals, two applications, and eighteen exact static deployment entrypoints; T220 is **not included** because its script surface was not separately observed; dynamic script insertion: **not-tested**; payment-page applicability: **not established**; PCI compliance is **not claimed**.
- [Qualified-journey runtime script observation](runtime-script-observation.json) — truthfully remains scoped to 36 runs across the prior nine verticals, two applications, and eighteen lanes; T220 is **not included** because its runtime scripts were not separately observed; this is **not global dynamic-insertion coverage**.
- React Boilerplate maintained-runtime proof is limited to Node 24.15.0 darwin-arm64 with webpack 4.47.0 and a separate fixture-specific Vite 8.0.16 build; other maintained targets remain unproved.
- Angular-lineage production readiness: **1/4**; Harness qualification: **0/4**. PhoneCat remains unsupported for the required visible transition and is not counted.
- React-lineage production readiness: **1/4; Judge approved**.
- Older-Next direct-Witness candidate: **verified, not counted (0/4) pending final Judge audit**.
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
- `evidence/runs/witness-angular-realworld/receipt.json`: `acd4f259f9372dd58b5267001469c2b68657d708c4d2a311df71a5a171b21128` (verified)
- `evidence/runs/witness-react-boilerplate/receipt.json`: `bfa48f718ee86566f120cb0bc42645b22c989a27d87c102b9c2f256d15661ed7` (verified)
- `evidence/runs/witness-next-killedbygoogle/receipt.json`: `da376ad77386a9f48c9be076fbe2131ebc249338df8f38f415e5830659a3f2ef` (verified)

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
