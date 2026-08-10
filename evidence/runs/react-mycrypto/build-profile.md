# react-mycrypto — declared-cell baseline (unreached)

**Unit:** t004-e1-mycrypto-baseline
**Result:** `declared-cell-unreachable-no-build-executed`
**Canonical digest:** `ecae651d05bea0dcf249619ebf9de6758bb497683adc0fc1e5412afc8d194cb0`

## What this unit set out to do

Run `yarn install` and the MyCrypto production build twice under the cell the repository
declares — Node **12.14.1** exactly, pinned in `package.json` `engines.node`, in `.nvmrc`,
and enforced by a `check-node-version` prebuild step — and record a deterministic artifact
inventory. A prior unit had recorded a truthful failure: the Node 12 line ships no
darwin-arm64 build, so the declared cell could not be run natively on this host. The plan
for this unit was to close that gap with the official **x64** build running under Rosetta 2.

## What actually happened

The runtime was acquired and verified. It could not be executed.

### 1. Runtime acquisition — succeeded

| Artifact | URL | sha256 |
| --- | --- | --- |
| Checksum manifest | `https://nodejs.org/dist/v12.14.1/SHASUMS256.txt` | `e8edaf58…aa302` |
| Runtime archive | `https://nodejs.org/dist/v12.14.1/node-v12.14.1-darwin-x64.tar.gz` | `0be10a28…f78f` |

The archive digest was checked with `shasum -a 256 -c` against the line for
`node-v12.14.1-darwin-x64.tar.gz` taken from the official `SHASUMS256.txt` fetched in the
same consented window. Result: **OK**. Both fetches ran under consent
`VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`, and both are
recorded in `evidence/ingests/react-mycrypto/runtime-acquisition.json`.

### 2. Execution — blocked, Rosetta 2 absent

The extracted binary is a single-architecture `x86_64` Mach-O. Both invocations failed:

- direct — exit `127`, `bad CPU type in executable`
- translated, `/usr/bin/arch -x86_64` — exit `1`, `arch: posix_spawnp: Bad CPU type in executable`

The cause is isolated to the missing translation layer rather than to the acquired runtime.
The control probe `/usr/bin/arch -x86_64 /usr/bin/true` fails the same way, even though
`/usr/bin/true` on this host **does** carry an `x86_64` slice alongside `arm64e`. The
installation markers agree: `/Library/Apple/usr/libexec/oah` is absent, the
`com.apple.oahd.plist` LaunchDaemon is absent, and `oahd` is not running.

Installing Rosetta 2 needs `softwareupdate --install-rosetta`, which requires administrator
privileges and an interactive licence acceptance, and mutates the host rather than the
repository. It was not attempted. No container runtime was available as a fallback either —
`docker`, `podman`, and `colima` are all absent.

### 3. Source materialization — blocked, sealed archive absent

`.versionless/work/react-mycrypto/baseline` was not materialized. The ingest's sealed source
archive (`62eea670…1ccd`) is no longer present in the local cache, and re-fetching it from
`codeload.github.com` was outside this unit's recorded network allowance, which covered the
Node runtime and SHASUMS only. The source was therefore not re-downloaded.

## Consequences for the gates

| Gate | State |
| --- | --- |
| Runtime acquisition | pass — consented and recorded |
| Runtime digest verification | pass — against official SHASUMS |
| Declared-cell execution | **blocked** — Rosetta 2 absent |
| Source materialization | **blocked** — sealed archive absent |
| Baseline built twice | not run |
| Build determinism | not run |

No install ran, so no yarn registry fetch occurred, no lifecycle-script decision was
reached, and whether any native dependency builds under the declared cell remains unknown.

## Non-claims

- No build ran. This record establishes nothing about whether MyCrypto compiles, in the
  declared cell or any other. Build determinism for this fixture remains unmeasured.
- The declared cell was neither reached nor substituted. Its unreachability is recorded as
  observed; no downgrade, pin, flag, or engine override was applied to manufacture a pass.
- A verified runtime digest establishes byte agreement with the release nodejs.org
  published. It establishes no signer authenticity: the detached GPG signature over
  `SHASUMS256.txt` was not checked against a key this unit holds.
- No browser behavior, journey coverage, migration feasibility, pilot status, production
  readiness, certification, or legal approval is established by this record.

## To unblock

1. Run the declared cell on a host with Rosetta 2 installed, or on an x86_64 host. The
   runtime URL and verified digest above are ready to reuse as-is.
2. Grant an allowance covering the pinned source archive so
   `.versionless/work/react-mycrypto/baseline` can be materialized, or re-run the consented
   source acquisition for `react-mycrypto`.
