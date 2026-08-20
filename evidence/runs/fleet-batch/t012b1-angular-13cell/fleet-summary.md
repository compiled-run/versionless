# Versionless fleet batch

batch: t012b1-angular-13cell
started: 2026-08-20T09:19:52.248Z
ended: 2026-08-20T09:19:57.538Z
machine time: 5289 ms
applications declared from: evidence/runs/fleet-batch/t012b1-angular-fleet.json
lane root: ../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t012b1
forwarded declarations: --allow-install-scripts --allow-peer-conflicts --allow-remote-tarballs --cell angular-13.4.0
concurrency: one application at a time, in the order declared; nothing in this batch ran in parallel
publish: declared

## Totals

- applications: 2
- proven: 0
- refused: 2
  - `ingest.revision-not-determined`: 2
- defects: 0
- intervention count, summed: 0
- applications asserting no intervention count: 0

Across 2 application(s) the out-of-band harness observed zero interventions and no defect classification. That is a statement about what changed on disk and how many processes were spawned; it is not a statement that any of these applications built or rendered.

## Applications

### angular2-hn

- framework: angular
- application root: `.versionless/cache/angular2-hn/acquisition/source`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t012b1/angular2-hn`
- terminal classification: `refused:ingest.revision-not-determined`
- intervention count: 0
- exit code: 2
- elapsed: 1352 ms
- run record: `evidence/runs/angular2-hn/run-record.json`
- harness record: `evidence/runs/angular2-hn/run-record.json.interventions.json`
- refusal code: `ingest.revision-not-determined` (raised at stage `ingest`)
- refusal message: Ingest: .versionless/cache/angular2-hn/acquisition/source carries no readable Git metadata and no acquisition journal of this pipeline's own names it, so the revision this source is pinned to is not something this stage read. An unpinned source has no revision for the licence reading or any later record to be relative to; declare it with --revision <commit-sha>.

### angular-kubernetes-dashboard

- framework: angular
- application root: `.versionless/cache/angular-kubernetes-dashboard-stage-t678/acquisition/source`
- lane: `../../../../../private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t012b1/angular-kubernetes-dashboard`
- terminal classification: `refused:ingest.revision-not-determined`
- intervention count: 0
- exit code: 2
- elapsed: 1380 ms
- run record: `evidence/runs/angular-kubernetes-dashboard/run-record.json`
- harness record: `evidence/runs/angular-kubernetes-dashboard/run-record.json.interventions.json`
- refusal code: `ingest.revision-not-determined` (raised at stage `ingest`)
- refusal message: Ingest: .versionless/cache/angular-kubernetes-dashboard-stage-t678/acquisition/source carries no readable Git metadata and no acquisition journal of this pipeline's own names it, so the revision this source is pinned to is not something this stage read. An unpinned source has no revision for the licence reading or any later record to be relative to; declare it with --revision <commit-sha>.

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
