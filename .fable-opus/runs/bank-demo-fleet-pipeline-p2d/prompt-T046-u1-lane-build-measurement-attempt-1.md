Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u1-lane-build-measurement
Fable-Opus-Timeout-Minutes: 30

## Goal

Phase A of T046, per `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md` §6.1 u1 (read it first — §2.2, §4.2 and §6.4 O1/O2 are the questions this unit settles): prove by MEASUREMENT what today's angular2-hn lane build actually does under both the host Node and the era-cell-provisioned Node — not by schema-reading.

The lane is on disk (the T043-b run materialized it; find its path from `evidence/runs/angular2-hn/run-record.json` — the lane/work directory the record names). The provisioned runtime the era-cell stage records is Node v16.20.2 with `bin/node` on disk (the record names its location).

What to measure, in order:

1. `npm run build` in the lane under HOST Node (whatever `node -v` says, expected v24.x) — capture the complete log to `evidence/spikes/t046-angular-lane-build/build-host-node.log`.
2. `npm run build` in the same lane with `<provision.location>/bin` prepended to PATH (verify `node -v` reports 16.20.2 inside that environment first, and record it) — capture to `evidence/spikes/t046-angular-lane-build/build-node16.log`.
3. `evidence/spikes/t046-angular-lane-build/verdict.json`: for each run — exit code, wall time, the FIRST diagnostic line verbatim, and a `classification` field answering: is the failure the polyfills schema rejection the sizing predicted (`Data path "/polyfills" must be string` class), something else (name it verbatim), or does the build succeed? Plus `nodeVersions: {host, provisioned}` measured, not assumed, and `polyfillsFormInLane`: what the lane's angular.json actually carries for polyfills (string or array — read it and quote it).

Rules of measurement honesty:

- Do NOT fix anything. If the build fails, the failure is the product. If it succeeds under one Node and fails under the other, that split IS the verdict.
- Do not modify the lane: no edits to its angular.json, package.json, node_modules, or any lane file. The build writing its own output directory inside the lane is expected and fine — record what directory it wrote and how many files, if it succeeds.
- If `npm run build` needs a flag the lane's script lacks to run non-interactively, record that as part of the verdict rather than editing the script; try the script exactly as translated first.

## File contract

- `evidence/spikes/t046-angular-lane-build/**`

## Forbidden moves

- No edits under `packages/**`, no edits to the lane's own files, no edits to any existing evidence. Why: this unit is a measurement; a touched lane makes the measurement circular.
- No `git commit`, no `git stash` / `checkout --` / `reset` / `clean`.
- Do not set VERSIONLESS_NETWORK_MODE. The build should be offline-capable (node_modules are installed); if it reaches for the network, that reach is itself a finding to record, not to accommodate.

## Verification

```verify
test -s evidence/spikes/t046-angular-lane-build/build-host-node.log && test -s evidence/spikes/t046-angular-lane-build/build-node16.log && echo BOTH-LOGS-EXIST
node -e "const v=require('./evidence/spikes/t046-angular-lane-build/verdict.json');for(const k of ['host','provisioned']){if(!v.runs||!v.runs[k])throw new Error('missing run '+k);if(typeof v.runs[k].exitCode!=='number')throw new Error(k+' exitCode');if(!v.runs[k].firstDiagnostic&&v.runs[k].exitCode!==0)throw new Error(k+' first diagnostic')}if(!v.nodeVersions||!v.nodeVersions.host||!v.nodeVersions.provisioned)throw new Error('nodeVersions');if(!v.polyfillsFormInLane)throw new Error('polyfillsFormInLane');console.log('VERDICT-COMPLETE host exit='+v.runs.host.exitCode+' node16 exit='+v.runs.provisioned.exitCode)"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES
npm run trust:verify -- --offline
```

## Blocked permission

If the lane directory named by the run record is missing from disk, if the provisioned Node location cannot be found from the era-cell record, or if running the build would require modifying the lane, return status "blocked" with the question in open_questions instead of improvising.
