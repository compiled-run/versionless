# Versionless fleet batch

batch: t013a-undeclared
started: 2026-08-17T21:38:59.612Z
ended: 2026-08-17T21:39:06.151Z
machine time: 6538 ms
applications declared from: evidence/runs/fleet-batch/t013a-react-fleet.json
lane root: ../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared
forwarded declarations: none
concurrency: one application at a time, in the order declared; nothing in this batch ran in parallel
publish: declared

## Totals

- applications: 6
- proven: 0
- refused: 6
  - `era-cell.cell-not-declared-for-framework`: 2
  - `era-cell.node-major-not-inferable`: 1
  - `ingest.identifier-not-determined`: 1
  - `ingest.revision-not-determined`: 2
- defects: 0
- intervention count, summed: 0
- applications asserting no intervention count: 0

Across 6 application(s) the out-of-band harness observed zero interventions and no defect classification. That is a statement about what changed on disk and how many processes were spawned; it is not a statement that any of these applications built or rendered.

## Applications

### react-antd-admin-template-v2-0-0

- framework: react
- application root: `.versionless/work/react-antd-admin-template-v2-0-0/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared/react-antd-admin-template-v2-0-0`
- terminal classification: `refused:era-cell.cell-not-declared-for-framework`
- intervention count: 0
- exit code: 2
- elapsed: 856 ms
- run record: `evidence/runs/react-antd-admin-template-v2-0-0/run-record.json`
- harness record: `evidence/runs/react-antd-admin-template-v2-0-0/run-record.json.interventions.json`
- refusal code: `era-cell.cell-not-declared-for-framework`
- refusal message: Era cell: the react lineage publishes no target-cell registry this stage can read a Node line out of — The frozen React and Next.js adapters publish no target-cell package registry, so no per-package verdict exists for this lineage. Every declared dependency is unknown to the engine rather than accepted by it. — and the tree declares no Node era of its own in .nvmrc, .node-version, package.json#volta.node, .tool-versions, any Dockerfile* FROM a node image, any .github/workflows node-version, or package.json#engines.node. Nothing here names the toolchain era the install stage would run inside; declare it with --cell <id> or --node <major>.

### react-colorme-2019-06-06

- framework: react
- application root: `.versionless/work/react-colorme-2019-06-06/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared/react-colorme-2019-06-06`
- terminal classification: `refused:era-cell.cell-not-declared-for-framework`
- intervention count: 0
- exit code: 2
- elapsed: 576 ms
- run record: `evidence/runs/react-colorme-2019-06-06/run-record.json`
- harness record: `evidence/runs/react-colorme-2019-06-06/run-record.json.interventions.json`
- refusal code: `era-cell.cell-not-declared-for-framework`
- refusal message: Era cell: the react lineage publishes no target-cell registry this stage can read a Node line out of — The frozen React and Next.js adapters publish no target-cell package registry, so no per-package verdict exists for this lineage. Every declared dependency is unknown to the engine rather than accepted by it. — and the tree declares no Node era of its own in .nvmrc, .node-version, package.json#volta.node, .tool-versions, any Dockerfile* FROM a node image, any .github/workflows node-version, or package.json#engines.node. Nothing here names the toolchain era the install stage would run inside; declare it with --cell <id> or --node <major>.

### react-coverview-a1470b01

- framework: react
- application root: `.versionless/work/react-coverview-a1470b01/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared/react-coverview-a1470b01`
- terminal classification: `refused:era-cell.node-major-not-inferable`
- intervention count: 0
- exit code: 2
- elapsed: 588 ms
- run record: `evidence/runs/react-coverview-a1470b01/run-record.json`
- harness record: `evidence/runs/react-coverview-a1470b01/run-record.json.interventions.json`
- refusal code: `era-cell.node-major-not-inferable`
- refusal message: Era cell: 1 declaration(s) in this tree state a Node line and none of them names exactly one major this stage reads — package.json#engines.node reads >=24.x, which names no numeric Node major this stage reads. A range with an open lower bound names every major above it, a matrix names several, and a floating image tag names whatever it resolves to today rather than what the authors ran; none of those is a reading, and this stage picks from none of them. Declare the era with --node <major>.

### react-cra-redux-1a06509b

- framework: react
- application root: `.versionless/work/react-cra-redux-1a06509b/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared/react-cra-redux-1a06509b`
- terminal classification: `refused:ingest.identifier-not-determined`
- intervention count: 0
- exit code: 2
- elapsed: 564 ms
- run record: `evidence/runs/react-cra-redux-1a06509b/run-record.json`
- harness record: `evidence/runs/react-cra-redux-1a06509b/run-record.json.interventions.json`
- refusal code: `ingest.identifier-not-determined`
- refusal message: Ingest: package.json declares no name, so this application has no identity this stage read. The directory it happens to sit in is not an identity, and this flow does not use one as a substitute; declare it with --id <identifier>.

### react-flame-v2-4-0

- framework: react
- application root: `.versionless/work/react-flame-v2-4-0/baseline/client`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared/react-flame-v2-4-0`
- terminal classification: `refused:ingest.revision-not-determined`
- intervention count: 0
- exit code: 2
- elapsed: 622 ms
- run record: `evidence/runs/react-flame-v2-4-0/run-record.json`
- harness record: `evidence/runs/react-flame-v2-4-0/run-record.json.interventions.json`
- refusal code: `ingest.revision-not-determined`
- refusal message: Ingest: .versionless/work/react-flame-v2-4-0/baseline/client carries no readable Git metadata and no acquisition journal of this pipeline's own names it, so the revision this source is pinned to is not something this stage read. An unpinned source has no revision for the licence reading or any later record to be relative to; declare it with --revision <commit-sha>.

### react-your-spotify-1-5-0

- framework: react
- application root: `.versionless/work/react-your-spotify-1-5-0/baseline/client`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes-t013a-undeclared/react-your-spotify-1-5-0`
- terminal classification: `refused:ingest.revision-not-determined`
- intervention count: 0
- exit code: 2
- elapsed: 652 ms
- run record: `evidence/runs/react-your-spotify-1-5-0/run-record.json`
- harness record: `evidence/runs/react-your-spotify-1-5-0/run-record.json.interventions.json`
- refusal code: `ingest.revision-not-determined`
- refusal message: Ingest: .versionless/work/react-your-spotify-1-5-0/baseline/client carries no readable Git metadata and no acquisition journal of this pipeline's own names it, so the revision this source is pinned to is not something this stage read. An unpinned source has no revision for the licence reading or any later record to be relative to; declare it with --revision <commit-sha>.

## Publish

- `pack` — skipped (exit not-recorded): packages/cli/dist is not older than the sources it is built from
- `trust:generate` — ran (exit 0): the step exited 0
- `trust:verify` — ran (exit 0): the step exited 0
- `report:coverage` — ran (exit 0): the step exited 0

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
