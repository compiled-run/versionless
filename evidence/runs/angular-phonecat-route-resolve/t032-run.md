# Versionless migration receipt

- Run: `T032-angular-phonecat-route-resolve`
- Fixture: `angular-phonecat-route-resolve`
- Result: **pass**
- Source revision: `ef6f6eb672ded472b4e442d598f5df40d0e0642c`
- Canonical SHA-256: `aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/app.config.js + app/phone-list/phone-list.component.js + app/phone-detail/phone-detail.component.js` received 4 minimal span edits under Yuku semantic refusal. The constructable outer controller and dependency-injection annotation are preserved. This is AngularJS special-track evidence only.

## Verification

- Independent legacy and target preparation: pass
- Identical Playwright journey, two qualification runs per lane: pass
- Mutation-red and byte-identical restoration: pass
- Successful non-loopback traffic: 0
- Deterministic-core digest reproduced: true

Locality enforcement is scoped to Versionless-spawned Node/npm child processes and Playwright browser requests. It is not OS-wide isolation.

## Artifacts

| Path | SHA-256 |
|---|---|
| `evidence/runs/angular-phonecat-route-resolve/artifacts/preparation.json` | `a12c35d28973404e6d2a5f2eebbe661cbe0790626d1401e805367ab684d6aeaf` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/runtime.json` | `97dae2015936f316668f530e8e2e41962e7b9dc0991f0dad6367844b756cd246` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/journey.json` | `299308578fc043f3d09d3e189c1e14a9b1d12d4f42df37dfbf89bb9c4c2e1300` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/locality.json` | `aa69f52db453ae704b9436a049a148d8042fd05a3f6b1c06e5aaf752b5b20477` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/mutation.json` | `6376aed232a6c30441e50d4d878116e65e45d2b69c807f280b1a8066d9ad4df2` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/migration-diff.json` | `daca0cba1142c6dc940df65321f9f4f816fad4ccf901e88f84e67b98855d90ce` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/transform.json` | `c87fc4ca5afa12343c0b07e31d43388c3d56143b441b197d8d331ddbd2ed04aa` |
| `evidence/runs/angular-phonecat-route-resolve/artifacts/deterministic-core.json` | `fc2e3e6ec2696af81a8576d3d8096259e4d94251b719f09794acefecfa8d1e13` |

## Limitations

- Hash integrity does not establish signer authenticity or Git provenance.
- Network controls cover spawned children and browser routing, not OS-wide isolation.
- Node 16 is EOL and used only as a compatibility sandbox.
- This is AngularJS special-track static evidence, not Angular 2+, Angular CLI/AOT, or adjacent-major proof.
- This does not prove a designated Angular pilot or new bundler support.
- Certification, signing identity, and authenticity are not claimed.
