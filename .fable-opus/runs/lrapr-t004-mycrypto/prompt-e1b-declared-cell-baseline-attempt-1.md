Fable-Opus-Unit: lrapr-t004-mycrypto/e1b-declared-cell-baseline
Fable-Opus-Timeout-Minutes: 35

## Goal

Produce the declared-cell baseline for the mycrypto vertical in /Users/jacksm5pro/dev/open-source/versionless. Everything is staged: **Rosetta 2 was installed moments ago** (verify with `arch -x86_64 /usr/bin/true`, which previously failed and should now succeed); the Node 12.14.1 darwin-x64 runtime was already acquired and SHASUMS-verified by the prior unit (URL + digest in `evidence/ingests/react-mycrypto/runtime-acquisition.json` — if the tarball itself was not retained, re-fetch the exact URL and require the exact recorded digest).

Do:

1. Re-acquire the sealed source archive under consent `VL-LEGACY-CORPUS-2026-08-10` / `VERSIONLESS_NETWORK_MODE=consented` (PM-granted): exact codeload URL from `evidence/ingests/react-mycrypto/source.json`, and REQUIRE the recorded sha256 62eea670ce0ebd6c0c56c60bfc85ac1311a6f4291375ac1abb45508412fc1ccd — a digest mismatch is an immediate blocked finding. Store per the repo's cache convention.
2. Materialize `.versionless/work/react-mycrypto/baseline/`, unpack the verified Node 12.14.1 x64 runtime per the repo's pinned-runtime convention, and under Rosetta (arch -x86_64, PATH pinned to that runtime) run yarn classic install from the committed lockfile (record scripts policy honestly — if native deps need scripts, record which) and the production build **twice**. Require deterministic inventories per the build-profile idiom; record honestly anything that differs.
3. Append the declared-cell attempt outcome to `evidence/ingests/react-mycrypto/baseline-attempt.json` (earlier truthful failures stay) and write the build profile under `evidence/runs/react-mycrypto/` per the papercups idiom.
4. Whole repo gate stays green. yarn registry fetches during install are within the consent; no other network.

## File contract

- `evidence/ingests/react-mycrypto/**`
- `evidence/runs/react-mycrypto/**`
- `fixtures/react-mycrypto/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`

## Forbidden moves

- No packages/frameworks/**, packages/core/**, packages/trust/**, evidence/runs/aggregate.json, evidence/trust/**, scripts/**, docs/** writes.
- Never copy key material, mnemonics, or example wallets into evidence; no secrets/usernames/host-absolute paths.
- Do not delete or rewrite earlier truthful failure evidence — append.
- Strict TypeScript, magic-regexp, pathe, ufo for orchestration code. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-mycrypto/'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If Rosetta still fails the control probe, the archive digest mismatches, a native dependency cannot build under the declared cell (exact dep + error), or the build is irreducibly nondeterministic, return status "blocked" with truthful evidence recorded and specifics in open_questions.
