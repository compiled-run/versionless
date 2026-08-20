Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u6-locale-id-provider

## Goal

Delta item 9 of the T010 supersession: a new Angular adapter capability that translates an era build's removed `--i18n-locale <value>` into `{provide: LOCALE_ID, useValue: '<value>'}` in the application module's providers. Per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §2 item 9 and §5 u6 — read them first. The tree carries uncommitted Phase B work (u3: 13 cell; u5b: i18n flag rows) — build on it, do not disturb it.

The evidence model (`evidence/runs/angular-13cell/README.md` item 9, `evidence/runs/angular-13cell/pigallery2-live-witness-2.json` and `-3.json`): pigallery2's era build passed `--i18n-locale en`; under ViewEngine that flag set the injector's `LOCALE_ID`; the app's own `TRANSLATIONS` provider declares `deps: [LOCALE_ID]`; after the 13 hop nothing set it, dates/pipes fell back wrong, and the fix measured in the live witness was `{provide: LOCALE_ID, useValue: 'en'}` in `app.module.ts` providers. The value `en` was NOT invented — it was read from the era build's own argv.

Design constraints (all three are PM rulings, binding):

1. **Supplied input only (R5 discipline).** The capability's input is a locale value the CALLER supplies as a reading of the era build's argv (u5b's `ScriptFlagChange.from` now carries `--i18n-locale en` spans for ng-scripts; for gulp-driven builds like pigallery2's the reading arrives from outside). With NO reading supplied the capability stands down — it must never default, never guess 'en', never infer from the cell major. Look at how existing capabilities express "reading supplied vs absent" in `AngularMigrationInput`-consuming files (e.g. `template-i18n-runtime.ts:176-183`) and follow that idiom — but do NOT edit those files or `AngularMigrationInput` (that threading is unit u7's).
2. **New file** `packages/frameworks/angular/src/locale-id-provider.ts`, following the structure/JSDoc discipline of a sibling capability (read `undecorated-angular-base-class.ts` or `module-with-providers-type-argument.ts` for the house shape: header prose naming the diagnostic/defect it answers, explicit nonclaims, pure functions over supplied readings, no filesystem access). One export line added to `packages/frameworks/angular/src/index.ts`.
3. **The edit it produces**: add the provider to the app module's `providers` array and the `LOCALE_ID` import from `@angular/core` (extending an existing import if present, per what the T009 delta actually did — read `.versionless/work/angular-pigallery2/13cell/frontend/app/app.module.ts` to see the measured final form). It must be idempotent: a module that already provides LOCALE_ID (by any expression) gets no second provider — detection, not overwrite.

Also: if the capability introduces refusal/defect sites that the census counts (`refusal-census` scans `packages/frameworks/angular`), regenerate `evidence/runs/operator-flows/refusal-census.json` with `node --experimental-strip-types packages/cli/src/cli.ts refusal-census --out evidence/runs/operator-flows/refusal-census.json` in this unit so the census verify stays byte-identical. Prefer stand-down semantics over refusal where honest (an absent reading is a normal condition, not an error) — then the census may not move at all.

Tests: new `packages/frameworks/angular/test/locale-id-provider.test.ts` — supplied reading produces the measured pigallery2 form; absent reading stands down; already-provided module untouched (idempotence); import extension vs fresh import; a non-`en` locale value flows through verbatim (the value is data, not vocabulary).

## File contract

- `packages/frameworks/angular/src/locale-id-provider.ts`
- `packages/frameworks/angular/src/index.ts`
- `packages/frameworks/angular/test/locale-id-provider.test.ts`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- Do not edit `angular-cli-era-migration.ts`, `template-i18n-runtime.ts`, or `AngularMigrationInput` — composition and threading are unit u7. Why: one concern per unit; a capability that is not yet composed cannot move the sealed path, which keeps this unit's blast radius zero.
- Do not touch u3/u5b's uncommitted work or any other file. Why: the accumulated Phase B diff must decompose per-unit.
- Do not run `git commit` or `vp pack`. Why: Phase B accumulates uncommitted until u10 cuts commit X.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: the tree carries uncommitted Phase B work these commands would destroy.

## Verification

```verify
pnpm exec vp test --project node
node -e "const b=require('./evidence/runs/operator-flows/byte-identity.json').angular;if(b.identical!==true||b.operatorDigest!==b.driverDigest)throw new Error('byte-identity broken');if(!b.operatorDigest.startsWith('a044d716'))throw new Error('sealed path moved in u6 - it must not; the capability is uncomposed');console.log('SEALED-PATH-UNMOVED-SINCE-U5B')"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-BYTE-IDENTICAL sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
git diff --name-only HEAD -- packages/frameworks | sort | tr '\n' ' ' | grep -q 'packages/frameworks/angular/src/angular-target-cell.ts packages/frameworks/angular/src/index.ts packages/frameworks/angular/src/locale-id-provider.ts packages/frameworks/angular/src/workspace-script-flags.ts packages/frameworks/angular/test/angular-target-cell.test.ts packages/frameworks/angular/test/locale-id-provider.test.ts packages/frameworks/angular/test/workspace-script-flags.test.ts' && echo FROZEN-DELTA-EXACTLY-SEVEN-FILES
```

The sealed-path check inverts u5b's: this unit composes nothing, so the byte-identity digest must STAY at a044d716 — movement here means the capability leaked into the pipeline. Full suite first because the accumulated tree is the thing being kept green.

## Blocked permission

If the measured app.module.ts form cannot be produced without editing files reserved for u7, if idempotent detection needs a reading the input cannot honestly carry, or if the census moves in a way regeneration does not settle, return status "blocked" with the question in open_questions instead of improvising.
