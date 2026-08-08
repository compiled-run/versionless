# Versionless migration receipt

- Run: `T069-angular-phonecat-vite8`
- Fixture: `angular-phonecat-vite8`
- Result: **pass**
- Source revision: `ef6f6eb672ded472b4e442d598f5df40d0e0642c`
- Canonical SHA-256: `033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/app.config.js + app/phone-list/phone-list.component.js + app/phone-detail/phone-detail.component.js` received 7 minimal span edits under Yuku semantic refusal. The constructable outer controller and dependency-injection annotation are preserved. This is AngularJS special-track evidence only.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true

Locality enforcement is scoped to Versionless-spawned Node/npm/Vite children and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/angular-phonecat-vite8/artifacts/preparation.json` | `accab8b56fcfc5639f1ee2263ceef59178fb994bd9322851fc5f86821eae984a` |
| `evidence/runs/angular-phonecat-vite8/artifacts/transform-order.json` | `4ebe3a139397b14a4eba6801fecd71dec8216d32ab4bdce508af32d28708ae8e` |
| `evidence/runs/angular-phonecat-vite8/artifacts/migration-diff.json` | `847678dc9060c5886d5d3c594a88a397ffb06bc722cbf2ca330e8b905c2c5fa7` |
| `evidence/runs/angular-phonecat-vite8/artifacts/vite-build.json` | `a6b465efbebdb1aeeac0a1d2779e683815f24e3446fc53f2f98693e7ae97c8bb` |
| `evidence/runs/angular-phonecat-vite8/artifacts/publication.json` | `5ec996412f70ac7c8176b4de1893b1b25018e92373a98291baf855d74abec31c` |
| `evidence/runs/angular-phonecat-vite8/artifacts/journey.json` | `299308578fc043f3d09d3e189c1e14a9b1d12d4f42df37dfbf89bb9c4c2e1300` |
| `evidence/runs/angular-phonecat-vite8/artifacts/locality.json` | `c88cbad3e79abef3499f99372806616caf6503185e57c17a8451baaa1ce804af` |
| `evidence/runs/angular-phonecat-vite8/artifacts/mutation.json` | `6b82898e2182d9a3093374a9e678193c1849e3de1bfe217f11482f3d5db024b0` |
| `evidence/runs/angular-phonecat-vite8/artifacts/runtime.json` | `7b190b89c314c42e361981334d7e1c622dfe9f2aa60bd30486830383bb5c8fc4` |
| `evidence/runs/angular-phonecat-vite8/artifacts/deterministic-core.json` | `dd108f681bfb6ed3458ee0a59804f4815da6d22376046ab57b4f467d596e0e3a` |

## Limitations

- AngularJS special-track evidence; this is not Angular 2+ or Angular CLI/AOT proof.
- The Vite adapter is fixture-specific; unplugin and generic adapter support are not-tested.
- Old-Vite support is not-tested and no designated pilot is established.
- Service-worker behavior is out of scope and PWA behavior is out of scope; no worker is emitted.
- Hash integrity does not establish certification, signer authenticity, or Git provenance.
- Network controls are process-scoped and do not establish OS-wide isolation.
