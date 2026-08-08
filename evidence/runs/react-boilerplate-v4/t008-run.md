# Versionless migration receipt

- Run: `T008-react-boilerplate-v4`
- Fixture: `react-boilerplate-v4`
- Result: **pass**
- Source revision: `d19099afeff64ecfb09133c06c1cb18c0d40887e`
- Canonical SHA-256: `4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/containers/LocaleToggle/index.js` was migrated from React-Redux `7.0.2` to `7.1.3` using Yuku semantic refusal and 5 minimal span edits.

## Verification

- Independent legacy and target production builds: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true

Locality enforcement is scoped to Versionless-spawned Node/npm/webpack child processes and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/react-boilerplate-v4/artifacts/build-legacy.log` | `2f035e449c6c708c6815108d89da02549df07e4ea6413a3a099912d6b41b1d16` |
| `evidence/runs/react-boilerplate-v4/artifacts/build-target.log` | `abba8d6f7ef48ba9500eaa69cc524193d489ab4b8801de0072ad9fc574446d3f` |
| `evidence/runs/react-boilerplate-v4/artifacts/journey.json` | `11a6d35d47da2476c39ee8134a5f00bffdec86560c2218482331e50d1551e942` |
| `evidence/runs/react-boilerplate-v4/artifacts/build-mutation.log` | `7708234d337cda6d9edd0c693ecf31b3dc9807cd861d67b08e94e1725b673c13` |
| `evidence/runs/react-boilerplate-v4/artifacts/build-restored.log` | `66d4aa398182d5f61b76abc1dbd52567667e3cb7606cb9cde47dcd9e30c3ae01` |
| `evidence/runs/react-boilerplate-v4/artifacts/mutation.json` | `9f099fde1db9996aefc7057a360b3aa602e3f5656fac38052d7d880664ba4223` |
| `evidence/runs/react-boilerplate-v4/artifacts/migration-diff.json` | `167929229973a94096755edcaf7c450ab5dc5ee9308a6c691933ed5a9a8594db` |
| `evidence/runs/react-boilerplate-v4/artifacts/locality.json` | `eea430bc25157edb67e13480e94ee0f61b4bc356838d2816f8f3d99be407f154` |
| `evidence/runs/react-boilerplate-v4/artifacts/deterministic-core.json` | `2c33b8884edf23ab01d204a13d911c75a7cdc2bc227261dcd615530278e5d5b7` |

## Limitations

- Hash integrity does not establish signer authenticity or provenance beyond pinned downloads.
- Network controls cover spawned Node children and browser routing, not OS-wide process isolation.
- Node 16 is EOL and used only as a compatibility sandbox.
- The transform is approved only for the exact proven LocaleToggle shape.
- npm lifecycle scripts are disabled identically in both lanes because unused optional ngrok@3.1.1 rejects darwin-arm64; production webpack build and parity are acceptance gates.
- This receipt proves one React webpack fixture only, not the full corpus outcome.
