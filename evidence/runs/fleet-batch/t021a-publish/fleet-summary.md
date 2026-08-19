# Versionless fleet batch

batch: t021a-publish
started: 2026-08-17T21:15:35.589Z
ended: 2026-08-17T21:15:39.804Z
machine time: 4214 ms
applications declared from: /private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/fleet.txt
lane root: ../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes3
forwarded declarations: none
concurrency: one application at a time, in the order declared; nothing in this batch ran in parallel
publish: declared

## Totals

- applications: 2
- proven: 0
- refused: 2
  - `era-cell.node-major-not-inferable`: 1
  - `ingest.acquisition-journal-does-not-match-the-tree`: 1
- defects: 0
- intervention count, summed: 0
- applications asserting no intervention count: 0

Across 2 application(s) the out-of-band harness observed zero interventions and no defect classification. That is a statement about what changed on disk and how many processes were spawned; it is not a statement that any of these applications built or rendered.

## Applications

### react-mycrypto

- framework: not-recorded
- application root: `.versionless/work/react-mycrypto/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes3/react-mycrypto`
- terminal classification: `refused:ingest.acquisition-journal-does-not-match-the-tree`
- intervention count: 0
- exit code: 2
- elapsed: 979 ms
- run record: `evidence/runs/react-mycrypto/run-record.json`
- harness record: `evidence/runs/react-mycrypto/run-record.json.interventions.json`
- refusal code: `ingest.acquisition-journal-does-not-match-the-tree`
- refusal message: Ingest: evidence/ingests/react-mycrypto/source.json journalled the manifest digest 30a28d5274bac1be2f3e3415de16395dbe5da94536151b274f917d8295b66835 for the source it acquired, and the tree on disk walks to c54a55630be55a11eed1bf95a7e80384544dd9b454d678c470a43e8ac235667b. These are not the same bytes, so the revision that journal names is not the revision this tree is sitting at; re-acquire the source, or declare the revision with --revision <commit-sha>.

### react-ant-design-pro-v5-2-0

- framework: not-recorded
- application root: `.versionless/work/react-ant-design-pro-v5-2-0/baseline`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/lanes3/react-ant-design-pro-v5-2-0`
- terminal classification: `refused:era-cell.node-major-not-inferable`
- intervention count: 0
- exit code: 2
- elapsed: 568 ms
- run record: `evidence/runs/react-ant-design-pro-v5-2-0/run-record.json`
- harness record: `evidence/runs/react-ant-design-pro-v5-2-0/run-record.json.interventions.json`
- refusal code: `era-cell.node-major-not-inferable`
- refusal message: Era cell: 6 declaration(s) in this tree state a Node line and none of them names exactly one major this stage reads — Dockerfile#FROM line 1 reads circleci/node:latest-browsers, which names no numeric Node major this stage reads; Dockerfile.dev#FROM line 1 reads node:latest, which names no numeric Node major this stage reads; Dockerfile.hub#FROM line 1 reads circleci/node:latest-browsers, which names no numeric Node major this stage reads; .github/workflows/ci.yml#node_version reads [12.x, 14.x], naming 2 major lines (12, 14); .github/workflows/ci.yml#node-version reads ${{ matrix.node_version }}, which names no numeric Node major this stage reads; package.json#engines.node reads >=10.0.0, which names no numeric Node major this stage reads. A range with an open lower bound names every major above it, a matrix names several, and a floating image tag names whatever it resolves to today rather than what the authors ran; none of those is a reading, and this stage picks from none of them. Declare the era with --node <major>.

## Publish

- `pack` — ran (exit 0): packages/cli/dist is older than the sources it is built from
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
