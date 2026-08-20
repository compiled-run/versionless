Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u5-thread-cell-runtime
Fable-Opus-Timeout-Minutes: 35

## Goal

Phase C unit u5 of T046, per `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md` §4 and §6.1 u5 (read §4.1-§4.2 first — the mechanism is fully mapped): turn the era-cell record's runtime claim from prose into enforcement. Today `run.ts:468` DISCARDS the era-cell stage's return, `install.ts:432` passes host `PATH` through verbatim, and the sizing measured the consequence: angular2-hn's 844 packages were resolved by host Node v24 while the record asserts the provisioned v16.20.2 — and the 13 CLI warns-and-proceeds on Node 24, so mismatches fail late and namelessly in webpack (§4.2's trap).

What to build (the sizing says the pieces all exist):

1. Capture the era-cell record at `run.ts:468` so the provision reaches the install and build stages — the sizing calls it a three-line chaining change; verify that against the code.
2. When the era-cell stage PROVISIONED a runtime (record names its location with `bin/node` on disk), pass an environment with `<provision.location>/bin` PREPENDED to `PATH` into both `runLaneInstall` and `runLaneBuild` (`runLaneBuild` already takes an `environment` parameter that run never passes — §4.2; check what install's spawn accepts and follow the same shape). When the cell provisions the HOST runtime (the react/16 path — flame's cell provisions host), the environment must be EXACTLY what it is today — that identity is the sealed-path guard.
3. Record the runtime on both rows so the claim is corroborated: the install row and build row each carry the node version actually resolved inside the build/install shell (measure it — `node -v` resolution through the constructed PATH — or record the provision path used; follow whatever the rows' existing shapes accommodate without inventing a new record surface; the honest minimum is the provision location + declared version when a provision was used, and an explicit host marker when not).
4. Tests (`operator-flows.test.ts` or `operator-install-build.test.ts` — wherever install/build spawn behavior is tested): provisioned cell → PATH prepended, rows record it; host cell → environment identical to today, rows record host; the flame-shaped path produces byte-identical env.
5. Census: `run.ts`/`install.ts`/`build.ts` line shifts — regenerate `evidence/runs/operator-flows/refusal-census.json`; if any new refusal site was added (there should be NONE — this unit adds enforcement plumbing, not refusals; a missing provision is already the era-cell stage's problem), justify it or remove it. If census counts change beyond relining, run the trust regen with the u10-measured ordering: census first, then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`.
6. THE REPRODUCTION GATE: a fresh flame re-run (fresh first invocation, three fleet policies, no offline env) must come back proven 9/9, count 0, build row carrying `build-vite`/24, and its install/build environments unchanged in substance (host runtime, now explicitly recorded as such if your recording lands on its rows — the T028 bar and sealed numbers bind).

GUARDS: react 6/6 + angular 4/4; composite `140ce86e`; coverage totals `{23,11,2,6,4}` (flame stays proven; its record may absorb the new runtime fields — that is honest recording, not drift; the FIVE pinned build fields must not move).

## File contract

- `packages/cli/src/operator/run.ts`
- `packages/cli/src/operator/install.ts`
- `packages/cli/src/operator/build.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-install-build.test.ts`
- `evidence/runs/react-flame-v2-4-0/**`
- `evidence/runs/witness-synthesized/**`
- `evidence/runs/operator-flows/refusal-census.json`
- `evidence/trust/current/**`

## Forbidden moves

- Do not change what the era-cell stage itself does or refuses — this unit consumes its record, it does not edit the stage. Why: era-cell semantics are sealed behavior with their own tests.
- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. Why: T044 is owner-gated; composite stands.
- The host-cell path's environment must be byte-identical to today's. Why: flame's 9/9 is the repository's only fully-proven run; its reproduction is the gate every operator change passes through.
- No `git commit`, no stash/checkout/reset/clean. Never set VERSIONLESS_NETWORK_MODE=offline on the flame run itself.

## Verification

```verify
pnpm exec vp test --project node
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const b=(r.stages||[]).find(s=>(s.stage||s.name)==='build');const j=JSON.stringify(b);if(!j.includes('build-vite'))throw new Error('outDirectory moved');if(!j.includes('\"outputFiles\":24')&&!j.includes('outputFiles: 24'))throw new Error('outputFiles moved');console.log('FLAME-BUILD-ROW-STABLE')"
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');if(r.interventionCount!==undefined&&r.interventionCount!==0)throw new Error('count');const rows=(r.stages||[]).filter(s=>s.status==='ran');if(rows.length!==9)throw new Error('stages ran '+rows.length);console.log('FLAME-9-9-PROVEN')"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If the chaining is not the three-line change the sizing claims, if install's spawn shape cannot take an environment without redesign, if recording the runtime needs a record-schema change beyond adding fields the shapes accommodate, or if the flame reproduction moves a pinned field, return status "blocked" with the question in open_questions instead of improvising.
