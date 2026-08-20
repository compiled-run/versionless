Fable-Opus-Unit: lrapr-t023/u5-frozen-adapter-migration
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: The replacement holdout's falsification event — migrating a never-adapter-seen Angular 6 app under the frozen engine where any gap (including the measured @angular/http carriage question) must be diagnosed to the byte as RED evidence, never chased or papered; the diagnosis quality is the product claim.

## Goal

THE REPLACEMENT HOLDOUT EVENT: migrate the eShopOnContainers WebSPA under the FROZEN adapters in /Users/jacksm5pro/dev/open-source/versionless (T023; baseline GREEN in u4 — lane `.versionless/work/angular-eshop-webspa/baseline`, corpus read-only, era cell Node 8.11.4, Angular 6.1.4 / CLI 6.1.5 / angular.json v1 browser builder). Apply the frozen engine AS-IS: composed changeset → migrated lane → install → target build ×2. A gap is a RED FINDING — HALT and report; NO chase, NO reopen, NO app-source hand edit inside this task (T022 follow-up ruling).

FREEZE DISCIPLINE (absolute): composite `f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012` recomputed intact BEFORE and AFTER (React `972ca801…`, Angular `1f63f32c…`); zero frozen-subtree edits; zero app-source hand edits; zero app-name/revision/exact-source branches. The pigallery2 flow (packages/cli/src/fixture/angular-pigallery2-migration-run.ts) is the established runner pattern — mirror it for this app as fixture-scoped setup (paths/config as fixture data is fine; product code stays generic).

MEASURED QUESTIONS this run answers (record each honestly):

1. Does the frozen engine carry `@angular/http` -> the first-party successor (6 import sites, 4 type-position-only `Response`; the app already has HttpClientModule + two services on HttpClient)? The engine exports `removed-entry-point-symbol-successor` as a driver seam — drive it ONLY through public frozen APIs the way prior drivers compose driver-seam capabilities (that is established driver practice, not a reopen). If the seam cannot answer it, that is a named RED.
2. Do the T021-hardened capabilities (composition wiring, successor tables, engines-retarget, application-source-dependency, etc.) generalize to a second never-seen app? Which fire, which stand down, which refuse — record the changeset composition.
3. Angular 6 -> 16 is a longer hop than 8 -> 16: name any new gap class precisely (RxJS 6.2 patterns, angular.json v1-of-6-era shape, TS 2.9 constructs, build-angular 0.7 flags — whatever actually surfaces).

Then: migrated INSTALL (target cell per the frozen engine's policy) and TARGET BUILD ×2 byte-compared if install succeeds. Record diagnostics honestly at whatever stage it stops. GREEN or RED, publish the truth to `evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json` (extend: `migration` block) + `.../migration/` logs, and (mirroring the pigallery2 pattern) a fixture record module `packages/cli/src/fixture/angular-eshop-webspa-migration-record.ts` + runner + tests.

## File contract

- `evidence/ingests/angular-eshop-webspa-netcore2-2/**`
- `fixtures/angular-eshop-webspa/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`

## Forbidden moves

- NO edits under packages/frameworks/**, packages/core/** (INCLUDING receipts — this unit does not publish canonical receipts), packages/trust/**, evidence/trust/**, evidence/runs/\*\*. No app-source hand edits in any lane. No chase: a RED halts this unit with the diagnosis; fixes belong to a future PM/Judge boundary. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any processes; leave no listeners.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012 && echo FREEZE-INTACT'
sh -c 'node -e "const a=require(\"./evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json\"); if(!a.migration) throw new Error(\"no migration record\"); console.log(\"migration outcome:\", a.migration.outcome)"'
```

## Blocked permission

If the frozen engine cannot carry the app (RED — to-the-byte diagnosis; a valid holdout outcome), the driver-seam composition for @angular/http cannot be done through public frozen APIs (name what is missing), the migrated build fails (RED with the full tail), or the work exceeds this unit (say what is done), return status "blocked" with specifics in open_questions instead of improvising.
