# Versionless migration receipt

- Run: `T028-react-boilerplate-v4-vite8`
- Fixture: `react-boilerplate-v4-vite8`
- Result: **pass**
- Source revision: `d19099afeff64ecfb09133c06c1cb18c0d40887e`
- Canonical SHA-256: `1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/containers/LocaleToggle/index.js` was migrated from React-Redux `7.0.2` to `7.1.3` using Yuku semantic refusal and 5 minimal span edits.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true
- Same-origin service worker: active, scope `/`, controller activated
- Content-addressed cache: `versionless-react-vite8-44023d4ca959eba5ec462cd305e6944abe03964dc836b042673bc8dc1f5ab024` (exact manifest and current-cache-only inventory)
- Offline reload and exact qualified journey: pass
- Coverage: exact qualified journey only; global offline/PWA correctness is not claimed

Locality enforcement is scoped to Versionless-spawned Node/Vite build and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/preparation.json` | `94b19bfc5308a3b94c48c7736c605b1e682b488beee937bf0b49cf7eaf859e18` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/build-target.log` | `b2d471d5da7cadcb207ed3083622dca72335205ecded1b432d2ea5485e044d29` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/service-worker.json` | `5449075fac78e0cacc79640683a5272de0a75ebe793ffef3a29233b3e2f9cb53` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/journey.json` | `6f5fdce9d7a79d175e4b6be3ab0057749e94a6cad013ea477a82a893c476deaa` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/build-mutation.log` | `b4686251438646d3eabb8e96078b0f6af9ad42e4f06ab32d52781a3985208f50` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/build-restored.log` | `05efafcd42d5aff8ee52c3da15ea4441c44bd6b3c3a68a34730f7c165cd3e666` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/mutation.json` | `6f2ffa378254cf4e7ba59484f4461afb282ceaafa71b6fb3d59ba95380e506e7` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/migration-diff.json` | `a83201746c103757483db4561bcd2c2d4559329a12e56f9f28b185eb8ce7c121` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/locality.json` | `a68dbb821d7ca92d203ab8ae4ed861e83bd8b2e2558da2da1b88e701865ebb5c` |
| `evidence/runs/react-boilerplate-v4-vite8/artifacts/deterministic-core.json` | `4622dcefa1c4e412316d230a66ec3d16b0bb322adb0a92c0f2f6a96e866e48e6` |

## Limitations

- Hash integrity does not establish signer authenticity or Git provenance.
- Network controls cover spawned Node/Vite and browser routing, not OS-wide isolation.
- This proves only root Vite 8.0.16 on the pinned React Boilerplate corpus.
- Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.
- Old Vite and generic or unplugin adapter portability remain not-tested.
- TakeNote and Angular2-HN designated pilots remain not-tested.
- Governance, signing identity, certification, and authenticity are not claimed.
