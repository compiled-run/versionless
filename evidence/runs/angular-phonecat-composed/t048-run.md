# Versionless migration receipt

- Run: `T048-angular-phonecat-composed`
- Fixture: `angular-phonecat-composed`
- Result: **pass**
- Source revision: `ef6f6eb672ded472b4e442d598f5df40d0e0642c`
- Canonical SHA-256: `a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/app.config.js + app/phone-list/phone-list.component.js + app/phone-detail/phone-detail.component.js` received 7 minimal span edits under Yuku semantic refusal. The constructable outer controller and dependency-injection annotation are preserved. This is AngularJS special-track evidence only.

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
| `evidence/runs/angular-phonecat-composed/artifacts/preparation.json` | `a12c35d28973404e6d2a5f2eebbe661cbe0790626d1401e805367ab684d6aeaf` |
| `evidence/runs/angular-phonecat-composed/artifacts/runtime.json` | `97dae2015936f316668f530e8e2e41962e7b9dc0991f0dad6367844b756cd246` |
| `evidence/runs/angular-phonecat-composed/artifacts/journey.json` | `299308578fc043f3d09d3e189c1e14a9b1d12d4f42df37dfbf89bb9c4c2e1300` |
| `evidence/runs/angular-phonecat-composed/artifacts/locality.json` | `aa69f52db453ae704b9436a049a148d8042fd05a3f6b1c06e5aaf752b5b20477` |
| `evidence/runs/angular-phonecat-composed/artifacts/composition.json` | `b8d145d43bef49fffd7fe6feea249866bf76dc7389dfed4865bf2b15a5ea5543` |
| `evidence/runs/angular-phonecat-composed/artifacts/mutation.json` | `7fd2ac3d6bb1ba2c91cb5ae5f9f5babc516d6839b0bdbfdf8118379a57ec79ee` |
| `evidence/runs/angular-phonecat-composed/artifacts/migration-diff.json` | `daca0cba1142c6dc940df65321f9f4f816fad4ccf901e88f84e67b98855d90ce` |
| `evidence/runs/angular-phonecat-composed/artifacts/transform.json` | `3257458261c3b5fe69a35ed64fe8fc1dc1f8efa038b2c6878010dfbfa405f942` |
| `evidence/runs/angular-phonecat-composed/artifacts/deterministic-core.json` | `0eca91fd3dbe51c382da0979c3bcf837501c15f283c279c86c781eb95f849180` |

## Limitations

- Hash integrity does not establish signer authenticity or Git provenance.
- Network controls cover spawned children and browser routing, not OS-wide isolation.
- Node 16 is EOL and used only as a compatibility sandbox.
- This is one composed AngularJS special-track static vertical, not Angular 2+, Angular CLI/AOT, adjacent-major, or bundler proof.
- This does not prove a designated Angular pilot.
- Certification, signing identity, and authenticity are not claimed.
