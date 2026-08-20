Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u5-i18n-flag-rows

## Goal

Delta item 7 of the T010 supersession: teach the Angular adapter's script-flag translation about the four `--i18n-*` flags the Angular 13 line removed. Per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §1.4 and §2 item 7 — read those first. This unit moves frozen bytes in ONE file: `packages/frameworks/angular/src/workspace-script-flags.ts` (authorized for T010; supersession recorded later at u10). The tree already carries uncommitted Phase B work (u3's published 13 cell) — build on it, do not disturb it.

The evidence (`evidence/runs/angular-13cell/README.md` item 7 and the T009 recipes): pigallery2's era build passed `--i18n-locale en --i18n-format xlf --i18n-file <path> --i18n-missing-translation warning` (values illustrative — READ the evidence for the real ones); the v13 CLI removed all four `--i18n-*` build flags (view-engine i18n replaced by `$localize`). The migration must translate them out of `ng` scripts rather than let the migrated workspace die on an unknown flag.

What to build:

1. Four new `RemovedCliFlag` rows in `REMOVED_ANGULAR_CLI_FLAGS` (`workspace-script-flags.ts:74`): `--i18n-locale`, `--i18n-format`, `--i18n-file`, `--i18n-missing-translation`. Follow the existing rows' shape exactly (`--prod` is the model). `removedAfterMajor: 12`, no successor flag (the successor is the `$localize` runtime, not a CLI flag — say that in whatever prose field the row shape carries). If the row shape distinguishes value-carrying flags from booleans, mark these as value-carrying so the flag AND its value are removed together — `--i18n-locale en` must not leave a dangling `en` argv token.
2. CRITICAL for the next unit (u6): the value of a removed `--i18n-locale` is load-bearing — delta item 9 translates it into a `{provide: LOCALE_ID, useValue: <that value>}` provider. Check how the removal is RECORDED (the migration's readings/changeset/notes surface): if the existing mechanism already preserves the removed flag's value somewhere a later capability can read, state exactly where in your receipt summary. If it does not — if the value is silently dropped — do NOT redesign the mechanism in this unit; record precisely what is lost and where the seam is, in your receipt, so u6's packet can be cut correctly.
3. Tests in `packages/frameworks/angular/test/workspace-script-flags.test.ts`: the four rows, value-carrying removal (no dangling value token), a 13-cell case (translation under `cell.angularLine` 13.4), and the existing gate pinned: `workspace-script-flags.ts:181`-region only rewrites scripts whose first token is `ng` — pigallery2's own i18n flags live in a gulp task and must be untouched (that fact is what keeps the sealed 16 path inert, sizing R2).

## File contract

- `packages/frameworks/angular/src/workspace-script-flags.ts`
- `packages/frameworks/angular/test/workspace-script-flags.test.ts`

## Forbidden moves

- Do not touch any other file, frozen or not — including u3's uncommitted work in `angular-target-cell.ts`/`era-cell.ts`. Why: one subtree-moving concern per unit; the accumulated Phase B diff must decompose cleanly into per-unit patches.
- Do not redesign how removed flags are recorded (Goal item 2). Why: that is u6's decision to make with a fresh contract; a mechanism change here doubles this unit's blast radius.
- Do not run `git commit`, `vp pack`, or regenerate anything under `evidence/**`. Why: Phase B accumulates uncommitted until u10 cuts commit X.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: the tree carries uncommitted Phase B work — these commands would destroy it.

## Verification

```verify
pnpm exec vp test --project node packages/frameworks/angular/test/workspace-script-flags.test.ts packages/frameworks/angular/test/angular-cli-era-migration.test.ts packages/cli/test/operator-flows.test.ts
node packages/cli/src/fixture/operator-flow-byte-identity-run.ts && git diff --quiet HEAD -- evidence/runs/operator-flows/byte-identity.json && echo SEALED-16-PATH-BYTE-IDENTICAL
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-BYTE-IDENTICAL sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
git diff --name-only HEAD -- packages/frameworks | sort | tr '\n' ' ' | grep -q 'packages/frameworks/angular/src/angular-target-cell.ts packages/frameworks/angular/src/workspace-script-flags.ts packages/frameworks/angular/test/angular-target-cell.test.ts packages/frameworks/angular/test/workspace-script-flags.test.ts' && echo FROZEN-DELTA-EXACTLY-FOUR-FILES
```

The byte-identity re-derivation is the R2 gate: pigallery2's i18n flags live in a gulp task, `applyScriptFlagTranslations` only rewrites `ng`-first scripts, so the sealed 16 path must not move — if it does, that is a real finding to report, not a nuisance. The census check proves data rows added no refusal sites and shifted no pinned lines. The frozen-delta line pins the accumulated Phase B contract: exactly u3's two files plus your two.

## Blocked permission

If the evidence names different i18n flags or values than this packet paraphrases, if the RemovedCliFlag shape cannot express a value-carrying flag without a mechanism change, or if the byte-identity re-derivation moves the sealed evidence, return status "blocked" with the question in open_questions instead of improvising.
