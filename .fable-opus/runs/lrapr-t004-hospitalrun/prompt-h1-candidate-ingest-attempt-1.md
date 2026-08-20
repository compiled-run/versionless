Fable-Opus-Unit: lrapr-t004-hospitalrun/h1-candidate-ingest
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest HospitalRun frontend as the third React tranche candidate in /Users/jacksm5pro/dev/open-source/versionless, slug exactly `react-hospitalrun`. Target: HospitalRun/hospitalrun-frontend @ tag `v2.0.0-alpha.7` (expected commit 8156955145551d0366df10faa28e724f3377dea1, 2020-11) — a prior read-only scout verified MIT at this tag ("MIT License / Copyright (c) 2019 HospitalRun"), React ~16.13.0, react-scripts ~3.4.0 (CRA/webpack 4), client-side PouchDB persistence. Owner context: this replaces a dropped crypto-wallet candidate because the evidence corpus is approvals-facing; healthcare CRUD is the wanted shape.

Re-verify all admission gates yourself at the pinned revision (MIT quoted; substantive app; React 15–17; CRA/webpack ≤4; age; ≥3 plausible journeys — patient intake/edit, appointment scheduling, lab request workflow, incident reporting). Known risks to record honestly: `pouchdb-authentication` may imply a CouchDB remote on the login path (record what the code actually does; local-only operation is expected but verify); alpha maturity; an i18n `translation:check` gate in the start script.

Then, following the established ingest evidence shapes (committed examples: `evidence/ingests/react-papercups-v1-0-0/`, `evidence/ingests/react-mycrypto/`): acquisition under consent `VL-LEGACY-CORPUS-2026-08-10` / `VERSIONLESS_NETWORK_MODE=consented` (GET-only, every URL+digest ledgered, archive fetched twice byte-identical), blob-level tree reconciliation (0/0/0 required), license/rights evidence, provenance, dependency closure with honest lock state, declared legacy Node/bundler cell (record what the repo itself pins — engines/.nvmrc; note Rosetta 2 and a verified Node 12.14.1 x64 runtime are available on this host if the declared cell needs x64), and one truthful baseline install/build attempt in the declared cell or the nearest honestly-labeled cell. Record every acquisition step as ad-hoc invocations logged verbatim into `transcript.ndjson`; the repo Bash guard refuses compound shell commands — issue each request as a separate plain invocation. Write `fixtures/react-hospitalrun/fixture.json` per idiom.

## File contract

- `fixtures/react-hospitalrun/**`
- `evidence/ingests/react-hospitalrun/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/**, other evidence/ingests/** dirs, or anywhere outside the contract.
- No `.js`/`.mjs`/`.cjs` files created anywhere (strict-TypeScript repo policy).
- No secrets, tokens, usernames, or host-absolute paths in evidence; preserve unknown states; no certification language.
- Network for consented acquisition (archive, metadata, registry fetches for the baseline install) only, all recorded.
- Do not commit or stage anything.

## Verification

```verify
sh -c 'ls evidence/ingests/react-hospitalrun/source.json evidence/ingests/react-hospitalrun/attempt.json fixtures/react-hospitalrun/fixture.json'
sh -c '! find evidence/ingests/react-hospitalrun fixtures/react-hospitalrun -name "*.mjs" -o -name "*.js" -o -name "*.cjs" | grep -q .'
pnpm exec tsc --noEmit
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If any admission gate fails at the pinned revision (record it append-only and return blocked — do NOT substitute a different candidate; the PM re-cuts), the archive digests mismatch between fetches, or the baseline cannot run in any honestly-labeled cell, return status "blocked" with specifics in open_questions.
