# Versionless migration receipt

- Run: `T054-react-boilerplate-v4-data-flow`
- Fixture: `react-boilerplate-v4-data-flow`
- Result: **pass**
- Source revision: `d19099afeff64ecfb09133c06c1cb18c0d40887e`
- Canonical SHA-256: `a6c25918ed9650d3315c42501932e8e6fe26552e48bcbdf74d4987f7b384452b`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/containers/HomePage/index.js + app/containers/RepoListItem/index.js` received 4 deterministic Yuku-gated edits that preserve named prop-driven components and replace only their default React-Redux wiring with hooks wrappers.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true
- Same-origin service worker: active, scope `/`, controller activated
- Content-addressed cache: `versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc` (exact manifest and current-cache-only inventory)
- Same-origin upgrade orders: base-to-data-flow, data-flow-to-base
- Offline reload and exact qualified journey: pass
- Coverage: exact qualified journey only; global offline/PWA correctness is not claimed

Locality enforcement is scoped to Versionless-spawned Node/Vite build and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/preparation.json` | `e429c08ad1cac7aa37269ab01925ce988e1e26a022c6256ef0256be9106200ae` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/transform.json` | `fbc23cec36c19da3c0429835b192b64a42de8b74f1cae5d485b381cc2775cb39` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/build.json` | `0b58bdbbf7fdf8149f7845d74142449e4eca2ec45e756da0729b708607742b0c` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/upgrade.json` | `7a50868de8924839eb5006a286e275303e2028b07c9fb3d03cd285160a229fd0` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/journey.json` | `4d3a11cf56342b482ec3c93f25d360811a79f5859ec9416e818a229f773cc7f1` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/mutation.json` | `b178d5d3e0a940191b550c54ed0b1f601f1658f0e521a9ed81720b5f49638481` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/migration-diff.json` | `2a84c7649d941abefcd9ed6ef4deb558fd0d720196295ff02bd38406d6669e99` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/locality.json` | `5317302fe5ede1d84e725ca370ddf68d0d9a157bc47d5b3d7dbc8229ce551dd5` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/runtime.json` | `08badc321fe960311804c25bbc292deef4061e66e67a8a79479975975fc5dfe1` |
| `evidence/runs/react-boilerplate-v4-data-flow/artifacts/deterministic-core.json` | `c3315e20ee32e63a9221b4dd90a3f2a94bfc1a4ef15958ea2f0a8cc7c6ef1b80` |

## Limitations

- This is a deeper vertical on the existing React Boilerplate source, not a third application or designated pilot.
- The Vite adapter remains fixture-specific; generic, unplugin, and old-Vite portability are not-tested.
- GitHub behavior uses a pinned synthetic interception and proves no live API access.
- Hash integrity does not establish authenticity, signer identity, certification, or Git provenance.
- Network controls are process-scoped and do not establish OS-wide isolation.
- Payment-page applicability is not established; dynamic script insertion is not-tested; PCI compliance is not claimed.
- Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.
