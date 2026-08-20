# Angular 13 cell — pigallery2 compile probe (T009a)

`pigallery2-compile.json` (schema `versionless.angular-13cell-compile.v1`) is the
measured answer to the two open questions Spike A left hanging in
`evidence/spikes/ngcc-1213-feasibility/verdict.json`.

## Headline

| Question | Answer |
|---|---|
| Where does the ngcc `-p module main` override live in a real cell? | **Nowhere — it is not needed.** The Angular CLI passes webpack's `resolve.mainFields` (`es2015, browser, module, main`) to ngcc as `--properties`, and that order already prefers `module` over `main`. The spike's hand-typed `-p module main` was reproducing the CLI default, not deviating from it. |
| Does pigallery2 1.7.0's own source AOT-compile at the honest cell? | **Yes** — Angular 13.4.0 / Node v16.20.2 / rxjs 6.6.7, `ngc` exit 0, **0 diagnostics**, 121 emitted JS files — after **3** mechanical single-line source edits, each named verbatim by the diagnostic that demanded it. |

Two findings worth carrying forward:

- **A fourth legacy library.** The sealed holdout receipt names three no-successor
  pre-Ivy libraries. This closure has four: `@ngx-translate/i18n-polyfill@1.0.0` is
  also ViewEngine and also needs ngcc. It is consumable, but it was invisible until
  the whole application closure was installed rather than a 3-import probe.
- **Diagnostic counts are not monotonic.** Clearing the TypeScript layer *raised* the
  count from 2 to 13, because TS diagnostics gate before Angular's semantic ones — the
  behaviour the sealed receipt predicted. Twelve of those thirteen were cascade from a
  single undecorated abstract base class.

## Recipe files

The work area is unversioned scratch; these are the files that constitute the recipe,
all under `.versionless/work/angular-pigallery2/13cell/`:

| File | Role |
|---|---|
| `package.json` | the cell manifest — Angular 13.4.0, CLI/devkit 13.3.11, rxjs 6.6.7, TypeScript 4.6.4, the four legacy libraries, and the Angular-13-era repins of `ngx-bootstrap` / `ngx-toastr` / `ngx-clipboard` |
| `package-lock.json` | the resolved closure the `cell` block of the JSON is read from |
| `.npmrc` | `legacy-peer-deps=true` — required only by `@ngx-translate/i18n-polyfill@1.0.0`'s stale `^7.0.0` peer |
| `tsconfig.13cell.json` | the AOT tsconfig; only two deltas from pigallery2's own (`target` es5→es2017, `module` es2015→es2020), everything else preserved so this measures the app and not a stricter cell |
| `tsconfig.13cell.strict.json` | the secondary `fullTemplateTypeCheck: true` reading — **not** the cell claim |
| `ngcc.config.js.held` | the project-root override, **committed disabled**. Kept as the counterfactual: `ngcc_processor.js` does read `<projectRoot>/ngcc.config.js`, so this is the right home if an override is ever needed — for this closure it is not, and leaving it live would have it pretending to be load-bearing |
| `frontend/`, `common/` | pigallery2 1.7.0 source, copied verbatim from the baseline, plus the 3 recorded edits |
| `logs/` | every run's raw output: `npm-install.log`, `ngcc-cli-control.log`, `ngcc-cli-run2.log`, `ngc-aot-run1..4.log`, `ngc-aot-strict.log` |

Runtime: `.versionless/cache/angular-13-cell-runtime/node-v16.20.2-darwin-arm64`
(sha256 `6a5c4108…ea88c`), **copied from the already-cached
`angular-jira-clone-runtime`** — no download was performed.

## Reproduce

```sh
export PATH="$PWD/.versionless/cache/angular-13-cell-runtime/node-v16.20.2-darwin-arm64/bin:$PATH"
cd .versionless/work/angular-pigallery2/13cell
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=VL-LEGACY-CORPUS-2026-08-10 npm ci
node node_modules/@angular/compiler-cli/bundles/ngcc/main-ngcc.js \
  --source node_modules --properties es2015 browser module main \
  --first-only --create-ivy-entry-points --async \
  --tsconfig tsconfig.13cell.json --use-program-dependencies
node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.13cell.json   # exit 0
```

The ngcc argv above is not invented — it is reproduced verbatim from
`@ngtools/webpack/src/ngcc_processor.js:118-130`, which is what the CLI itself spawns.

Integrity:

```sh
node -e "const c=require('crypto'),r=require('./evidence/runs/angular-13cell/pigallery2-compile.json');delete r.integrity;console.log(c.createHash('sha256').update(JSON.stringify(r)).digest('hex'))"
# 3508bd8c396e9ac8306d49cb0b4c7e9f0ac31f30d6b5fffe29d242450ec4c4c8
```

## What this does not establish

Read `notEstablished` in the JSON — it is the binding list. In short: this is
**compile-at-cell only**. Not a migration (the three edits were made by hand as a
measurement of what a migration would have to do), not runtime behaviour (nothing was
bundled or executed), not the witness, not a full `ng build`, not the test or backend
closures. The sealed pigallery2 RED at the Angular 16 cell is untouched and unweakened,
and no `packages/**` file was read into or written by this unit.
