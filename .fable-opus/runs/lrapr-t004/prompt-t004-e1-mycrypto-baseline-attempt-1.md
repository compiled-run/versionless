Fable-Opus-Unit: lrapr-t004/t004-e1-mycrypto-baseline
Fable-Opus-Timeout-Minutes: 35

## Goal

Produce the declared-cell baseline for the mycrypto vertical in /Users/jacksm5pro/dev/open-source/versionless. The ingest is committed (`evidence/ingests/react-mycrypto/`, MyCryptoHQ/MyCrypto tag 2.5.64, archive sha256 62eea670…, yarn-classic lockfile): the repo pins Node 12.14.1 exactly (engines + .nvmrc + check-node-version prebuild), and the prior unit recorded a truthful baseline failure because Node 12 has no darwin-arm64 build.

Do:

1. Acquire the official x64 Node 12.14.1 runtime for darwin (to run under Rosetta 2) under consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`: exact nodejs.org URL, sha256 verified against the official SHASUMS256.txt (also fetched and recorded), stored per the repo's existing pinned-runtime convention (see how the workspace pins Node 16.20.2 under .versionless). Record every URL and digest in the ingest evidence. If Rosetta is unavailable on this host, that is a truthful blocked finding.
2. Materialize the verified mycrypto source into `.versionless/work/react-mycrypto/baseline/` from the sealed archive, run `yarn install` (yarn classic, frozen lockfile, scripts policy per the repo's baseline idiom — if install scripts must run for native deps, record exactly which and why; if a native dep cannot build under Rosetta, record the truthful failure) and the production build **twice** under the declared cell (x64 Node 12.14.1). Require deterministic inventories per the repo's build-profile idiom; if the build embeds timestamps/nondeterminism, record honestly what differs.
3. Update `evidence/ingests/react-mycrypto/baseline-attempt.json` (append-style: the earlier truthful failure record stays; the new declared-cell attempt is recorded alongside) and write the build profile under `evidence/runs/react-mycrypto/` per the papercups idiom.
4. Whole repo gate stays green; no product code changes expected this unit.

## File contract

- `evidence/ingests/react-mycrypto/**`
- `evidence/runs/react-mycrypto/**`
- `fixtures/react-mycrypto/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`

## Forbidden moves

- Network ONLY for the consented Node runtime + SHASUMS acquisition and yarn registry fetches during install, all recorded; nothing else.
- No product changes outside packages/cli fixture-scoped orchestration; no packages/frameworks/**, packages/core/**, packages/trust/**, evidence/runs/aggregate.json, evidence/trust/**, scripts/**, docs/**.
- Never copy key material, mnemonics, or example wallets from the mycrypto source into evidence. No secrets/usernames/host paths in evidence.
- Do not delete or rewrite the earlier truthful baseline failure evidence — append alongside it.
- Strict TypeScript, magic-regexp, pathe, ufo for any orchestration code. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-mycrypto/'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If Rosetta is unavailable, the Node 12 x64 runtime cannot be verified against official SHASUMS, a native dependency cannot build under the declared cell (report the exact dep and error), or the build is irreducibly nondeterministic, return status "blocked" with the truthful evidence recorded and specifics in open_questions — a truthfully recorded unreachable cell is a legitimate outcome, not a failure to hide.
