Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u7-compose-i18n
Fable-Opus-Timeout-Minutes: 35

## Goal

The last frozen-byte unit of T010 Phase B: make the i18n capabilities real end to end. Per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §2 items 8-9, §5 u7, risk R5, and the PM rulings in `docs/goals/bank-demo-fleet-pipeline/goal.md` § "T010 Rulings". The tree carries uncommitted Phase B work (u3: 13 cell; u5b: i18n flag rows; u6: `locale-id-provider.ts` capability, currently NOT exported from the barrel — that is deliberate, you export it). Read u6's file first: `packages/frameworks/angular/src/locale-id-provider.ts`.

Five parts:

1. **Widen the `template-i18n-runtime` gate** (`template-i18n-runtime.ts`): today the only admissible reading is the application's own parsed template i18n markers (`:176-183`), and pigallery2 measured ZERO markers yet 215 `$localize` occurrences in the emitted bundle (`evidence/runs/angular-13cell/pigallery2-live-witness.json` — the defect the live witness caught). Add a SECOND optional reading: emitted-bundle/closure `$localize` presence, arriving as a SUPPLIED INPUT on `AngularMigrationInput` (R5, binding: never an inference from the cell major — a capability that declares `@angular/localize` on every 13 plan is bundle weight plus a claim the application's bytes do not support). Either reading admits; both absent ⇒ stands down exactly as today.
2. **Compose `provideEraLocaleId` into `migrateAngularCliEraWorkspace`** (`angular-cli-era-migration.ts`): thread the era-locale reading through `AngularMigrationInput` (`:135` region) alongside the new closure reading; place the capability at the honest point in the ordered pipeline (after module-shape capabilities settle, so its idempotence detection sees final provider arrays — measure the ordering constraints from the file rather than assuming). The fixture/driver path supplies NEITHER new reading, so the sealed 16 output must not move.
3. **Barrel line**: `export * from './locale-id-provider.ts';` in `packages/frameworks/angular/src/index.ts` (u6 built it; the export was moved here so coverage and composition land together).
4. **Coverage entry**: `packages/core/src/receipts/capability-coverage.ts` gains the entry for `locale-id-provider` (lineage angular, entryPoints per what the file actually exports, `provenApps: []` — nothing has run through it as a composed capability; pigallery2's live-witness fix was a hand edit that this capability now automates, which is a rationale sentence, not a provenApps row). Follow the existing entry shape exactly. `packages/core/test/capability-coverage.test.ts` is in your contract in case it pins literal counts; prefer derived assertions already there.
5. **Trust regeneration**: the coverage entry changes `buildCapabilityCoverage()`, so `evidence/trust/current/capability-coverage.json` and siblings must regenerate: `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`, then `npm run trust:verify -- --offline` must return `valid:true`. Do NOT run `vp pack` first unless trust:generate itself fails on stale dist — if it does, run `pnpm exec vp pack` once and say so in your receipt. Then regenerate the census if your frozen-file edits shifted refusal-site lines: `node --experimental-strip-types packages/cli/src/cli.ts refusal-census --out evidence/runs/operator-flows/refusal-census.json`.

Tests: `template-i18n-runtime.test.ts` — the widened trigger (closure reading admits; zero-marker app with closure reading gets `@angular/localize` + polyfill import; no reading ⇒ stands down; the R5 negative: a 13 cell with no readings must NOT admit). `angular-cli-era-migration.test.ts` — composition ordering; a supplied era-locale reading produces the provider through the full migration; the fixture path (no readings) unchanged.

GUARDS that must reproduce verbatim after your trust regen: matrix react 6/6 and angular 4/4; coverage totals {applications 21, proven 11, bounded 2, refused 5, not-admitted 3}; freeze composite 27741d9c in adapter-freeze.json (the supersession is u10's, not yours).

## File contract

- `packages/frameworks/angular/src/template-i18n-runtime.ts`
- `packages/frameworks/angular/src/angular-cli-era-migration.ts`
- `packages/frameworks/angular/src/index.ts`
- `packages/frameworks/angular/test/template-i18n-runtime.test.ts`
- `packages/frameworks/angular/test/angular-cli-era-migration.test.ts`
- `packages/core/src/receipts/capability-coverage.ts`
- `packages/core/test/capability-coverage.test.ts`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- Do not edit `locale-id-provider.ts` itself, u3/u5b's files, or anything in `packages/frameworks/react/**` / `packages/core/src/{migrations,bundlers,analysis}/**` / `packages/trust/src/**`. Why: one concern per unit; freeze.ts is u10's single point of record.
- Do not make the widened gate infer from the cell (R5). Why: the honest boundary between measurement and guess is the entire point of this adapter.
- Do not run `git commit`. Why: Phase B accumulates uncommitted until u10 cuts commit X.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: the tree carries all of Phase B uncommitted.

## Verification

```verify
pnpm exec vp test --project node
node -e "const b=require('./evidence/runs/operator-flows/byte-identity.json').angular;if(b.identical!==true||b.operatorDigest!==b.driverDigest)throw new Error('byte-identity broken');if(!b.operatorDigest.startsWith('a044d716'))throw new Error('sealed path moved in u7 - fixture supplies no new readings, so it must not');console.log('SEALED-PATH-UNMOVED-SINCE-U5B')"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-BYTE-IDENTICAL sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==21)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('composite moved before u10');console.log('COMPOSITE-STILL-27741d9c')"
sh -c "[ -z \"$(git status --porcelain -- packages/frameworks | grep -v 'frameworks/angular/')\" ] && echo FRAMEWORKS-ANGULAR-ONLY"
git diff --quiet HEAD -- packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo CORE-FROZEN-UNTOUCHED
```

Full suite first (the accumulated tree is the invariant). The sealed-path check pins that composition without supplied readings is a no-op on the fixture. The matrix/coverage/composite guards prove the trust regen moved only what the coverage entry honestly moves.

## Blocked permission

If the pipeline ordering cannot satisfy the idempotence constraint, if the closure-reading shape has no honest home on AngularMigrationInput without redesigning it, if trust:generate moves a guard number, or if anything outside your contract must change, return status "blocked" with the question in open_questions instead of improvising.
