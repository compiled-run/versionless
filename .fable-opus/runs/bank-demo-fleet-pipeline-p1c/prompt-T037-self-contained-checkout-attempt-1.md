Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T037-self-contained-checkout
Fable-Opus-Timeout-Minutes: 30

## Goal

Make a fresh clone of this repository able to pass the zero-intervention gate. The final audit (T999, `docs/goals/bank-demo-fleet-pipeline/notes/T999-final-audit.md` — read its root-cause section first) re-ran the T008 gate in a clean `git worktree` at `18c1e80` and it **failed reproducibly**: `interventionCount 2` then `3`, `terminalClassification defect:witness`. Stages 1–8 ran; witness died. Five causes, all in the machinery, none in the app:

**(a) Witness browser from a fixture cache.** `packages/cli/src/witness/real-app-run.ts:250-253` launches Chromium from `.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell` — gitignored, fixture-named, arm64-only; `grep -rl chromium_headless_shell-1208 packages/` → 21 files. Fix: resolve the browser from a host-provisioned Playwright install (playwright's own browser cache via its API — `chromium.executablePath()` or the `PLAYWRIGHT_BROWSERS_PATH` convention — or a declared `--browser-path`); a missing browser is a NAMED refusal `witness.browser-not-provisioned` (stage `witness`, origin `pipeline`, message naming what was looked for and how to provision), never a defect and never a silent fixture fallback. The 18 hand-authored `*-run.ts` drivers stay byte-untouched EXCEPT for the shared browser-resolution helper they import — if they inline the literal, change only that line and say so; their sealed evidence must not change (they are not re-run here).

**(b) Trust verify crashes in a tree without the work dir.** `packages/core/src/enterprise/script-surface.ts:578` (`scanStaticEntrypoint`) → `packages/trust/src/verify.ts:215` ENOENT on `.versionless/work/react-boilerplate-v4/legacy/build/index.html`, killing `trust:verify`, `report:coverage --verify-only`, `supported-matrix` in a clean checkout. Fix: the check reads a committed artifact (the script-surface record already carries what it observed — verify against that) or refuses by name (`trust.script-surface-source-absent`) instead of throwing ENOENT. Then either Spike B's "offline verify passes with the work dir absent" becomes TRUE again, or you record it refuted with the reason. Say which.

**(c) Not self-contained.** `package.json:24` — `"@async/witness": "link:../witness"`, an unpublished sibling repo (`/Users/jacksm5pro/dev/open-source/witness`, `@async/witness@0.8.0`, HEAD `83b86de`). Fix: `cd ../witness && pnpm pack` → move the tarball to `vendor/async-witness-0.8.0.tgz` in THIS repo, change the dependency to `"file:vendor/async-witness-0.8.0.tgz"`, regenerate `pnpm-lock.yaml`, and record the source SHA `83b86de` in `vendor/README.md` (one line: package, version, source path, commit, date, "swap for a published version when available"). `pnpm install --frozen-lockfile` in a fresh worktree must yield a runnable tree.

**(d) Counter idempotence.** The harness's own prior receipt dirs (`.versionless/stage/witness-real-app/witness-receipts/**`, plus `latest`) are its own write set — a second run must not count the first run's outputs as mutations. Add them to the declared write set in `packages/cli/src/operator/intervention-count.ts` (and any other pipeline-owned stage dir the run writes). Prove: two consecutive runs → identical `interventionCount`.

**(e) Port-independent witness digest.** The synthesized journey name carries the ephemeral loopback port (`bounded crawl of http://127.0.0.1:51404 to depth 2`), so `integrity.canonicalDigest` changes every run — a parity digest that changes every run cannot establish parity. Name journeys by what they measure (e.g. `bounded crawl of the served lane to depth 2`) and keep the port in a non-digested field. Prove: two runs → identical `canonicalDigest` and `semanticDigest`.

Then regenerate census/trust in-unit as needed (declared dist pack first only if stale; new refusal codes move the census).

**The proof, in a clean worktree** — this is the verify command that matters, and it is stated in advance: `git worktree add <tmp> HEAD` → `pnpm install --frozen-lockfile` → `VERSIONLESS_NETWORK_MODE=consented acquire pawelmalak/flame --ref v2.4.0 --id react-flame-v2-4-0-clean --consent VL-LEGACY-CORPUS-2026-08-10` → `intervention-count <that baseline> --out <tmp> --record <tmp>/rr.json --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts` (env UNSET for the harness) → **`interventionCount 0`** and classification `proven` or `refused:<code>` (a named `witness.browser-not-provisioned` refusal is an honest pass of the command half if the host has no browser; `proven` if it does — say which you got and why). Then `trust:verify --offline` valid in that worktree.

Read first: T999 note §"decisive finding" and its evidence lines; `real-app-run.ts:240-260`; `script-surface.ts:570-590`; `verify.ts:210-220`; `intervention-count.ts` write-set; `journey-synthesis/emit.ts` (journey naming).

Budget: 30 minutes. (a)+(c) by minute 10; (b)+(d)+(e) by minute 18; clean-worktree proof from minute 18. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, land what you have and return `blocked` naming what remains — not `partial`.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/operator/**`
- `packages/core/src/enterprise/**`
- `packages/trust/src/verify.ts`
- `packages/trust/src/generate.ts`
- `package.json`
- `pnpm-lock.yaml`
- `vendor/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `packages/trust/test/**`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not fall back to the fixture browser path silently, and do not re-run any sealed per-app witness driver. Why: a fixture fallback IS the misfire; sealed evidence must not change.
- Do not publish `@async/witness` anywhere. Why: vendoring a tarball is reversible and needs no account; publishing is the owner's decision.
- Do not touch `.git/hooks`. Why: T036's territory and it needs the owner's explicit go.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean` in the project tree.** Why: standing rule. (Creating and removing your own temp worktree is fine.)
- Do not set `VERSIONLESS_NETWORK_MODE=offline` on the harness. Why: install must reach the registry.
- Do not hand-edit anything under `evidence/`. Do not run `vp fmt` repo-wide. Why: emitted artifacts; 249 files.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
test -z "$(grep -rl chromium_headless_shell-1208 packages/cli/src/operator packages/cli/src/witness/real-app-run.ts packages/cli/src/witness/journey-synthesis 2>/dev/null)" && echo NO-FIXTURE-BROWSER-LITERAL-IN-GENERIC-PATH
grep -q '"@async/witness": "file:vendor/' package.json && test -f vendor/async-witness-0.8.0.tgz && echo WITNESS-VENDORED
W="$(mktemp -d)/vl-clean"; git worktree add "$W" HEAD >/dev/null 2>&1 && (cd "$W" && pnpm install --frozen-lockfile >/dev/null 2>&1 && VERSIONLESS_NETWORK_MODE=consented node --experimental-strip-types packages/cli/src/cli.ts acquire pawelmalak/flame --ref v2.4.0 --id react-flame-v2-4-0-clean --consent VL-LEGACY-CORPUS-2026-08-10 --json >/dev/null && node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0-clean/baseline --out "$W/.lane" --record "$W/.rr.json" --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts > "$W/.ic1.json"; node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0-clean/baseline --out "$W/.lane2" --record "$W/.rr2.json" --json --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts > "$W/.ic2.json"; node -e "const a=require('$W/.ic1.json'),b=require('$W/.ic2.json');if(a.interventionCount!==0)throw new Error('clean count '+a.interventionCount+' '+JSON.stringify(a.mutatedPathsOutsideWriteSet));if(!/^(proven|refused:)/.test(a.terminalClassification))throw new Error('clean class '+a.terminalClassification);if(b.interventionCount!==a.interventionCount)throw new Error('non-idempotent '+a.interventionCount+' -> '+b.interventionCount);console.log('CLEAN-CHECKOUT-GATE '+a.terminalClassification+' count '+a.interventionCount+' idempotent')"; npm run trust:verify -- --offline 2>&1 | tail -1 | grep -q '"valid":true' && echo CLEAN-TRUST-VALID); git worktree remove --force "$W"
```

`npm test` takes ~150s; expected green is the full suite (2706 + 2 skipped baseline plus your additions). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the browser cannot be provisioned on this host without a network install the environment forbids (then `witness.browser-not-provisioned` is the honest outcome — say so and still run the gate; that IS a pass of the command half); vendoring `@async/witness` needs a decision the owner has not made; the clean gate still shows `interventionCount > 0` after (a)–(e) (report the mutated paths verbatim and stop); or a verify command fails for a cause outside your contract.
