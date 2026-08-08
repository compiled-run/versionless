# Versionless migration receipt

- Run: `T060-react-boilerplate-v4-composed`
- Fixture: `react-boilerplate-v4-composed`
- Result: **pass**
- Source revision: `d19099afeff64ecfb09133c06c1cb18c0d40887e`
- Canonical SHA-256: `9341f5e70c00ebbde65a919db5b5d31fde0fa39983e985deb01afb71ed00d1ad`
- Authenticity: **not established** (hash integrity only)

## Migration

The exact five-file cumulative React target executed distinct locale-first and data-flow-first transform traces with identical bytes. A staged-write failure left the published target untouched and cleaned its stage; the validated complete target was then published by one same-filesystem directory rename. The harness-only Vite adapter is excluded from migrated source. 11 Yuku-gated and maintained-package edits were composed.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true
- Same-origin service worker: active, scope `/`, controller activated
- Content-addressed cache: `versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc` (exact manifest and current-cache-only inventory)
- Offline reload and exact qualified journey: pass
- Coverage: exact qualified journey only; global offline/PWA correctness is not claimed

Locality enforcement is scoped to Versionless-spawned Node/npm/webpack/Vite child processes and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/react-boilerplate-v4-composed/artifacts/preparation.json` | `b793c9290e8bd5831f56d276913d11f425e34ed08422d351f883aa2759dbb73b` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/composition.json` | `af33c902117583185fb9504557781c7c0242ba63e0d51f23679e7fac2d5f4883` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/transform.json` | `1bc421418715292c81a70949bc149e328a5cde60b1558ab36c62dc9f08c63e5e` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/build.json` | `c7a4ccf8b84229ebf26e98fc8450fc653bef8f0031c74d4b22b1263e728c79fb` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/journey.json` | `5c3486b366dd9fadda9044b97d438bbc89f851fc287bef6bc86a0de35590f924` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/mutation.json` | `80fe6d3ff964f5c9a28a1b360021d2de780b8e4121dfc59f2a80fde00de2c07b` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/migration-diff.json` | `cbc98ab8ca8d731bfffc9ee2d71ae836fb66f701c4c6ad0e324ceffd1438bced` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/locality.json` | `262a3d7ae6bae875dea00b6eb1cfd5edf77085d0ef3b4368362316201cd35ba1` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/runtime.json` | `9e28877bcb6b0830711e48065e6e0f00d3021237c02af36471f49e5a6c81b6ab` |
| `evidence/runs/react-boilerplate-v4-composed/artifacts/deterministic-core.json` | `4ddc7d257567ebf50e65459134020120d2f966ae0bc1a55c6a9368c4137f04da` |

## Limitations

- This cumulative vertical remains one React Boilerplate source application and is not a designated pilot or third application.
- The target Vite adapter is fixture-specific; no generic, unplugin, old-Vite, or additional bundler support is established.
- Synthetic GitHub interception proves no live API access.
- Payment-page applicability and global dynamic insertion are not established; PCI compliance and certification are not claimed.
- Hash integrity does not establish authenticity, signer identity, signed or Git provenance.
- Network controls are process-scoped and do not establish OS-wide isolation.
- Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.
