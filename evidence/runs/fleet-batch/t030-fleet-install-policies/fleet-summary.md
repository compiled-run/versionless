# Versionless fleet batch

batch: t030-fleet-install-policies
started: 2026-08-17T23:49:22.039Z
ended: 2026-08-17T23:51:04.007Z
machine time: 101967 ms
applications declared from: evidence/runs/fleet-batch/t029-react-fleet.json
lane root: ../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3
forwarded declarations: --allow-install-scripts --allow-peer-conflicts --allow-remote-tarballs
concurrency: one application at a time, in the order declared; nothing in this batch ran in parallel
publish: declared

## Totals

- applications: 6
- proven: 1
- refused: 3
  - `install.lockfile-absent`: 1
  - `install.lockfile-foreign`: 2
- defects: 2
- intervention count, summed: 0
- applications asserting no intervention count: 0

This batch is not described as unattended: 2 application(s) reached a defect classification.

## Applications

### react-antd-admin-template-v2-0-0

- framework: not-recorded
- application root: `.versionless/work/react-antd-admin-template-v2-0-0/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3/react-antd-admin-template-v2-0-0`
- terminal classification: `defect:install`
- intervention count: 0
- exit code: 1
- elapsed: 91126 ms
- run record: `evidence/runs/react-antd-admin-template-v2-0-0/run-record.json`
- harness record: `evidence/runs/react-antd-admin-template-v2-0-0/run-record.json.interventions.json`

### react-colorme-2019-06-06

- framework: not-recorded
- application root: `.versionless/work/react-colorme-2019-06-06/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3/react-colorme-2019-06-06`
- terminal classification: `refused:install.lockfile-absent`
- intervention count: 0
- exit code: 2
- elapsed: 633 ms
- run record: `evidence/runs/react-colorme-2019-06-06/run-record.json`
- harness record: `evidence/runs/react-colorme-2019-06-06/run-record.json.interventions.json`
- refusal code: `install.lockfile-absent` (raised at stage `install`)
- refusal message: Install: the lane carries none of package-lock.json, npm-shrinkwrap.json, so there is no pinned closure to install. This flow installs a recorded closure rather than resolving a new one.

### react-coverview-a1470b01

- framework: not-recorded
- application root: `.versionless/work/react-coverview-a1470b01/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3/react-coverview-a1470b01`
- terminal classification: `defect:install`
- intervention count: 0
- exit code: 1
- elapsed: 3173 ms
- run record: `evidence/runs/react-coverview-a1470b01/run-record.json`
- harness record: `evidence/runs/react-coverview-a1470b01/run-record.json.interventions.json`

### react-cra-redux-1a06509b

- framework: not-recorded
- application root: `.versionless/work/react-cra-redux-1a06509b/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3/react-cra-redux-1a06509b`
- terminal classification: `refused:install.lockfile-foreign`
- intervention count: 0
- exit code: 2
- elapsed: 597 ms
- run record: `evidence/runs/react-cra-redux-1a06509b/run-record.json`
- harness record: `evidence/runs/react-cra-redux-1a06509b/run-record.json.interventions.json`
- refusal code: `install.lockfile-foreign` (raised at stage `install`)
- refusal message: Install: the lane carries yarn.lock, and this stage reads package-lock.json, npm-shrinkwrap.json. The closure is pinned — by yarn — and it is pinned in a lockfile this flow does not read, so it is not absent and it is not installable here.

### react-flame-v2-4-0

- framework: not-recorded
- application root: `.versionless/work/react-flame-v2-4-0/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3/react-flame-v2-4-0`
- terminal classification: `proven`
- intervention count: 0
- exit code: 0
- elapsed: 4477 ms
- run record: `evidence/runs/react-flame-v2-4-0/run-record.json`
- harness record: `evidence/runs/react-flame-v2-4-0/run-record.json.interventions.json`

### react-your-spotify-1-5-0

- framework: not-recorded
- application root: `.versionless/work/react-your-spotify-1-5-0/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t030-p3/react-your-spotify-1-5-0`
- terminal classification: `refused:install.lockfile-foreign`
- intervention count: 0
- exit code: 2
- elapsed: 844 ms
- run record: `evidence/runs/react-your-spotify-1-5-0/run-record.json`
- harness record: `evidence/runs/react-your-spotify-1-5-0/run-record.json.interventions.json`
- refusal code: `install.lockfile-foreign` (raised at stage `install`)
- refusal message: Install: the lane carries yarn.lock, and this stage reads package-lock.json, npm-shrinkwrap.json. The closure is pinned — by yarn — and it is pinned in a lockfile this flow does not read, so it is not absent and it is not installable here.

## Publish

- `pack` — ran (exit 0): packages/cli/dist is older than the sources it is built from
- `trust:generate` — failed (exit 1):     at async file:///Users/jacksm5pro/dev/open-source/versionless/packages/cli/src/cli.ts:431:5
- `trust:verify` — not-run (exit not-recorded): an earlier step in this chain did not exit 0, so this step was not run
- `report:coverage` — not-run (exit not-recorded): an earlier step in this chain did not exit 0, so this step was not run

## Boundaries this summary does not restate

- witness-passed-on-bounded-anonymous-catalog-surface
- boundary prevalence published as 5-of-6
- The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.
- Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.
- The holdout applications named above are counted in no lineage numerator, and no outcome in this batch changes that.

## Not established

- A count of refusal sites is not a count of refusable applications. What this summary tallies is the outcome each named application reached on this host, in this order, once.
- A refusal is an outcome rather than a failure of the run. The refusing roots are counted at the cost they actually took.
- The fleet here is whatever list this command was handed. It is not a random sample of any target fleet and it carries whatever selection that list carries.
- The timings are one host, one process, a warm page cache and one repetition. They are a reading of this machine rather than a specification.
- An intervention count of zero is the out-of-band harness reporting that no path outside the declared write set changed and that one process was spawned. It is not a statement that any application in this batch produced a working build.
- Applications ran one at a time. Nothing here establishes what any of these outcomes would have been under a loop that fanned out, and the witness surface is the reason this one does not.
- The publish steps below, when declared, report what each command exited with. A regenerated report is a re-derivation of what the evidence on disk already carried; it is not certification, and no authenticity claim rides along with it.

This document is not certification. It reports what each named application reached on this host, once, in the order declared.
