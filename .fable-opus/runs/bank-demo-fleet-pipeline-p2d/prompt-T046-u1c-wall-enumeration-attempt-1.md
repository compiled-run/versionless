Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u1c-wall-enumeration
Fable-Opus-Timeout-Minutes: 30

## Goal

Complete the wall enumeration for the T044 owner brief: iterate the copy-lane measurement until angular2-hn's lane either builds GREEN under the provisioned Node 16.20.2 or hits a wall that is NOT an adapter-written value. u1 measured wall #1 (polyfills array vs 13 schema — adapter rewrite ungated on cell), u1b fixed it in the copy and measured wall #2 (tsconfig target ES2022 vs esbuild 0.14.22 — SAME defect class, `angular-workspace-migration.ts:521-529`). The copy already carries the polyfills fix and lives at `/private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t046-u1b-lane-copy`. Read `evidence/spikes/t046-angular-lane-build/verdict-u1b.json` first.

The iteration rule — one variable per step, adapter-attributable fixes only:

1. In the COPY, apply the minimal edit that the _properly cell-gated adapter_ would have produced for wall #2: the tsconfig `target`/`module` values the era app declared (`es2015` per the run record's `compilerOptions.target: "es2015" -> "ES2022"` line) restored — i.e., what `migrateAngularTsConfig` would write if it consulted the cell. Check whether the same ES2022 value was written anywhere else the build consumes (`tsconfig.app.json`, `angular.json` script targets) and treat all sites written by that one adapter rewrite as ONE step.
2. Rebuild under the provisioned Node (PATH-prepend, verify `node -v` in-shell). Capture each attempt's full log as `evidence/spikes/t046-angular-lane-build/build-node16-step<N>.log`.
3. If it fails on a NEW wall: classify it. If the failed value was WRITTEN BY AN ADAPTER REWRITE (trace it to the file:line in `packages/frameworks/angular/src/` and the run record's config-change row, like u1b did), record it as the next wall and iterate — fix, rebuild, next log. If the failure is NOT adapter-written (an app defect, a host limit, a devkit bug on its own values), STOP: that wall is the enumeration's honest end.
4. Stop conditions: green build; non-adapter wall; 3 iterations beyond u1b's; or budget. Every step is one variable, recorded before the next begins.
5. If GREEN: record the output directory, file count, whether `index.html` sits at its root (the witness input contract), and total build wall time. That completes the T044 price: the exact list of ungated rewrites standing between authorization and a building Angular lane.
6. Write `evidence/spikes/t046-angular-lane-build/verdict-u1c.json`: `steps[]` (each: wallName, adapterSite file:line or 'not-adapter', editApplied, exitCode, firstDiagnostic verbatim or null, wallTimeMs), and `enumeration: {complete: bool, terminal: 'green'|'non-adapter-wall'|'iteration-cap'|'budget', wallsTotal}`.

## File contract

- `evidence/spikes/t046-angular-lane-build/**`

## Forbidden moves

- The real lane, `packages/**`, and `evidence/runs/**` stay untouched; all edits happen in the scratchpad copy. Why: this prices the T044 decision, it does not preempt it — no frozen byte moves without the owner's authorization.
- Only adapter-attributable fixes, each traced to its rewrite site before applying. Why: the enumeration's product is the list of ungated adapter rewrites; an untraced hack makes the list a lie.
- Do not rewrite u1/u1b evidence files — new files only. No `git commit`, no stash/checkout/reset/clean, no VERSIONLESS_NETWORK_MODE (a network reach is a finding).

## Verification

```verify
node -e "const v=require('./evidence/spikes/t046-angular-lane-build/verdict-u1c.json');if(!Array.isArray(v.steps)||v.steps.length<1)throw new Error('no steps');for(const s of v.steps){if(typeof s.exitCode!=='number'||!s.wallName)throw new Error('step incomplete: '+JSON.stringify(s).slice(0,100))}if(!v.enumeration||typeof v.enumeration.complete!=='boolean')throw new Error('enumeration verdict missing');console.log('ENUMERATION terminal='+v.enumeration.terminal+' walls='+v.enumeration.wallsTotal)"
git diff --quiet HEAD -- packages evidence/runs && echo REPO-UNTOUCHED
npm run trust:verify -- --offline
```

## Blocked permission

If the copy has been cleaned up since u1b, if a wall's adapter attribution is genuinely ambiguous (two rewrites could have written the value), or if a fix cannot be expressed without changing more than that one rewrite's output, return status "blocked" with the question in open_questions instead of improvising.
