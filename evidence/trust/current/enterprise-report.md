# Versionless enterprise evidence report

One machine artifact for an enterprise reviewer, derived entirely from canonical receipts the trust package already verified. It states what was proven, on which sources, with which tools, under which commands, and — in the same document — what is unsupported, unknown, or deliberately not claimed.

- Trust manifest canonical SHA-256: `c54ef520e6f725c4389653f0d78a8e9ccdf3af3d4de1297147e63106f58936a3`
- Deterministic core: `f29165f7e62c18a36bc73e8b4a3c26b473a61ad537bdfbc0898631a313242c01`
- Corpus conformance: `532eb5b705104f9f9af3e0dc8ae028c36b20e3ba4ade4c438533e3f341418965`
- Adapter freeze: commit `ddc2870aa934be7c8bc6caaeca74095d270776d5`, composite `140ce86e163ddbae2ad6f1504022efca9468641cc50fd3dca354c6aba8cbb562`
- Certification: **not-certified** — This package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation.
- Integrity: **hash-only; authenticity is not established**; SLSA level: **not-claimed**

The machine artifact for this document is [`enterprise-report.json`](enterprise-report.json). Both are regenerated from the same canonical receipts and compared at verification time, so an edit to either fails verification rather than changing a claim.

## 1. Sources and rights

| Application | Repository | Archive SHA-256 | License | License SHA-256 | Pinned revision |
| --- | --- | --- | --- | --- | --- |
| react-boilerplate | https://github.com/react-boilerplate/react-boilerplate | `d6ca60a3c8881ae2be26a8d04e00da4d922a6653f8512f2b12ac55d48f2ce2d5` | MIT | `e773e6b91c13f55310668e15ce178a2fcf779ff39dbcc0b910b4b5f1ecb17acb` | `corpus-conformance.json` → `applications[].source.revision for react-boilerplate` |
| angular-phonecat | https://github.com/angular/angular-phonecat | `c7624a333ddfaa31f51385e72b8966162171e798ec63a1b991ec4bde26339eb1` | MIT | `bab10b0aa126d9fdb81380141fc8845a74024d7c9977e5636afd06fe5edce455` | `corpus-conformance.json` → `applications[].source.revision for angular-phonecat` |
| angular-realworld | https://github.com/realworld-apps/angular-realworld-example-app | `b834410ded0baae07950ba680d2ee82a5d7b797ee01bd86d9a901d3e696544a2` | MIT | `dd241fc76d00987f9a025558ec977a2df69875320ab0379bd8f5865ad1033c7b` | `corpus-conformance.json` → `applications[].source.revision for angular-realworld` |
| killedbygoogle | https://github.com/codyogden/killedbygoogle | `c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d` | MIT | `not-recorded-in-the-corpus-record` | `corpus-conformance.json` → `applications[].source.revision for killedbygoogle` |
| papercups | https://github.com/papercups-io/papercups | `f8a6576c0399e1eca5e1936a9e5e5b311798cccf3cb7c6fcce0cecbf8b46ea8f` | MIT | `cd94b1bf29eec689bd048f0f202c038d2d3033d80102a7ff47ddf65d2890291c` | `corpus-conformance.json` → `applications[].source.revision for papercups` |
| react-hospitalrun | https://github.com/HospitalRun/hospitalrun-frontend | `c9d07e8ee7ffaa174dff597dcecbd00c8eb0b6d525bb7a3f9a7d48e6a46ec306` | MIT | `460148c79f31dd2a352b401068e0ae512a807cf643edac512eb22cf3342027a3` | `corpus-conformance.json` → `applications[].source.revision for react-hospitalrun` |
| angular-factoriolab | https://github.com/factoriolab/factoriolab | `11f2ce939f4be04b11e77b7f12e13d7449bf944b9bfefbeca237c46dea12f7ed` | MIT | `d2556dbacc2d52cdda0e8b3ebd15b0492d34028074768b3683815540d17e71af` | `corpus-conformance.json` → `applications[].source.revision for angular-factoriolab` |
| angular-jira-clone | https://github.com/trungvose/jira-clone-angular | `d913ad5d4686b6a236799166c7c781f624b3901a1826304e00c36eca82896bc5` | MIT | `c45956b16a34a9e0c74a93163f497174e373623333e47ce3251b4d0107120b09` | `corpus-conformance.json` → `applications[].source.revision for angular-jira-clone` |
| react-memos | https://github.com/usememos/memos | `184834df7e2ea0272d21b4b0bfd7366986bc0aded740442aac91ca58d270f391` | MIT | `not-recorded-in-the-corpus-record` | `corpus-conformance.json` → `applications[].source.revision for react-memos` |
| react-linkfree | https://github.com/EddieHubCommunity/BioDrop | `7cef1a1c2ae251e3738d8b8a6c5fe94b118bf13d3a5bae7b522b8db9c1c334ef` | MIT | `3b5b430ae7e6151220591e69a8a056482a13d36518357c025619cf0d60be50bf` | `corpus-conformance.json` → `applications[].source.revision for react-linkfree` |
| angular-tiny-translator | https://github.com/martinroob/tiny-translator | `424209463bcccca1714d520e2f68c55d54b204c69367bbeefcdf930d01d3ac18` | MIT | `b33e2f180e3d22c42c1511895a448e9aafb848a51a43a9cfae163f19f7288fb9` | `corpus-conformance.json` → `applications[].source.revision for angular-tiny-translator` |
| angular-super-productivity | https://github.com/super-productivity/super-productivity | `dead2f5334350459f930f5d5235322e5af38e577c79557d3370e497bf15f24eb` | MIT | `2e279de19632b5694d24b0ac06fd5b837ec487bf821302d9ce195379850a5fcb` | `corpus-conformance.json` → `applications[].source.revision for angular-super-productivity` |
| react-coverview-a1470b01 | rutikwankhade/CoverView | `not-recorded-in-the-corpus-record` | MIT | `24ae4deeab7fd89fad4a57235ac34f0c562ede9989c22a4c5b3f9d9a0936af24` | `corpus-conformance.json` → `applications[].source.revision for react-coverview-a1470b01` |
| react-cra-redux-1a06509b | notrab/create-react-app-redux | `not-recorded-in-the-corpus-record` | MIT | `b2675162788a19ede4b69024906455b9032e8dadebb8bbccfb833c216c2c2124` | `corpus-conformance.json` → `applications[].source.revision for react-cra-redux-1a06509b` |
| react-flame-v2-4-0 | pawelmalak/flame | `not-recorded-in-the-corpus-record` | MIT | `fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43` | `corpus-conformance.json` → `applications[].source.revision for react-flame-v2-4-0` |
| react-your-spotify-1-5-0 | Yooooomi/your_spotify | `not-recorded-in-the-corpus-record` | GPL-3.0 | `230184f60bae2feaf244f10a8bac053c8ff33a183bcc365b4d8b876d2b7f4809` | `corpus-conformance.json` → `applications[].source.revision for react-your-spotify-1-5-0` |

Each application is pinned to an exact upstream revision. Those revisions are carried in [`corpus-conformance.json`](corpus-conformance.json) rather than restated here, and that record is itself bound by SHA-256 to the trust manifest above.

Ingested at a pin under recorded consent, with the license text hashed at that pin. No redistribution right beyond the upstream license is claimed.

## 2. Tool and target versions

Tool: `versionless-local-trust-generator`, adapter frozen at commit `ddc2870aa934be7c8bc6caaeca74095d270776d5` (composite `140ce86e163ddbae2ad6f1504022efca9468641cc50fd3dca354c6aba8cbb562`), network mode **offline**.

| Cell | Vertical | Lineage | Runtime | Bundler | Migration track |
| --- | --- | --- | --- | --- | --- |
| `react-boilerplate` | `react-boilerplate-v4` | react | Node 16.20.2 EOL compatibility sandbox | webpack 4.30.0 | not-recorded-in-the-corpus-record |
| `react-boilerplate` | `react-boilerplate-v4-node24` | react | Node 24.15.0 darwin-arm64 | webpack 4.47.0 | not-recorded-in-the-corpus-record |
| `react-boilerplate` | `react-boilerplate-v4-vite8` | react | Node 24.15.0 darwin-arm64 | Vite 8.0.16 | not-recorded-in-the-corpus-record |
| `react-boilerplate` | `react-boilerplate-v4-data-flow` | react | Node 24.15.0 darwin-arm64 | Vite 8.0.16 | not-recorded-in-the-corpus-record |
| `react-boilerplate` | `react-boilerplate-v4-composed` | react | Node 16.20.2 legacy / Node 24.15.0 target | webpack 4.30.0 / Vite 8.0.16 | not-recorded-in-the-corpus-record |
| `react-papercups-v1-0-0` | `react-papercups-v1-0-0` | react | node-16.20.2-to-node-24.15.0 | webpack-4.42.0-to-vite-8.0.16 | create-react-app-3.4.1-to-vite8-build |
| `react-hospitalrun` | `react-hospitalrun` | react | node-12.14.1-to-node-24.15.0 | webpack-4.42.0-to-vite-8.0.16 | create-react-app-3.4.4-to-vite8-build-and-boot |
| `react-memos-v0-1-3` | `react-memos-v0-1-3` | react | node-16.20.2-to-node-24.15.0 | vite-2.9.5-to-vite-8.0.16 | production-readiness-direct-witness-old-vite-origin-to-vite8 |
| `next-killedbygoogle-v3-0-0` | `next-killedbygoogle-v3-0-0` | react | node-16.20.2 | next-12.0.10-vendored-webpack-5-to-vite-8.0.16-rolldown | production-readiness-direct-witness-next12-static-export-to-vite8-client-build |
| `react-linkfree-v0-72-0` | `react-linkfree-v0-72-0` | react | node-16.20.2-to-node-24.15.0 | webpack-5.73.0-to-vite-8.0.16 | production-readiness-direct-witness-create-react-app-5-to-vite8 |
| `angular-factoriolab` | `angular-factoriolab` | angular | node-12.14.1-to-node-16.20.2 | angular-cli-10.1-browser-builder-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular10-to-angular16-browser-builder |
| `angular-jira-clone` | `angular-jira-clone` | angular | node-16.20.2 | angular-cli-13.2-custom-webpack-browser-builder-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular13-to-angular16-browser-builder |
| `angular-tiny-translator-v0-12-0` | `angular-tiny-translator-v0-12-0` | angular | node-8.9.3-to-node-16.20.2 | angular-cli-1.5.4-webpack-3.8.1-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular5-to-angular16-browser-builder |
| `angular-super-productivity-v2-13-15` | `angular-super-productivity-v2-13-15` | angular | node-12.14.1-to-node-16.20.2 | angular-cli-8.3.4-webpack-4-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular8-viewengine-to-angular16-browser-builder |

## 3. Hashes

- `adapter-freeze.json` — `0ffe4eb2552a07dd7db65faa0081f6f42073013d7fb05869c2b1bb798cdd8b51`
- `dependency-graph.cdx.json` — `ed441f628c684845764d5d11e702c55c81dc2032c4433bfdeedd70c3d519f4d2`
- `licenses.json` — `206eb9bccded1648e5a83536903264f96429f348bd7e7005541d1fb6d2900012`
- `vulnerabilities.json` — `aa2050bb6ef196b20f01e3d8b39d8299e8a36b34995ac174e17872e7c447f434`
- `provenance.json` — `26134057b74f1cc956bed0d752a89395166c0b9a7f793c8a8ed3c4ceea3940ee`
- `matrix.json` — `e616fd15930848b2ef5acb0e01efe55de247807e2de6bba39adf7aa58f516d6d`
- `controls.json` — `a5e61dcace162ce814347f931b6f4e4f59934ea1312df79d9c817c19e0e9bef4`
- `retention.json` — `f1a7f91607bca1de4cc15e2523a3d0791116acc9cfdf853c68b9b35aa2c07568`
- `corpus-conformance.json` — `6c4188449cae9940c89312a91cb2d0e6b93db43e5ced22273bd79c9dda707762`
- `script-surface.json` — `e10f554b46ddb275a94da16b89c3c265789724ad67aba3e5e5dddc8f0fa6b502`
- `runtime-script-observation.json` — `086e0c84d48c7f53a814f67a51b7c25239b6f413306361fde1cfdfc3a0f1afc2`
- `capability-coverage.json` — `0c566a4c48b93c75aa2b8a67b52214db1f4dcc227fd05982ed5cd489ff2cd590`

Receipt inventory (27 preserved receipts):

- `evidence/runs/react-boilerplate-v4/t008-run.json` — `4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758` (verified)
- `evidence/runs/angular-phonecat/t014-run.json` — `a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51` (verified)
- `evidence/runs/react-boilerplate-v4-node24/t022-run.json` — `815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593` (verified)
- `evidence/runs/react-boilerplate-v4-vite8/t028-run.json` — `1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849` (verified)
- `evidence/runs/angular-phonecat-route-resolve/t032-run.json` — `aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef` (verified)
- `evidence/runs/angular-phonecat-composed/t048-run.json` — `a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12` (verified)
- `evidence/runs/react-boilerplate-v4-data-flow/t054-run.json` — `2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da` (verified)
- `evidence/runs/react-boilerplate-v4-composed/t060-run.json` — `52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21` (verified)
- `evidence/runs/angular-phonecat-vite8/t069-run.json` — `033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d` (verified)
- `evidence/runs/angular-realworld-v15-to-v16/receipt.json` — `bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1` (verified)
- `evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json` — `a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c` (verified)
- `evidence/runs/witness-angular-realworld/receipt.json` — `122496b1ccb5c1da57945868cdea5bb93fab90164534efa5867025d25c01df34` (verified)
- `evidence/runs/witness-react-boilerplate/receipt.json` — `bfa48f718ee86566f120cb0bc42645b22c989a27d87c102b9c2f256d15661ed7` (verified)
- `evidence/runs/witness-next-killedbygoogle/receipt.json` — `da376ad77386a9f48c9be076fbe2131ebc249338df8f38f415e5830659a3f2ef` (verified)
- `evidence/runs/react-boilerplate-v4-zero-sw/t693-run.json` — `386620d0dadad7d201d62965d72d79f37ee6aad69447669e4691787b3e2ef6e6` (verified)
- `evidence/runs/witness-react-boilerplate-zero-sw/receipt.json` — `dcdc57f078d9d7bdfdfd290a7f6b1abe78924581796ff3aaefa6c7e4ba38b527` (verified)
- `evidence/runs/react-papercups-v1-0-0/t004-run.json` — `b433f214727389676b308332f7689d773ad28dde0984b9bf245f3f780f87d35a` (verified)
- `evidence/runs/witness-react-papercups/receipt.json` — `abd33d566ecef3ce4b24470c3105320520a712db19351f74b6c887b63227f267` (verified)
- `evidence/runs/react-hospitalrun/t004-run.json` — `1fa0278923101efe6af370a44d0ef90e3309ac4c7a823fad448eb196cca37cd8` (verified)
- `evidence/runs/witness-react-hospitalrun/receipt.json` — `275e435c8518f8978782e6c555ad8c4dd0d6e5401e2ef1acef8856f596648aaa` (verified)
- `evidence/runs/witness-angular-factoriolab/receipt.json` — `2e7da3056e489958d868917155b6ded61f014b046ee2b020c20ad71a31d86cdd` (verified)
- `evidence/runs/witness-angular-jira-clone/receipt.json` — `4642564e7ee1ff46668cce76c5db0dc832cce41afe1ceda5611fa2eaf78dfc99` (verified)
- `evidence/runs/witness-react-memos-v0-1-3/receipt.json` — `71964ddaba63710462e1c6faa6322598a4afb0800f3c4826c7ef4e5a6ca01cfa` (verified)
- `evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.json` — `660cb5027139735a5174a5bb8e89fceb9fa6b0327f4a479e174137e789d52a79` (verified)
- `evidence/runs/witness-react-linkfree-v0-72-0/receipt.json` — `2277ad1947280d898f577f418f8b4a34ca775b91156bc1e1de488bde28eae4ba` (verified)
- `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json` — `65b0a976823010e224ee76058e14d4dfee4ac643c8a32826128968a754c083ca` (verified)
- `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json` — `5d8ed797897b7ad05bda5daf2a15c1634aec5252bd3addbe3b31b5a3f327e365` (verified)

## 4. Commands

Every command below is the workspace script as committed; the receipt list is the manifest receipt inventory. All acceptance work runs offline under dual offline controls.

Generation:

```sh
pnpm run fixture:ingest
pnpm run trust:generate
pnpm run trust:ingest
```

Verification:

```sh
pnpm run corpus:verify
pnpm run fixture:verify
pnpm run receipt:verify
pnpm run runtime-script-observation:verify
pnpm run script-surface:verify
pnpm run trust:verify
```

Each preserved receipt is independently checkable with its own command, for example:

```sh
VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- evidence/runs/react-boilerplate-v4/t008-run.json
```

## 5. Locality

Mode **offline**; scope: Versionless-spawned processes and browser routing. OS-wide isolation: **false** — locality evidence is process-scoped and does not establish OS-wide isolation.

## 6. Journeys

| Cell | Vertical | Browser proof | Runs | Behaviour digest |
| --- | --- | --- | --- | --- |
| `react-boilerplate` | `react-boilerplate-v4` | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `not-recorded-in-the-corpus-record` |
| `react-boilerplate` | `react-boilerplate-v4-node24` | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `not-recorded-in-the-corpus-record` |
| `react-boilerplate` | `react-boilerplate-v4-vite8` | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `not-recorded-in-the-corpus-record` |
| `react-boilerplate` | `react-boilerplate-v4-data-flow` | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `not-recorded-in-the-corpus-record` |
| `react-boilerplate` | `react-boilerplate-v4-composed` | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `not-recorded-in-the-corpus-record` |
| `react-papercups-v1-0-0` | `react-papercups-v1-0-0` | verified-direct-witness | 4 | `a2d4dbb6f844dfb8ee2d78cfc64e9981b6a91186030f345a7e6ffb9975eb9917` |
| `react-hospitalrun` | `react-hospitalrun` | verified-direct-witness | 4 | `bb87c861e83fe5cdce99ba3c2ea6ef0523a66f4c1a75d8d8be0f10411c7b6fed` |
| `react-memos-v0-1-3` | `react-memos-v0-1-3` | verified-direct-witness | 4 | `d5e08daffeb7765ba6722700587762a702fe74b5357f32fa4d069512014ad934` |
| `next-killedbygoogle-v3-0-0` | `next-killedbygoogle-v3-0-0` | verified-direct-witness | 4 | `240554452bac31af556f6888c0fdb3a5523ff6cc6e839a5a345d64d8204a480f` |
| `react-linkfree-v0-72-0` | `react-linkfree-v0-72-0` | verified-direct-witness | 4 | `09432cbf2578c35c1d04e74219e8411c075505943914fbe91b197c2da46929a1` |
| `angular-factoriolab` | `angular-factoriolab` | verified-direct-witness | 4 | `77d9bf5fe4d72a7db2ca5dc760fd1ce3bd13a936b765b85bfa6cb0621022ae42` |
| `angular-jira-clone` | `angular-jira-clone` | verified-direct-witness | 4 | `18e281d93e0f50a632ed0a4c9bc613e9b5601ca0a5ec68a36c578e6ed6620308` |
| `angular-tiny-translator-v0-12-0` | `angular-tiny-translator-v0-12-0` | verified-direct-witness | 4 | `890ddd697619de1273c1bddf5cb504d7cad9eeb54c4503d8a458f3c72bd6405f` |
| `angular-super-productivity-v2-13-15` | `angular-super-productivity-v2-13-15` | verified-direct-witness | 4 | `d90ec2ca7e8ea609845518300d0b1e7d9f4908100bdabcc15b44879931dd380a` |

## 7. Results — supported and unsupported matrix

Every green cell below is filtered out of the Judge counting ledger the corpus derived and cross-checked against that corpus numerator and denominator. No cell is listed by hand, and a cell edited into this record fails re-derivation.

### React lineage — 6/6 counted green cells

| Cell | Application | Vertical | Runtime | Bundler | Migration track | Browser proof | Witness receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `react-boilerplate` | react-boilerplate | `react-boilerplate-v4` | Node 16.20.2 EOL compatibility sandbox | webpack 4.30.0 | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `evidence/runs/witness-react-boilerplate/receipt.json` |
| `react-boilerplate` | react-boilerplate | `react-boilerplate-v4-node24` | Node 24.15.0 darwin-arm64 | webpack 4.47.0 | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `evidence/runs/witness-react-boilerplate/receipt.json` |
| `react-boilerplate` | react-boilerplate | `react-boilerplate-v4-vite8` | Node 24.15.0 darwin-arm64 | Vite 8.0.16 | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `evidence/runs/witness-react-boilerplate/receipt.json` |
| `react-boilerplate` | react-boilerplate | `react-boilerplate-v4-data-flow` | Node 24.15.0 darwin-arm64 | Vite 8.0.16 | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `evidence/runs/witness-react-boilerplate/receipt.json` |
| `react-boilerplate` | react-boilerplate | `react-boilerplate-v4-composed` | Node 16.20.2 legacy / Node 24.15.0 target | webpack 4.30.0 / Vite 8.0.16 | not-recorded-in-the-corpus-record | not-recorded-in-the-corpus-record | `evidence/runs/witness-react-boilerplate/receipt.json` |
| `react-papercups-v1-0-0` | papercups | `react-papercups-v1-0-0` | node-16.20.2-to-node-24.15.0 | webpack-4.42.0-to-vite-8.0.16 | create-react-app-3.4.1-to-vite8-build | verified-direct-witness (4 runs) | `evidence/runs/witness-react-papercups/receipt.json` |
| `react-hospitalrun` | react-hospitalrun | `react-hospitalrun` | node-12.14.1-to-node-24.15.0 | webpack-4.42.0-to-vite-8.0.16 | create-react-app-3.4.4-to-vite8-build-and-boot | verified-direct-witness (4 runs) | `evidence/runs/witness-react-hospitalrun/receipt.json` |
| `react-memos-v0-1-3` | react-memos | `react-memos-v0-1-3` | node-16.20.2-to-node-24.15.0 | vite-2.9.5-to-vite-8.0.16 | production-readiness-direct-witness-old-vite-origin-to-vite8 | verified-direct-witness (4 runs) | `evidence/runs/witness-react-memos-v0-1-3/receipt.json` |
| `next-killedbygoogle-v3-0-0` | next-killedbygoogle-v3-0-0 | `next-killedbygoogle-v3-0-0` | node-16.20.2 | next-12.0.10-vendored-webpack-5-to-vite-8.0.16-rolldown | production-readiness-direct-witness-next12-static-export-to-vite8-client-build | verified-direct-witness (4 runs) | `evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.json` |
| `react-linkfree-v0-72-0` | react-linkfree | `react-linkfree-v0-72-0` | node-16.20.2-to-node-24.15.0 | webpack-5.73.0-to-vite-8.0.16 | production-readiness-direct-witness-create-react-app-5-to-vite8 | verified-direct-witness (4 runs) | `evidence/runs/witness-react-linkfree-v0-72-0/receipt.json` |

### Angular lineage — 4/4 counted green cells

| Cell | Application | Vertical | Runtime | Bundler | Migration track | Browser proof | Witness receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `angular-factoriolab` | angular-factoriolab | `angular-factoriolab` | node-12.14.1-to-node-16.20.2 | angular-cli-10.1-browser-builder-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular10-to-angular16-browser-builder | verified-direct-witness (4 runs) | `evidence/runs/witness-angular-factoriolab/receipt.json` |
| `angular-jira-clone` | angular-jira-clone | `angular-jira-clone` | node-16.20.2 | angular-cli-13.2-custom-webpack-browser-builder-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular13-to-angular16-browser-builder | verified-direct-witness (4 runs) | `evidence/runs/witness-angular-jira-clone/receipt.json` |
| `angular-tiny-translator-v0-12-0` | angular-tiny-translator | `angular-tiny-translator-v0-12-0` | node-8.9.3-to-node-16.20.2 | angular-cli-1.5.4-webpack-3.8.1-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular5-to-angular16-browser-builder | verified-direct-witness (4 runs) | `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json` |
| `angular-super-productivity-v2-13-15` | angular-super-productivity | `angular-super-productivity-v2-13-15` | node-12.14.1-to-node-16.20.2 | angular-cli-8.3.4-webpack-4-to-angular-16.2-browser-builder | production-readiness-direct-witness-angular8-viewengine-to-angular16-browser-builder | verified-direct-witness (4 runs) | `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json` |

### Demoted from the denominator

- `angular-realworld-v15-to-v16` (angular): Judge-declined and demoted from the denominator: the migration changed applicationFilesChanged=0 application files, so it is an Angular 15-to-16 dependency version bump rebuilt under AOT rather than a proven application migration. Its browser-proof receipt stays verified and retained; it is excluded from the Angular denominator rather than counted, which is why the Angular total is four non-demoted cells and not five.

### Holdouts — counted in no lineage numerator

- `holdout-react-cypress-rwa` (cypress-realworld-app, react lineage): outcome `passed` — receipt `evidence/runs/holdout-react-cypress-rwa/green-2026-08-13/receipt.json` `76f0b5bd0d8a3fa0596d3c5d190c764ee7402f4e5c27870d36bdb3fa5f04a73e`. Counted in no lineage numerator. This holdout passed, and it is still counted in no lineage numerator: a passing holdout shows the frozen adapter carrying one further application, not a migrated-application product count. It is published rather than folded into any numerator.
- `holdout-angular-eshop-webspa` (eShopOnContainers WebSPA, angular lineage): outcome `witness-passed-on-bounded-anonymous-catalog-surface` — receipt `evidence/runs/holdout-angular-eshop-webspa/receipt.json` `fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9`. Counted in no lineage numerator. Never counted in any lineage numerator by this record. The migrated production build is green and repeatable, and the Witness is green on the anonymous catalog surface — twice per lane, one parity digest, with a mutation-red and byte-restore proof under it. What that leaves unproven is stated beside it: every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent. Whether a holdout proven on a bounded surface should ever reach a numerator is the Judge's decision, taken on the Judge's ledger and not here. The install RED under the frozen f1a63359 composite is retained beside all of it as the record of what the frozen adapter did.
  - Proven surface: **anonymous-catalog** only. Surfaces not covered: identity (out-of-surface), basket (out-of-surface), orders (out-of-surface), campaigns (out-of-surface), signalr (not-reached), text-entry (not-tested), drag (not-tested).

### Permanent falsification history

- `holdout-angular-pigallery2` — pigallery2, migrated lane **RED** against frozen adapter composite `4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7`; receipt `evidence/runs/holdout-angular-pigallery2/receipt.json` `39a133ff97c37622a4a1821f20e7c442c9bc22ed7597a3e73cbd31323ab2bb10`. Permanent falsification evidence. The declared pre-Ivy support boundary rests on this RED, and the RED is published unchanged rather than retracted or excused by it.
- `holdout-angular-eshop-webspa` — eShopOnContainers WebSPA, migrated-at-install-under-frozen-composite lane **RED** against frozen adapter composite `f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012`; receipt `evidence/runs/holdout-angular-eshop-webspa/receipt.json` `fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9`. Permanent falsification evidence. The install RED this application took under the frozen composite is retained beside its later bounded-surface result, not replaced by it.
- `holdout-react-cypress-rwa` — cypress-realworld-app, migrated lane **RED** against frozen adapter composite `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77`; receipt `evidence/runs/holdout-react-cypress-rwa/receipt.json` `7ec6f18b27d2967cd533ba89505e8a76590c1866aec8bd7a8d8543cd87743aae`. Permanent falsification evidence. The tranche-one RED is superseded by reference and stays published; it is not deleted by the later passing record.

### Declared support boundaries

- Boundary `angular-16-pre-ivy-only-dependency` at cell `angular-16-browser-builder`: **unsupported** — pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell
  - Angular 16 removed ngcc, so ViewEngine bytes cannot be consumed at this cell, and a library whose last published version is pre-Ivy has no successor to align to. Carrying such an application would require editing its source at the import sites, which is an application change rather than a migration the engine can perform.
  - **not-certified: this cell is declared unsupported, not tested-and-failed-once**
  - Instance evidence: pigallery2, 3 libraries at 6 import sites — recorded RED in `evidence/runs/holdout-angular-pigallery2/receipt.json` `39a133ff97c37622a4a1821f20e7c442c9bc22ed7597a3e73cbd31323ab2bb10`.

- Prevalence (**5-of-6**): The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.
- Population: Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.
- Tranche two: No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.

### Out of matrix

A capability is claimed general, and therefore in the matrix, only once at least 2 independent applications prove it. The capabilities below are proven on fewer than that and are out of the matrix; they are named rather than silently claimed. 51 of 59 enumerated capabilities are out of the matrix; 8 are cross-proven and in it.

- react: `react-cra-process-global`
- react: `react-next-static-adapter`
- react: `react-vite-origin-adapter`
- react: `react-connect-to-hooks`
- react: `react-data-flow-connect-to-hooks`
- react: `react-composed-migration`
- react: `react-class-lifecycle-to-hooks`
- angular: `template-analysis`
- angular: `semantic-module`
- angular: `undeclared-runtime-dependency`
- angular: `package-exports-style-imports`
- angular: `modal-content-params-migration`
- angular: `custom-webpack-absorption`
- angular: `tslint-toolchain-removal`
- angular: `font-inlining-disable`
- angular: `angular-cli-json-workspace-synthesis`
- angular: `builder-package-declaration`
- angular: `node-core-binding-migration`
- angular: `node-core-runtime-globals`
- angular: `template-i18n-runtime`
- angular: `rxjs-prototype-patch-migration`
- angular: `deep-import-redirection`
- angular: `entry-components-removal`
- angular: `module-with-providers-type-argument`
- angular: `widened-union-narrowing`
- angular: `forms-legacy-disabled-state`
- angular: `template-binding-reorder`
- angular: `declared-type-member-rename`
- angular: `json-module-named-import`
- angular: `promise-executor-void-parameter`
- angular: `removed-entry-point-symbol-successor`
- angular: `sass-mixin-hyphenation-successor`
- angular: `split-element-successor`
- angular: `stylesheet-url-rebase`
- angular: `subject-void-type-argument`
- angular: `successor-fork-package`
- angular: `suggested-export-rename`
- angular: `unparameterised-base-class`
- angular: `web-worker-url-specifier`
- angular: `synthetic-default-import-interop`
- angular: `sentry-v8-migration`
- angular: `workspace-engines-retarget`
- angular: `undecorated-angular-base-class`
- angular: `application-source-dependency`
- angular: `use-position-symbol-successor`
- angular: `removed-static-module-method`
- angular: `http-client-call-surface`
- angular: `superseded-era-lockfile`
- angular: `workspace-script-flags`
- angular: `departed-dom-lib-member`
- angular: `locale-id-provider`

## 8. Deviations recorded, not masked

- `angular-phonecat-vite8` — service-worker: out-of-scope-not-emitted (recorded, not masked)
- `react-papercups-v1-0-0` — service-worker: application-unregister (recorded, not masked)
- `react-papercups-v1-0-0` — scroll-surface: omitted-not-meaningful (recorded, not masked)
- `react-hospitalrun` — service-worker: application-register-refused-by-context (recorded, not masked)
- `react-hospitalrun` — scroll-surface: measured-genuine-viewport-scroll (recorded, not masked)
- `angular-factoriolab` — service-worker: no-service-worker-in-either-lane (recorded, not masked)
- `angular-factoriolab` — scroll-surface: measured-no-overflowing-document (recorded, not masked)
- `angular-jira-clone` — service-worker: no-service-worker-in-either-lane (recorded, not masked)
- `angular-jira-clone` — scroll-surface: measured-no-overflowing-document (recorded, not masked)
- `react-memos-v0-1-3` — scroll-surface: measured-no-overflowing-document (recorded, not masked)
- `next-killedbygoogle-v3-0-0` — service-worker: no-service-worker-in-either-lane (recorded, not masked)
- `next-killedbygoogle-v3-0-0` — scroll-surface: measured-genuine-viewport-scroll (recorded, not masked)
- `react-linkfree-v0-72-0` — scroll-surface: measured-genuine-viewport-scroll (recorded, not masked)
- `angular-tiny-translator-v0-12-0` — scroll-surface: measured-no-overflowing-document (recorded, not masked)
- `angular-super-productivity-v2-13-15` — service-worker: declared-real-ngsw-in-both-lanes-settled-state-measured-at-witness-time (recorded, not masked)
- `angular-super-productivity-v2-13-15` — scroll-surface: measured-no-overflowing-document (recorded, not masked)
- `holdout-angular-eshop-webspa` — witness-surface-limit: identity: out-of-surface (unproven rather than proven absent)
- `holdout-angular-eshop-webspa` — witness-surface-limit: basket: out-of-surface (unproven rather than proven absent)
- `holdout-angular-eshop-webspa` — witness-surface-limit: orders: out-of-surface (unproven rather than proven absent)
- `holdout-angular-eshop-webspa` — witness-surface-limit: campaigns: out-of-surface (unproven rather than proven absent)
- `holdout-angular-eshop-webspa` — witness-surface-limit: signalr: not-reached (unproven rather than proven absent)
- `holdout-angular-eshop-webspa` — witness-surface-limit: text-entry: not-tested (unproven rather than proven absent)
- `holdout-angular-eshop-webspa` — witness-surface-limit: drag: not-tested (unproven rather than proven absent)
- `angular-realworld-v15-to-v16` — demoted-from-denominator: Judge-declined and demoted from the denominator: the migration changed applicationFilesChanged=0 application files, so it is an Angular 15-to-16 dependency version bump rebuilt under AOT rather than a proven application migration. Its browser-proof receipt stays verified and retained; it is excluded from the Angular denominator rather than counted, which is why the Angular total is four non-demoted cells and not five. (recorded, not masked)

## 9. Unsupported and unknown states

- Unsupported cell `angular-16-browser-builder`: pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell — **not-certified: this cell is declared unsupported, not tested-and-failed-once**

- `takenote`: **"not-tested"**
- `angular2Hn`: **"not-tested"**
- `oldVite`: **"not-tested"**
- `genericAdapter`: **"not-tested"**
- `unplugin`: **"not-tested"**
- `nextjs`: **"fixture-specific-next12-pages-verified"**

- `securityPolicy`: {"state":"unknown","reason":"SECURITY.md is absent."}
- `gitProvenance`: {"state":"unknown","reason":"Git metadata is absent."}
- `signingIdentity`: {"state":"unknown","reason":"No project signing identity is designated."}
- `rootLicenseText`: {"state":"unknown","reason":"No root LICENSE file exists."}
- `licenseCoverage`: {"spdxExpression":{"verified":124,"unknown":107,"ambiguous":9},"licenseText":{"verified":112,"unknown":119,"ambiguous":9}}

## 10. Claims and non-claims

Every claim restates a score or digest the corpus derived; every non-claim is carried verbatim from the record that already publishes it. Neither list is authored beside the evidence.

### Claims

- 6 of 6 React-lineage cells and 4 of 4 Angular-lineage cells carry a Judge-accepted direct-Witness browser proof against the frozen adapter, each on its own immutable source application.
- Every number above is derived from the Judge counting ledger inside `corpus-conformance.json` (`532eb5b705104f9f9af3e0dc8ae028c36b20e3ba4ade4c438533e3f341418965`); the cells are enumerated in this record and each names the receipt it was counted off.
- 8 of 59 enumerated migration capabilities are cross-proven on at least two independent applications and are therefore in the matrix.
- Every artifact in this package is bound by SHA-256 to the trust manifest, and the derived documents are re-derived from the same canonical receipts at verification time.
- The two published holdouts that did not end RED are reported with the exact outcome string their receipts carry, and both are counted in no lineage numerator.

### Non-claims

- This package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation. No cell in it carries a certification of any kind.
- Integrity is hash-only: authenticity is **not-established** and certification is **not-claimed**. Signer authenticity is not established.
- No SLSA level is claimed. The provenance record is in-toto/SLSA-shaped only, and Git provenance and official CI identity remain unknown.
- Locality is Versionless-spawned processes and browser routing and process-scoped: OS-wide isolation is **false** and is not claimed.
- Neither holdout is counted in any lineage numerator. This holdout passed, and it is still counted in no lineage numerator: a passing holdout shows the frozen adapter carrying one further application, not a migrated-application product count. It is published rather than folded into any numerator. Never counted in any lineage numerator by this record. The migrated production build is green and repeatable, and the Witness is green on the anonymous catalog surface — twice per lane, one parity digest, with a mutation-red and byte-restore proof under it. What that leaves unproven is stated beside it: every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent. Whether a holdout proven on a bounded surface should ever reach a numerator is the Judge's decision, taken on the Judge's ledger and not here. The install RED under the frozen f1a63359 composite is retained beside all of it as the record of what the frozen adapter did.
- The eShopOnContainers WebSPA holdout is published as `witness-passed-on-bounded-anonymous-catalog-surface` and is never restated in any shorter or more general form. The surfaces it does not cover are named: identity (out-of-surface), basket (out-of-surface), orders (out-of-surface), campaigns (out-of-surface), signalr (not-reached), text-entry (not-tested), drag (not-tested).
- 51 of 59 enumerated capabilities are proven on fewer than two independent applications and are **out of the matrix**; nothing general is claimed for them.
- Static script-surface evidence claims no payment-page applicability (**not-established**), no dynamic script insertion coverage (**not-tested**), and no PCI compliance (**not-claimed**).
- Runtime script observation is scoped to the exact qualified journeys: global dynamic-insertion coverage is **not-established** and PCI compliance is **not-claimed**.
- The Angular 16 pre-Ivy-only-dependency cell is declared **unsupported**. Prevalence is published as **5-of-6** and is never rounded up to include the sixth application, whose condition is a different one: The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.
- Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.
- No claim that every application carrying a pre-Ivy-only dependency is unmigratable in general: the boundary is declared at the Angular 16 target cell, which is the only Angular cell this engine has.
- No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.
- No claim that the boundary excuses the pigallery2 RED. The RED is permanent falsification evidence and is published unchanged alongside this declaration.
- No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.
- pigallery2: Permanent falsification evidence. The declared pre-Ivy support boundary rests on this RED, and the RED is published unchanged rather than retracted or excused by it.
- eShopOnContainers WebSPA: Permanent falsification evidence. The install RED this application took under the frozen composite is retained beside its later bounded-surface result, not replaced by it.
- cypress-realworld-app: Permanent falsification evidence. The tranche-one RED is superseded by reference and stays published; it is not deleted by the later passing record.

---

This document is not certification. It establishes hash integrity only; authenticity is not established, no SLSA level is claimed, and locality is process-scoped rather than OS-wide isolation.
