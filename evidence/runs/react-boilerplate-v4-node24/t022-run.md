# Versionless migration receipt

- Run: `T022-react-boilerplate-v4-node24`
- Fixture: `react-boilerplate-v4-node24`
- Result: **pass**
- Source revision: `d19099afeff64ecfb09133c06c1cb18c0d40887e`
- Canonical SHA-256: `815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/containers/LocaleToggle/index.js` was migrated from React-Redux `4.30.0` to `4.47.0` using Yuku semantic refusal and 5 minimal span edits.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true

Locality enforcement is scoped to Versionless-spawned Node/npm/webpack child processes and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/react-boilerplate-v4-node24/artifacts/cache-provenance.json` | `765ffd7e4b48097d192ef19952ce3499165afc4d4c5c69e15d9541f3d6b2f9c6` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/build-target.log` | `2680c80f9d7bcdf4e8160cc17283eb0b41cfa8ea4e9dfd78615d221e41e42cfd` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/journey.json` | `520a59a205cc4fffc034b6345c82a1fa6745a3d8cd36b40f2c60db0600ce678a` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/build-mutation.log` | `614674ce949f9d210136335c9224a9d42caa5397ab9a89fb07f7751e7f382123` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/build-restored.log` | `806201edc29aa19a34af4bbb7d9e2cc2cac7b7378fccd018d1ebc80b882cf717` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/mutation.json` | `bc46477aeeb80c47fe88144797f5c91a841662c208d45161ac3354af94cb2097` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/migration-diff.json` | `52adfee93f93d42cf7a9e8a573846c4306d222ee2fd0a6ffa491e7d466ff9970` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/locality.json` | `f5cc208a064712a5827248d57083b3f1f593e97f7a54fc314ad639e84b9c8186` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/deterministic-core.json` | `c4a19f3c970c5de1fe63acb80a926362c4cbe25781ee68cbe1fc670a22a40c5c` |
| `evidence/runs/react-boilerplate-v4-node24/artifacts/ingest-integrity.json` | `5a1f9a4debf9accb73660b4e456dcbaef63ab02c6b1ff7d00d920b6037e99837` |

## Limitations

- Hash integrity does not establish signer authenticity or provenance beyond pinned downloads.
- Network controls cover spawned children and browser routing, not OS-wide process isolation.
- TakeNote, Angular2-HN, old Vite, and a second bundler remain unverified.
- Governance, certification, and authenticity remain unverified or not claimed.
- This receipt proves only React Boilerplate on Node 24.15.0 with webpack 4.47.0.
