# Angular 13 cell — pigallery2

Two records, in order. **T009a** (`pigallery2-compile.json`) established that the app
*compiles* at the cell. **T009b** (`pigallery2-lanes.json`) established that both ends of
the migration *build reproducibly*. Neither establishes runtime behaviour or parity.

---

## T009a — compile probe


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

---

## T009b — the lane pair

`pigallery2-lanes.json` (schema `versionless.angular-13cell-lanes.v1`) is the build
reading either side of the migration: pigallery2 1.7.0 at **its own era**, and the same
source at the **13 cell**, each built twice for byte comparison.

### Headline

| | Baseline lane | Migrated lane |
|---|---|---|
| Toolchain | Angular **8.1.2**, CLI 8.1.2, TS 3.4.5, rxjs 6.5.2 | Angular **13.4.0**, CLI 13.3.11, TS 4.6.4, rxjs 6.6.7 |
| Node | **v10.24.1** darwin-**x64**, under Rosetta 2 | **v16.20.2** darwin-**arm64**, native |
| Build command | the gulpfile's own `ng build --aot --prod --no-extract-licenses …` | `ng build --configuration production` |
| Exit codes | 0, 0 | 0, 0 |
| Output | 13 files, **2 806 878** bytes | 13 files, **2 494 670** bytes |
| Double build | **byte-identical** | **byte-identical** |
| Wall clock | 28 s, 29 s | 13 s, 5 s |

**Both lanes exist and both are reproducible.** The era baseline was the risk — the
packet anticipated an x64/Rosetta or node-sass blocker — and it did not fire.
`node-v10.24.1-darwin-x64` runs under Rosetta 2 on this arm64 host, and pigallery2 1.7.0
carries no `node-sass`, so nothing native had to be rebuilt. The later parity claim is
therefore **not** bounded by a missing baseline.

### ngcc: first build processes, second hits the cache

Observable, not inferred. `@ngtools/webpack/src/ngcc_processor.js:86-101` hashes the
lock file, `ngcc.config.js`, and the tsconfig into a sha256 and writes
`node_modules/.cli-ngcc/<hash>.lock` on success; a later build that finds that file
skips the ngcc pass entirely.

| | run 1 | run 2 |
|---|---|---|
| ngcc pass | **ran** — logged the `ng2-slim-loading-bar` deep-import line | **skipped** — no ngcc output at all |
| webpack time | 11 613 ms | 3 637 ms (**3.2×** faster) |
| webpack hash | `d2bb139c5bbeebb0` | `d2bb139c5bbeebb0` (identical) |

The run-hash lock is
`node_modules/.cli-ngcc/d82393e4603621a94e776744ff54fa57f4001f33434c41a920b1f8a8f2d33adf.lock`,
created by run 1. `ngcc.config.js` is *still* not needed — the held counterfactual stays
disabled, and the CLI's `resolve.mainFields` order carried all four legacy libraries
through the bundler stage as well as through `ngc`.

### The migration delta is now seven items, not three

T009a's three app-source edits stand unchanged as items 1–3. T009b adds four, all
configuration, none touching app source:

4. **`angular.json`** — new, derived from pigallery2's own. Exactly two options deleted
   because the v13 browser schema rejects them: `extractCss` (v13 always extracts in
   production) and `aot` (the v13 default, no longer an option).
5. **`tsconfig.13cell.build.json`** — `tsconfig.13cell.json` with `polyfills.ts` added to
   `files`, which the browser builder requires. **No `compilerOption` differs from T009a**,
   so the lane still measures the app, not a stricter cell.
6. **Three dependencies** — `bootstrap@4.3.1` and `open-iconic@1.1.1` (the exact versions
   the app declares; T009a's `notEstablished` flagged both as missing) and
   `raw-loader@4.0.2` (the one real version move: 1.0.0/webpack 4 → 4.0.2/webpack 5).
7. **Flag translation** — `--prod` → `--configuration production`, `--aot` dropped,
   `--no-extract-licenses` moved into `angular.json`, and the four `--i18n-*` flags
   dropped with no replacement.

### The dropped i18n flags cost nothing here — and that is a measured claim

ViewEngine message-bundle i18n has no v13 equivalent without `@angular/localize`, which
this cell does not install. It did not matter: **pigallery2 1.7.0 uses zero Angular
template i18n** — grepping `frontend/app` for the `i18n` attribute returns 0 files and
0 sites. Translation happens entirely at runtime through the
`@ngx-translate/i18n-polyfill` `I18n` service, and its `translationsFactory`
(`app.module.ts:115-123`) short-circuits to `''` for locale `en`. The baseline's i18n
flags were already no-ops for the English build both lanes made.

The consequence is a real gap, recorded as such: the `fr`/`hu`/`ru` builds the gulpfile
also emits were **not** run in either lane, so the `require('raw-loader!…')` path was
never executed. Do not read this record as evidence that `raw-loader@4.0.2` works here.

### Cross-lane numbers — descriptive only, not parity

The migrated bundle is **312 208 bytes smaller (−11.1 %)**. Both lanes emit 13 files, but
not the same 13: the baseline emits `polyfills-es5.js` (71 535 B, gone with v13's removal
of differential loading) and the migrated lane emits `3rdpartylicenses.txt` (35 803 B,
because the baseline explicitly passed `--no-extract-licenses`). `main` shrinks 11.7 %,
`index.html` grows from 1 446 to 3 090 bytes.

**A smaller bundle is not a better bundle and not a working bundle.** Neither artefact was
loaded, served, or executed.

### Reproduce

```sh
# baseline lane
export PATH=<repo>/.versionless/cache/angular-pigallery2-v1-7-0-runtime/node-v10.24.1-darwin-x64/bin:$PATH
cd <repo>/.versionless/work/angular-pigallery2/baseline    # node_modules pre-installed
node node_modules/.bin/ng build --aot  --prod --no-extract-licenses \
  --output-path=./t009b-baseline-run1 --no-progress --no-progress --i18n-locale en \
  --i18n-format=xlf --i18n-file=frontend/translate/messages.en.xlf \
  --i18n-missing-translation warning        # repeat as run2

# migrated lane
export PATH=<repo>/.versionless/cache/angular-13-cell-runtime/node-v16.20.2-darwin-arm64/bin:$PATH
cd <repo>/.versionless/work/angular-pigallery2/13cell
rm -rf node_modules/.cli-ngcc               # to see the ngcc pass rather than the cache hit
node node_modules/.bin/ng build --configuration production --output-path=./t009b-migrated-run1
node node_modules/.bin/ng build --configuration production --output-path=./t009b-migrated-run2

node ../logs/inventory.cjs t009b-migrated-run1 t009b-migrated-run2   # byteIdentical: true
```

The baseline build string is not paraphrased — it is what `gulpfile.js:96-101` composes
for `build-prod`, double space and duplicated `--no-progress` included, with only
`--output-path` swapped so the two runs do not overwrite each other.

Integrity:

```sh
node -e "const c=require('crypto'),r=require('./evidence/runs/angular-13cell/pigallery2-lanes.json');delete r.integrity;console.log(c.createHash('sha256').update(JSON.stringify(r)).digest('hex'))"
# c93051f0b519d68de5d34d37fbfd4e8c859806cf0fac7d4dffa0ee3f0f4a0cdc
```

### What T009b does not establish

Read `notEstablished` in the JSON — it is the binding list. In short: **both lanes build
reproducibly, and that is all.** Not runtime behaviour (not one byte of either bundle was
executed), not parity (the lanes were described side by side, never compared for
behaviour), not the witness, not a migration (all seven delta items were applied by
hand), not the non-English builds, not the test/e2e or backend closures, and not
reproducibility across hosts or cold caches. The sealed pigallery2 RED at the Angular 16
cell stands untouched and unweakened, and no `packages/**` file was read into or written
by this unit.

**Next unit:** the witness — serve one artefact from each lane and compare observed
browser behaviour. That is the unit that can speak about parity; this one cannot.
