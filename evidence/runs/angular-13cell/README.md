# Angular 13 cell — pigallery2

Five records, in order. **T009a** (`pigallery2-compile.json`) established that the app
*compiles* at the cell. **T009b** (`pigallery2-lanes.json`) established that both ends of
the migration *build reproducibly*. **T009c** (`pigallery2-witness-parity.json`) served
both lanes to real Chromium on loopback and compared what they measured — and found the
ceiling: pigallery2's `index.html` is an Express EJS template, so with no backend nothing
past the loading shell can be reached at all. **T009d**
(`pigallery2-live-witness.json`) stood that backend up and caught the migrated lane dying
on `ReferenceError: $localize is not defined` before bootstrap. **T009e**
(`pigallery2-live-witness-2.json`) applied the standard `ng add @angular/localize` fix,
rebuilt, and re-witnessed: the defect is closed, a second i18n defect sits behind it, and
the parity flag went **green on a lane that still does not work**.

> **If you read only one number in this directory, do not let it be
> `pigallery2-live-witness-2.json` → `parity.identical: true`.** It is true, and the
> Angular 13 lane is broken. See T009e below.

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


---

## T009c — the witness, and what a static serve can reach

`pigallery2-witness-parity.json` (schema `versionless.angular-13cell-witness-parity.v1`,
sha256 `2941b0b4…78cb6a`) is T009b's named next unit: serve one artefact from each lane
and compare observed browser behaviour.

Both lanes were witnessed through the real CLI in **one serialized invocation** — the
synthesized-witness path, real Chromium from the host Playwright install, one lane at a
time and one journey at a time:

```sh
node --experimental-strip-types packages/cli/src/cli.ts witness:real-app \
  --app pigallery2 --framework angular \
  --baseline <repo>/.versionless/work/angular-pigallery2/baseline/t009b-baseline-run1 \
  --migrated <repo>/.versionless/work/angular-pigallery2/13cell/t009b-migrated-run1 \
  --out <repo>/evidence/runs/witness-synthesized/angular-pigallery2-v1-7-0
# {"result":"pass","journeySource":"synthesized-crawl","overridden":false,
#  "replayabilityRatio":1,"digest":"4c4b58ae76…"}
```

`selection.reason` is `no-hand-authored-driver-registered` with `registeredDriver: null`
— measured, not asserted: there is no `pigallery2-run.ts` in `packages/cli/src/witness/`,
so the synthesized path is the default here and no `--journeys` override was passed.
pigallery2 1.7.0 ships no Cypress and no Playwright suite, so the fallback fired and the
journey was derived by a bounded crawl.

**Like-for-like is structural, not a discipline.** `runSynthesizedWitnessRealApp` derives
the journey *once*, from the first declared lane, and replays that same emission against
every lane, under `CRAWL_DEFAULT_BOUNDS` (depth 2, 12 routes, 5 s) that the CLI exposes
no override for. Both lanes therefore ran the identical journey.

### The result

| | baseline (ng 8) | migrated (ng 13) |
|---|---|---|
| journeySource | `synthesized-crawl` | `synthesized-crawl` |
| journeys run | 1 | 1 |
| routes declared / reached | 3 / 1 | 3 / 1 |
| selectors present | 0 of 0 | 0 of 0 |
| `successfulNonLoopback` | **0** | **0** |
| lane semantic digest | `b6b7cdec…` | `1b995322…` |

Six outcome strings per lane, **identical string for string and in the same order**, all
in the closed measured-pins vocabulary, no pass verb anywhere:

```
journey-measured-declared-gesture-count-0
journey-measured-unhandled-construct-count-0
journey-synthesized-by-crawl-bounded-depth-2-reached-1-routes
journey-measured-route-reached-1-of-3-declared-routes
journey-measured-selector-present-0-of-0-declared-selectors
journey-measured-no-document-overflow-on-1-routes
```

The lane semantic digests differ because they hash the content-hashed asset filenames,
which T009b already inventoried as differing. No outcome differs.

### The finding: `index.html` is a server template, not a document

Read this before reading `identical: true` as good news.

Both lanes' `index.html` carry, verbatim and unrendered, `<base href="<%= clientConfig.urlBase %>/">`
and an inline `var ServerInject = {user: <%- JSON.stringify(user); %>, …}`. These are EJS
expressions — pigallery2 renders `index.html` through its **Express backend** at request
time, and the Angular CLI copies the template through the build untouched at *both* eras.

Served statically, Chromium resolves `document.baseURI` to
`http://127.0.0.1:<port>/%3C%=%20clientConfig.urlBase%20%%3E/`, so every relative bundle
URL resolves under a prefix that does not exist. Measured on both lanes: `runtime`,
`polyfills`, `main` and the stylesheet all **400**. The inline script is not valid
JavaScript with the EJS unrendered, and Chromium raised, verbatim on both lanes:

```
SyntaxError: Unexpected token '<'
```

**The Angular application never bootstrapped on either lane.** What was measured is the
static loading shell the template ships — `<app-pi-gallery2>` with its one placeholder
child, the icon, and the text `Loading...`.

This is **not** a defect in the generic runner, and it is recorded as not one. The runner
served both lanes: the document is 200 `text/html`, and every asset addressed at its real
path is 200. The 400s are the application asking for a path it expected the *server* to
fill in. The two available repairs — rewriting the built `index.html`, or standing up the
Express backend — are exactly the two moves this unit is forbidden to make, and rightly:
one is hand-editing an emitted artefact, the other is a backend nobody has frozen. A
pigallery2 witness that reaches the gallery needs the existing
`packages/cli/src/witness/live-backend.ts` seam, a frozen media tree and a frozen config.
That is a separate unit.

### Locality, including the part that went wrong

`successfulNonLoopback: 0` is structural, not merely reported:
`packages/cli/src/witness/playwright-host.ts` routes `**/*` and continues a request only
when `isWitnessLoopbackUrl()` holds, fulfilling everything else locally with 204. The two
CDN stylesheets pigallery2's `index.html` links (`cdnjs.cloudflare.com`, `unpkg.com`)
were mocked, not fetched.

Disclosed in the record: the **first** pass of the corroboration probe launched Chromium
through a plain Playwright context instead of the witness host's, and so fetched those
two stylesheets for real, once per lane — **4 non-loopback requests**, after the witness
run had already finished, by a diagnostic that is not the measurement. The probe was
re-run with a 204-fulfilling route and it is that loopback-clean pass whose readings are
published. A locality claim that is only audited when it holds is not audited.

### Reproduce

```sh
# the witness (above), then the read-only corroboration probe:
node --experimental-strip-types .versionless/work/angular-pigallery2/logs/t009c-shell-probe.mjs \
  <repo>/.versionless/work/angular-pigallery2/baseline/t009b-baseline-run1 \
  <repo>/.versionless/work/angular-pigallery2/13cell/t009b-migrated-run1

# the parity record is emitted, never hand-edited:
T009C_HEAD=$(git rev-parse HEAD) node .versionless/work/angular-pigallery2/logs/t009c-emit-parity.cjs
```

Integrity:

```sh
node -e "const c=require('crypto'),r=require('./evidence/runs/angular-13cell/pigallery2-witness-parity.json');delete r.integrity;console.log(c.createHash('sha256').update(JSON.stringify(r)).digest('hex'))"
# 2941b0b43646b81ba8c8bc75fa628736d9af6850c21268e7917d325d0378cb6a
```

### What T009c does not establish

`notEstablished` in the JSON is the binding list. In short: **nothing here is about the
gallery.** No line of pigallery2 executed. `parity.identical: true` means the two lanes
measured the same *on the surfaces reached*, and the surfaces reached are the static
loading shell — not login, listing, thumbnailing, search, sharing or settings, all of
which need the Express backend this unit did not start and was forbidden to stub. The
journey was synthesized by a crawl nobody authored; one journey, one pass, one host, so
no determinism claim and no concurrency claim. No screenshots, no pixels, no
accessibility or performance reading. T009b's build claims are carried by reference, not
re-established: the lane outputs were consumed as-is and never rebuilt or edited. No
`packages/**` file was written by this unit.

**Next unit:** T010, the freeze supersession. It inherits a parity claim that is real but
shallow, plus one named finding — any pigallery2 claim past the loading shell needs the
live-backend seam, not another static serve.

---

## T009d — pigallery2 on its own live backend: the two lanes are **not** the same

`pigallery2-live-witness.json` · schema `versionless.angular-13cell-live-witness.v1` ·
sha256 `b2318d0a42f51bcd4fba43c94907d0a2a8c2ea20fcc354c51fa29e583b41fa12`

T009c named the seam and this unit walked through it. pigallery2's **own Express
backend** — `backend/index.js`, copied byte-for-byte out of the frozen baseline checkout
and run at its **era Node v10.24.1** (x64 under Rosetta; the Node-16 fallback the packet
allowed was never needed) — was stood up on `127.0.0.1:32701`, pointed at one built lane
at a time, and witnessed in real Chromium through the pipeline's witness host.
`successfulNonLoopback: 0` on both lanes, structurally.

**The answer is no, and the reason is a real migration defect.**

| | baseline (Angular 8.1.2) | migrated (Angular 13.4.0) |
|---|---|---|
| bundles served | all 200 | all 200 |
| `ServerInject` rendered | yes | yes |
| application bootstrapped | **yes** | **no** |
| route it settled on | `/gallery/` (its own redirect) | `/` (it never navigated) |
| API calls made | `GET /api/notifications`, `GET /api/gallery/content/` — both 200 | **none** |
| gallery grid | `app-gallery-grid` with **3** `app-gallery-grid-photo` tiles, text "3 Images / 3 items" | absent, `<app-pi-gallery2>` empty, no visible text |

Chromium's verbatim console error on the migrated lane:

```
ERROR Error: Uncaught (in promise): ReferenceError: $localize is not defined
ReferenceError: $localize is not defined
    at consts (http://127.0.0.1:32701/main.4b2fa472bc230245.js:1:241772)
```

The Angular 13 build emits `$localize`-tagged i18n constants and the lane loads no
`@angular/localize` polyfill; the Angular 8 lane never needed one because its build
substituted translations at compile time. **Nothing was repaired** — rebuilding or
hand-editing an emitted lane is a separate unit.

Read the two differing outcome strings the right way round: the migrated lane's *higher*
`route-reached-1-of-3` is the *worse* lane. The baseline lane scores 0 because the
running application routed itself off the declared `/`; the migrated lane "reached" `/`
only by never leaving it.

**Why the earlier units could not see this.** T009b measured that both lanes build, twice,
byte-identically — and a build that emits `$localize` calls and omits its polyfill is a
perfectly deterministic build. T009c measured a static serve in which *neither* lane
bootstrapped, and two lanes that both fail to start look identical. It took the live
backend for the lanes to differ, because it took the live backend for either of them to
run at all. T009c's `parity.identical: true` is hereby **superseded** as a claim about
behaviour; its finding and its `notEstablished` stand unchanged.

### Media

Three 64×48 solid-colour PNGs, **generated locally** by
`.versionless/work/angular-pigallery2/logs/t009d-gen-media.cjs` (zlib + a hand-written
CRC32, no image library, nothing fetched), identical for both lanes. The backend really
indexed them: `GET /api/gallery/content/` returned `mediaCount: 3` with exactly those
names.

### The seam, operated rather than extended

`witness:real-app --journeys synthesized` takes lane **directories** and serves them
itself; the live-backend path (`AppSpec.backend` → `packages/cli/src/witness/live-backend.ts`)
is reachable only from a registered AppSpec whose name is in the closed
`WITNESS_REAL_APP_STATEFUL_NAMES` / `WITNESS_REAL_APP_PROJECTED_HOLDOUT_NAMES` lists.
Admitting pigallery2 there is a `packages/**` change this unit was forbidden to make, so
the crawl reader, the outcome vocabulary, the emitter and the Playwright witness host
were **imported and driven unchanged** against the live origin. No `packages/**` file was
written.

### Reproduce

```sh
node .versionless/work/angular-pigallery2/logs/t009d-gen-media.cjs <repo>/.versionless/work/angular-pigallery2/serve/media
sh .versionless/work/angular-pigallery2/logs/t009d-backend.sh setup baseline <repo>/.versionless/work/angular-pigallery2/baseline/t009b-baseline-run1
sh .versionless/work/angular-pigallery2/logs/t009d-backend.sh start baseline
node --experimental-strip-types .versionless/work/angular-pigallery2/logs/t009d-live-witness.mjs \
  baseline http://127.0.0.1:32701 <logs>/t009d-plan.json derive <logs>/t009d-lane-baseline.json
sh .versionless/work/angular-pigallery2/logs/t009d-backend.sh stop baseline
# ... then the same three steps for `migrated`, with `replay` instead of `derive`
T009D_HEAD=$(git rev-parse HEAD) node .versionless/work/angular-pigallery2/logs/t009d-emit-live-witness.cjs
```

One lane at a time; the backend is stopped (and any survivor `pkill`ed) between lanes,
because a stale process holding the port would serve the wrong lane and mask exactly the
difference this unit found. Each lane's served `main.*.js` filename was checked against
that lane's build before witnessing it.

### What T009d does not establish

`notEstablished` in the JSON is the binding list. In short: a **three-image generated
gallery is not the fleet's media diversity** — no EXIF, GPS, faces, video, sidecars or
nested directories, so nothing here speaks about metadata, map, person or transcoding
surfaces. **Auth was off** (`authenticationRequired: false`, unauthenticated role Admin),
so login, sessions and every role boundary are untested. The database was the
**in-memory** backend, not SQLite — identical on both lanes, so it cannot explain the lane
difference, but the application itself disabled search, sharing and faces and said so in
two "Server error" notices. The baseline lane is **not certified working**: it mounts,
routes, calls its API and renders three tiles; `photoImages` is 0, so no thumbnail is
claimed to have loaded, and nothing was clicked. The migrated lane's defect is **named,
not diagnosed to its root** — no build with the polyfill was attempted. One journey, one
pass, one host; no screenshots, pixels, accessibility or performance readings. Both lanes
ran the **era backend**: nothing here speaks about a migrated backend, which does not exist.

**Next unit:** T010, the freeze supersession — now inheriting a live-backend parity claim
that is real and **negative**.

---

## T009e — the standard fix closes the defect, and the lane still does not work

`pigallery2-live-witness-2.json` · schema `versionless.angular-13cell-live-witness.v1` ·
sha256 `717bd47da4e19f8a93c95f49420ec3fa113f36b5b605ccd89e1803a767d8d6ea`

T009d closed with an explicit open question in its own `notEstablished`: *"it does not
establish that adding `@angular/localize/init` is sufficient to make the lane work,
because that build was not attempted here."* This unit attempts exactly that build —
nothing more — and re-witnesses **both** lanes against the same era backend in the same
session, so the baseline reading is fresh rather than carried over.

### The fix: migration-delta item 8

Applied by the **canonical CLI path**, not a hand edit — Angular CLI 13.3.11 in the cell
offered `ng add` and ran its own schematic:

```sh
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=VL-LEGACY-CORPUS-2026-08-10 \
  node node_modules/.bin/ng add @angular/localize@13.4.0 --skip-confirmation
```

The schematic changed exactly two files (diffed against a pre-run snapshot;
`angular.json` and `tsconfig.13cell.build.json` are byte-identical to before):

1. `package.json` devDependencies — `+ "@angular/localize": "^13.4.0"`, resolved to
   exactly **13.4.0**.
2. `frontend/polyfills.ts` — `+ import '@angular/localize/init';` at the top.

The lock delta is **additive only**: `@angular/localize` plus five transitive additions,
nothing removed, no existing pin moved (Angular still 13.4.0, CLI 13.3.11, rxjs 6.6.7,
TypeScript 4.6.4). That one npm fetch is the only network access this unit made.

**Why this step exists.** Angular 9 moved template i18n from a compile-time ViewEngine
transform to a *runtime* tagged-template function named `$localize`. From v9 on the AOT
compiler emits `` $localize`…` `` constants into the `consts` of any component carrying
i18n attributes — whether or not the app ever translates anything. `@angular/core` does
not define the tag; only importing `@angular/localize/init` before bootstrap installs it
onto the global scope.

### The rebuild: the application did not change at all

Two runs of T009b's exact command, byte-compared. **13/13 files identical**, same webpack
hash `365f7a87a2b00d00` (was `d2bb139c5bbeebb0`). Determinism survived the fix.

The headline is the hash that *didn't* move:

| artefact | before (T009b) | after (T009e) |
|---|---|---|
| `main.*.js` | `main.4b2fa472bc230245.js` | **same name, same sha256** `aa66f5cc…2d04f` |
| `polyfills.*.js` | `polyfills.907de136ddb20602.js` | `polyfills.5e5c92c3fb2e7264.js` |
| `$localize` in `main.js` | 215 occurrences | **215 occurrences** |
| `$localize` in `polyfills.js` | 0 | **2** — including `a.$localize=u`, the global assignment |

Not one byte of the application changed. The 215 references in `main.js` are *correct*,
not leftovers: the compiler emits the tag, the polyfill defines it. The first emitted tag
sits at `main.…js` offset **241780**, inside the `app-login` component's `consts` — within
eight bytes of the column `241772` T009d's `ReferenceError` named. The catch and the fix
point at the same place in the same bundle.

### The re-witness: same recipe, fresh readings for both lanes

Same era Node v10.24.1 backend on `127.0.0.1:32701`, same three generated PNGs
(sha256-verified, not regenerated), same driver — `t009d-live-witness.mjs` **reused
byte-for-byte**, since it takes every path as an argument. `successfulNonLoopback: 0` on
both lanes, structurally. The baseline pass **reproduced T009d exactly** (same six outcome
strings, same surface, `/gallery/`, three photo tiles, both API calls 200), which is what
makes any change in the migrated lane attributable to the rebuild.

| | baseline (Angular 8.1.2) | migrated (Angular 13.4.0, fixed) |
|---|---|---|
| `$localize` error | — | **gone** |
| application bootstrapped | yes | **yes** (was *no*) |
| route it settled on | `/gallery/` | **`/login`** (was `/`) |
| API calls made | `/api/notifications`, `/api/gallery/content/` — 200 | **none** |
| gallery / grid / navbar | present | absent |
| photo tiles | **3** | **0** |
| visible text | "3 Images / 3 items" … | **empty** |

**Defect one is closed.** `"$localize is not defined"` appears nowhere in the migrated
lane's console this session, and the lane's router now navigates — which it cannot do
unless the module bootstrapped.

**Defect two is behind it.** Chromium's verbatim console error, truncation and all:

```
ERROR Error: Uncaught (in promise): Error: Cannot find module './messages.en-US.xlf'
Error: Cannot find module './messages.en-US.xlf'
    at U (http://127.0.0.1:32701/main.4b2fa472bc230245.js:1:271)
    at I (http://127.0.0.1:32701/main.4b2fa472bc230245.js:1:220)
    at Object.c7 [as useFactory] (ht
```

It comes from the application's own `translationsFactory`
(`app.module.ts:114-123`, wired as `{provide: TRANSLATIONS, useFactory: …, deps: [LOCALE_ID]}`):

```ts
locale = locale || 'en';
if (locale === 'en') { return ''; }
return require(`raw-loader!../translate/messages.${locale}.xlf`);
```

The guard is an **exact string test against `'en'`**. On the baseline lane `LOCALE_ID`
really is `en`, because the era build was invoked with `--i18n-locale en` — the factory
short-circuits and nothing is ever required. Angular 13 has **no `--i18n-locale` flag**
(T009b already recorded the four `--i18n-*` flags as dropped with no v13 equivalent), so
`LOCALE_ID` falls back to Angular's default `'en-US'`, the guard misses, and webpack's
require-context throws for a file that does not exist — `frontend/translate/` holds
`en`, `fr`, `hu`, `ru` and no `en-US`.

Both defects are the same family: the Angular 9+ i18n rearchitecture arriving late. The
first is the runtime tag the new compiler emits and no longer defines for you; the second
is a locale the old CLI used to set for you and the new one does not. T009b watched those
flags disappear at build time; this is where that delta becomes a runtime failure.

**Nothing further was repaired.** The packet permits exactly the two edits above, because
the claim under test is that the *standard* step closes the defect. Setting `LOCALE_ID`,
adding `messages.en-US.xlf`, or widening the guard are application changes and a
different claim for a different unit — and none of them is established here.

### The trap: `parity.identical` went **true** while the lane stayed broken

Carry this further than the pigallery2 result. In T009d the migrated lane never
navigated, so it "reached" the declared route `/` and scored `route-reached-1-of-3`
against the baseline's `0` — that mismatch is what made `identical: false`. In T009e the
migrated lane bootstraps and routes itself to `/login`, so it *leaves* `/` exactly as the
baseline leaves `/` for `/gallery/`, and scores `0` too. **All six outcome strings now
match, string for string.**

The outcome vocabulary counts route *departures*. It cannot see where either lane went,
and it cannot see that one arrived at a gallery with three photo tiles while the other
arrived at a login screen that rendered nothing at all. Both lanes also report
`pageErrors: []`, because the migrated failure is a caught-and-logged Angular `ERROR`, not
an uncaught page error.

Anything downstream that prices a pigallery2 claim on `parity.identical` alone would price
this lane **green**. Read `lanes.*.runningApplication` and
`parity.applicationSurfaceCompared.apiCallsMade` instead.

### Reproduce

```sh
export PATH=<repo>/.versionless/cache/angular-13-cell-runtime/node-v16.20.2-darwin-arm64/bin:$PATH
cd <repo>/.versionless/work/angular-pigallery2/13cell
VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=VL-LEGACY-CORPUS-2026-08-10 \
  node node_modules/.bin/ng add @angular/localize@13.4.0 --skip-confirmation
sh <repo>/.versionless/work/angular-pigallery2/logs/t009e-migrated-build.sh   # 2 builds, byte-compared

cd <repo>
sh .versionless/work/angular-pigallery2/logs/t009e-backend.sh setup baseline <repo>/.versionless/work/angular-pigallery2/baseline/t009b-baseline-run1
sh .versionless/work/angular-pigallery2/logs/t009e-backend.sh start baseline
node --experimental-strip-types .versionless/work/angular-pigallery2/logs/t009d-live-witness.mjs \
  baseline http://127.0.0.1:32701 <logs>/t009e-plan.json derive <logs>/t009e-lane-baseline.json
sh .versionless/work/angular-pigallery2/logs/t009e-backend.sh stop baseline
# ... then the same three steps for `migrated` (dist → t009e-migrated-run1), with `replay`
T009E_HEAD=$(git rev-parse HEAD) node .versionless/work/angular-pigallery2/logs/t009e-emit-live-witness.cjs
```

`t009e-backend.sh` is `t009d-backend.sh` with **exactly two path substitutions** — serve
roots become `serve/e-<lane>` and the log becomes `t009e-backend-<lane>.log` — so T009d's
own artefacts are left untouched. `diff` the two scripts to see that and nothing else.

Integrity:

```sh
node -e "const c=require('crypto'),r=require('./evidence/runs/angular-13cell/pigallery2-live-witness-2.json');delete r.integrity;console.log(c.createHash('sha256').update(JSON.stringify(r)).digest('hex'))"
# 717bd47da4e19f8a93c95f49420ec3fa113f36b5b605ccd89e1803a767d8d6ea
```

### What T009e does not establish

`notEstablished` in the JSON is the binding list. In short: **the migrated lane is not
fixed** — one named defect is closed, and the record establishes the *opposite* of a
working lane (no gallery, no navbar, no grid, zero tiles, zero API calls, empty text).
The second defect is **diagnosed from the verbatim error and the application source, not
from a fix**: no build was made with a corrected locale, so it is not established that
setting `LOCALE_ID` to `en` makes the lane work, or that a *third* defect does not sit
behind the second — T009d named the mirror image of exactly this caution, and it applies
here. Why the lane lands on `/login` rather than `/gallery/` is recorded as measured, not
explained. The console messages are truncated at 300 characters by the reused driver, so
the full stack was never captured. Everything T009d disclaims still holds: three
generated PNGs are not media diversity, auth is off, the database is in-memory, one
journey and one pass per lane, no screenshots or pixels, era backend on both lanes.
T009d's record is **not superseded and was not edited** — this unit changed the build, so
it reports on a different artefact. No `packages/**` file was written.

**Next unit:** T010, the freeze supersession, inheriting a live-backend parity claim that
is numerically **green** and substantively **negative** — and the harder lesson that
`parity.identical` proved able to read `true` across one working and one broken lane.
