# Versionless migration receipt

- Run: `T054-react-boilerplate-v4-data-flow`
- Fixture: `react-boilerplate-v4-data-flow`
- Result: **pass**
- Source revision: `d19099afeff64ecfb09133c06c1cb18c0d40887e`
- Canonical SHA-256: `2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/containers/HomePage/index.js + app/containers/RepoListItem/index.js` received 6 deterministic Yuku-gated edits that preserve named prop-driven components and replace only their default React-Redux wiring with hooks wrappers.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true
- Same-origin service worker: active, scope `/`, controller activated
- Content-addressed cache: `versionless-react-vite8-88686f59deca2cf956e7ef502b0cd4aea498001352fcf06affdbaf0178ef8599` (exact manifest and current-cache-only inventory)
- Same-origin upgrade orders: base-to-data-flow, data-flow-to-base
- Offline reload and exact qualified journey: pass
- Coverage: exact qualified journey only; global offline/PWA correctness is not claimed

Locality enforcement is scoped to Versionless-spawned Node/Vite build and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/preparation.json` | `e429c08ad1cac7aa37269ab01925ce988e1e26a022c6256ef0256be9106200ae` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/transform.json` | `f36845d5a42064c2554be14a4cc4359ac4e731d7e2a81649c6c710d25278aaa9` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/build.json` | `dbfb2bc87ff491117a18f5364927186550c0d3f6a7227f7b313f88e1f5994f91` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/upgrade.json` | `db9f8fa01d84fd54ceb39cf2277d7acf3333886639b5975f7e60f9af0b175641` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/journey.json` | `68091085ea748d7be4821e84b83c26fa7e059a301691c6b082918804970a0667` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/mutation.json` | `c550ff37010fc5725ea6b55d378174e0e9c4d93e7ab018026fd2dfc6609f2bab` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/migration-diff.json` | `2a84c7649d941abefcd9ed6ef4deb558fd0d720196295ff02bd38406d6669e99` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/locality.json` | `5317302fe5ede1d84e725ca370ddf68d0d9a157bc47d5b3d7dbc8229ce551dd5` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/runtime.json` | `08badc321fe960311804c25bbc292deef4061e66e67a8a79479975975fc5dfe1` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/deterministic-core.json` | `93638e00f37ec8942e5a283adb2915d9992e24a9610c4180c1381834792ce602` |

## Limitations

- This is a deeper vertical on the existing React Boilerplate source, not a third application or designated pilot.
- The Vite adapter remains fixture-specific; generic, unplugin, and old-Vite portability are not-tested.
- GitHub behavior uses a pinned synthetic interception and proves no live API access.
- Hash integrity does not establish authenticity, signer identity, certification, or Git provenance.
- Network controls are process-scoped and do not establish OS-wide isolation.
- Payment-page applicability is not established; dynamic script insertion is not-tested; PCI compliance is not claimed.
- Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.
