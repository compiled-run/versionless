Fable-Opus-Unit: bank-demo-fleet-pipeline-p1d/T036-install-sandbox-hooks
Fable-Opus-Timeout-Minutes: 30

## Goal

Close the release blocker T999 found: an acquired application's install scripts must not be able to write outside their lane — and remove the residue the last escape left in this repository's git hooks. **The owner has explicitly authorized the hook cleanup** (option: "Remove the husky residue — delete `.git/hooks/husky.local.sh` and restore the 18 hooks to git's default `.sample`-only state; the repo declares no husky of its own").

The finding, verbatim from the audit (`docs/goals/bank-demo-fleet-pipeline/notes/T999-final-audit.md`): `.git/hooks/husky.local.sh` was created 2026-08-10 with the header `From: /Users/jacksm5pro/dev/open-source/versionless/.versionless/work/react-mycrypto/baseline/node_modules/husky`; all 18 non-sample hooks were overwritten to source it; it fired during commits today ("Can't find yarn in PATH … Skipping pre-commit hook") and is inert only because `yarn` is absent from PATH.

Deliver:

**(1) Sandbox the install stage.** `packages/cli/src/operator/install.ts` runs `npm install`/`npm ci` in the lane with install scripts allowed when `--allow-install-scripts` is declared. Constrain that child process so a script cannot write outside the lane: set `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `npm_config_cache`, `npm_config_prefix`, `npm_config_userconfig`, `npm_config_globalconfig` to lane-owned directories (e.g. `<lane>/.install-home/…`), strip inherited env that points at the user's home or this repository, and set `cwd` to the lane. Then VERIFY the boundary rather than trusting it: snapshot `<project-root>/.git/hooks` (and the project root's top level) before and after the install child runs; any create/modify outside the lane → the stage refuses with a NEW named code `install.script-wrote-outside-lane` naming every path, and the record carries what was attempted. (A refusal here is exit 2 like any other; the coverage report counts it.)

**(2) The counter must see hook writes.** Add `<root>/.git/hooks/**` to the intervention counter's C1 snapshot set in `packages/cli/src/operator/intervention-count.ts` (it currently walks tracked paths — `.git` is not tracked, so a hook write is invisible to the gate today). One test: a child that writes `<root>/.git/hooks/x` counts 1 and names the path.

**(3) Remove the residue, exactly as authorized.** In `<project-root>/.git/hooks`: delete `husky.local.sh` and `husky.sh` if present, and delete each of the 18 non-`.sample` hook files (they all source husky per the audit — verify each does before deleting; if any hook does NOT reference husky, leave it and report it). Leave every `*.sample` file. Record in the receipt: every file deleted with its first line, and every file left. This is repository config surgery — do it with `ls`/`head` first, deletions second, and list everything.

**(4) Test the sandbox** with a fixture package whose postinstall attempts `mkdir -p <root>/.git/hooks && echo x > <root>/.git/hooks/pwned` (build the fixture in a temp dir with a file: tarball or a local package — no network): assert the stage refuses `install.script-wrote-outside-lane`, names the path, and the file does not exist afterward (or was reverted — state which semantics you implemented: prevented via env/cwd isolation, or detected-and-refused with the write left for the operator to see; prevention is better, detection is the floor; implement BOTH if the env isolation cannot guarantee prevention).

Census + trust: new refusal code moves the census → regenerate census and trust in-unit (declared `vp pack` first only if dist is stale by mtime). Freeze composite `27741d9c` stable; proven 11; sealed evidence untouched.

Read first: T999 note (the security finding section), `install.ts` (the spawn site and env handling), `intervention-count.ts` (snapshot set), `ls -la .git/hooks/` and `head -3` of each hook.

Budget: 30 minutes. (1)+(2) by minute 12; (3) by minute 15; (4)+regeneration+verify from minute 15. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what remains — not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/test/**`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`
- `.git/hooks/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not delete any `.sample` hook file, and do not delete a hook that does not reference husky without reporting it first. Why: the authorization is for the husky residue specifically.
- Do not touch `.versionless/work/react-mycrypto/**`. Why: it is an acquired work area whose state is already recorded as evidence; the residue in `.git/hooks` is the target.
- Do not weaken the sandbox to make a real app install (e.g. whitelisting home writes). Why: the boundary IS the deliverable; if a legitimate package needs a home write, that is a named refusal the fleet summary counts.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: standing rule.
- Do not hand-edit anything under `evidence/`. Do not run `vp fmt` repo-wide. Why: emitted artifacts; 249 files.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
node -e "const r=require('./evidence/trust/current/coverage-report.json');if(r.totals.proven!==11)throw new Error('proven '+r.totals.proven);console.log('COVERAGE proven=11')"
test ! -f .git/hooks/husky.local.sh && echo HUSKY-RESIDUE-GONE
node -e "const fs=require('fs');const left=fs.readdirSync('.git/hooks').filter(n=>!n.endsWith('.sample'));if(left.length)throw new Error('non-sample hooks remain: '+left.join(','));console.log('HOOKS-SAMPLE-ONLY')"
git diff --quiet HEAD -- evidence/runs/witness-*/receipt.json evidence/dependencies/ && echo SEALED-EVIDENCE-UNTOUCHED
```

`npm test` takes ~150s; green baseline is 2708/2708 (+2 skipped) plus your additions. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: a non-husky hook exists (report it, delete nothing beyond the authorized set); the sandbox cannot be enforced on this host without a container (then detection-and-refusal is the floor — say so); a sealed number / freeze composite / proven 11 moves; or a verify command fails for a cause outside your contract.