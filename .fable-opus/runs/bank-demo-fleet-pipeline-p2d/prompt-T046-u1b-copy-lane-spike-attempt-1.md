Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u1b-copy-lane-spike
Fable-Opus-Timeout-Minutes: 30

## Goal

Answer O2 of `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md` on a THROWAWAY COPY, so the owner's supersession-#2 decision (board task T044) is priced by measurement: does angular2-hn build GREEN under the provisioned Node 16.20.2 once the polyfills schema defect is out of the way — or are there more walls behind it? u1 (`evidence/spikes/t046-angular-lane-build/verdict.json`, just committed) proved both Nodes fail identically at schema validation in under 1.2s, so nothing past the validator has ever been exercised for this app.

Method — the copy keeps the measurement honest without touching anything real:

1. Copy the angular2-hn lane (the directory u1's verdict names) to the scratchpad: `/private/tmp/claude-501/-Users-jacksm5pro-dev-open-source-versionless/de642a89-0fc7-4ff1-a441-d000bfbb7418/scratchpad/t046-u1b-lane-copy/`. Copy with `cp -R` (the witness contract forbids symlinks, and a copied node_modules must keep its own .bin links working — verify `node_modules/.bin/ng` resolves inside the copy). node_modules is large; if the copy is too slow, copy everything EXCEPT node_modules and point NODE_PATH... no — do the full copy; budget allows one large cp.
2. In the COPY ONLY, apply the minimal edit u2 would produce: both `polyfills` array sites in `angular.json` (build.options line ~24, test.options line ~105 per u1) back to the string form (`"src/polyfills.ts"` — read the array's own single element and use exactly that value; if the array has more than one element, STOP blocked: the minimal edit is no longer obvious and u2's design needs that fact).
3. `npm run build` in the copy with the provisioned Node PATH-prepended (same environment discipline as u1; verify `node -v` in-shell). Capture the full log to `evidence/spikes/t046-angular-lane-build/build-node16-polyfills-string.log`.
4. Append (do not rewrite) a `postFixRun` block to a NEW file `evidence/spikes/t046-angular-lane-build/verdict-u1b.json`: exit code, wall time, node version measured, the first diagnostic line verbatim if red, and if green: the output directory, file count, and whether index.html landed at its root (the witness contract's input). If red with a NEW wall, that diagnostic is the finding — name it verbatim and classify (app defect vs cell defect vs pipeline seam).
5. Delete nothing: leave the copy in the scratchpad (it is session-scoped and outside the repo).

## File contract

- `evidence/spikes/t046-angular-lane-build/build-node16-polyfills-string.log`
- `evidence/spikes/t046-angular-lane-build/verdict-u1b.json`

## Forbidden moves

- The REAL lane and everything under the repo except the two contract files stay untouched — the copy lives in the scratchpad, outside the repository. Why: the sealed run record describes the real lane; a mutated real lane poisons it.
- No edits under `packages/**`. Why: u2 is owner-gated; this spike prices the decision, it does not preempt it.
- Only the polyfills edit in the copy — no other fixes, however tempting a follow-on failure makes them. Why: one variable per measurement; a second wall found is a finding for the T044 brief, not a todo.
- No `git commit`, no stash/checkout/reset/clean. No VERSIONLESS_NETWORK_MODE; a network reach during build is a finding to record.

## Verification

```verify
test -s evidence/spikes/t046-angular-lane-build/build-node16-polyfills-string.log && echo LOG-EXISTS
node -e "const v=require('./evidence/spikes/t046-angular-lane-build/verdict-u1b.json');if(typeof v.postFixRun.exitCode!=='number')throw new Error('exitCode');if(!v.postFixRun.nodeVersion||!v.postFixRun.nodeVersion.startsWith('v16.20'))throw new Error('node version not provisioned: '+v.postFixRun.nodeVersion);if(v.postFixRun.exitCode!==0&&!v.postFixRun.firstDiagnostic)throw new Error('red without diagnostic');console.log('VERDICT-U1B exit='+v.postFixRun.exitCode)"
git diff --quiet HEAD -- packages evidence/runs && echo REPO-EVIDENCE-UNTOUCHED
npm run trust:verify -- --offline
```

## Blocked permission

If the polyfills array carries more than one element, if the lane copy cannot reproduce a working node_modules (broken .bin links), or if the build's failure mode suggests the copy itself (paths baked into node_modules) rather than the app, return status "blocked" with the question in open_questions instead of improvising.
