Fable-Opus-Unit: bank-demo-fleet-pipeline-p2e/T032-i4-flame-refresh
Fable-Opus-Timeout-Minutes: 30

## Goal

The natural refresh i3's receipt named: re-run react-flame through the single command so its record carries the session's new honesty fields with MEASURED values instead of "reading absent" — i2's `installScripts` (RAN/SKIPPED from npm's own banners under the npm-12 gate), u5/u5b's runtime blocks, and i3's per-journey witness `journeys`+`locality` — making the published `provenBoundedness` read measured bounds. This is the same fresh-first-invocation harness every flame gate this session used (u3's receipt and `notes/T012-angular-batch.md` describe the invocation; the record's own provenance names the command): three fleet-wide install policies, no offline env, fresh lane.

Requirements:
1. interventionCount 0, terminal proven, 9/9 ran — the T028 bar. If ANY of that regresses, that is a blocked-level finding naming the stage: do not publish a regressed record over the current one (leave the tree as the failure left it and report).
2. The five pinned build fields reproduce (`build-vite`, `outputFiles: 24`, command/script/configuration).
3. The refreshed record's install row must show the i2 fields with real values (policy declared → `--dangerously-allow-all-scripts` emitted on npm 12, `ran`/`skipped` read from banners); the witness row must carry `journeys` and `locality`; both runtime blocks present (host cell → source: host, versions agreeing).
4. The witness-synthesized record lands under the NEW per-application slot (`evidence/runs/witness-synthesized/react-flame-v2-4-0/`) — i3 migrated the old record byte-identical; your run regenerates it in place under the new key. If the legacy `baseline/` slot gets rewritten too, report what wrote it (that would mean a second path i3's key change missed — a finding).
5. Publish per the ordering (census only if sites move — they should not; trust:generate offline; verify chain). Coverage totals stay `{23,11,2,5,5}`; flame's row now shows measured bounds; matrix 6/6+4/4; composite `140ce86e`.

## File contract

- `evidence/runs/react-flame-v2-4-0/**`
- `evidence/runs/witness-synthesized/**`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- No edits under `packages/**`. Why: this is a measurement of the pipeline as committed at 893059c; a defect found is a finding.
- Do not delete the angular2-hn records or any other app's evidence. No git commit, no stash/checkout/reset/clean, no offline env on the run.
- Do not publish a regressed record (see requirement 1). Why: flame is the repository's only 9/9; a silent downgrade would poison the oracle's command half.

## Verification

```verify
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const ran=(r.stages||[]).filter(s=>s.status==='ran').length;if(ran!==9)throw new Error('stages '+ran);console.log('FLAME-9-9')"
node -e "const i=require('./evidence/runs/react-flame-v2-4-0/run-record.json.interventions.json');const c=i.interventionCount??i.count;if(c!==0)throw new Error('interventions '+c);console.log('INTERVENTIONS-0')"
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const b=(r.stages||[]).find(s=>(s.stage||s.name)==='build');const j=JSON.stringify(b);if(!j.includes('build-vite')||!j.includes('\"outputFiles\":24'))throw new Error('pinned build fields moved');console.log('BUILD-FIELDS-REPRODUCED')"
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const inst=(r.stages||[]).find(s=>(s.stage||s.name)==='install');const w=(r.stages||[]).find(s=>(s.stage||s.name)==='witness');const ji=JSON.stringify(inst),jw=JSON.stringify(w);if(!ji.includes('installScripts'))throw new Error('no installScripts reading');if(!jw.includes('journeys')||!jw.includes('locality'))throw new Error('witness row thin');console.log('HONESTY-FIELDS-MEASURED')"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json');const t=r.totals;if(t.proven!==11||t.applications!==23)throw new Error(JSON.stringify(t));const f=r.applications.find(a=>a.id==='react-flame-v2-4-0');if(!f.provenBoundedness)throw new Error('no bounds on row');console.log('ROW-BOUNDED:',JSON.stringify(f.provenBoundedness).slice(0,150))"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES
```

## Blocked permission

If the run regresses below 9/9 or count 0, if a pinned build field moves, or if the witness-synthesized write lands anywhere i3's key change did not predict, return status "blocked" with the finding in open_questions instead of improvising.