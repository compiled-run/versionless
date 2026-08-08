# Versionless migration receipt

- Run: `T011-angular-phonecat`
- Fixture: `angular-phonecat`
- Result: **pass**
- Source revision: `ef6f6eb672ded472b4e442d598f5df40d0e0642c`
- Canonical SHA-256: `a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51`
- Authenticity: **not established** (hash integrity only)

## Migration

`app/phone-detail/phone-detail.component.js` received 3 minimal span edits under Yuku semantic refusal. The constructable outer controller and dependency-injection annotation are preserved. This is AngularJS special-track evidence only.

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
| `evidence/runs/angular-phonecat/artifacts/preparation.json` | `a12c35d28973404e6d2a5f2eebbe661cbe0790626d1401e805367ab684d6aeaf` |
| `evidence/runs/angular-phonecat/artifacts/runtime.json` | `97dae2015936f316668f530e8e2e41962e7b9dc0991f0dad6367844b756cd246` |
| `evidence/runs/angular-phonecat/artifacts/journey.json` | `299308578fc043f3d09d3e189c1e14a9b1d12d4f42df37dfbf89bb9c4c2e1300` |
| `evidence/runs/angular-phonecat/artifacts/locality.json` | `aa69f52db453ae704b9436a049a148d8042fd05a3f6b1c06e5aaf752b5b20477` |
| `evidence/runs/angular-phonecat/artifacts/mutation.json` | `62fb4c81d3c65f2ff2e5bcc9ac5739953220a049a3249a875c55d8bda3a6576c` |
| `evidence/runs/angular-phonecat/artifacts/migration-diff.json` | `10d5059b378bdf6753b6198049d81155a0de14164064ad5982594cf815c17267` |
| `evidence/runs/angular-phonecat/artifacts/deterministic-core.json` | `9d05110c002d26ffba39648d1845e441d26c9ea2721100286203b4eb6b54cb20` |

## Limitations

- Hash integrity does not establish signer authenticity or provenance beyond pinned downloads.
- Network controls cover spawned Node/npm children and browser routing, not OS-wide process isolation.
- Node 16 is EOL and used only as a compatibility sandbox.
- The transform is approved only for the exact proven PhoneDetail shape.
- This is AngularJS special-track evidence only and does not prove the required Angular designated pilot.
- This static application has no bundler and does not prove Angular CLI or AOT behavior.
- This receipt is not certification or a legal attestation.
