Fable-Opus-Unit: lrapr-t006/u19i-data-loss-root-cause
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: Silent data loss across an eleven-major migration whose source was translated by our own capability — the root cause decides whether an adapter transform is defective, and a wrong attribution here corrupts both the capability and the evidence corpus.

## Goal

Root-cause the tiny-translator migrated lane's silent translation loss in /Users/jacksm5pro/dev/open-source/versionless (commit `487d9ab`; u19h's measurements are the spec: `textarea.ng-dirty` set in both lanes; `app-normalized-message-input` stays `ng-pristine` in migrated; the undo control never loses `disabled` (>11s) in migrated vs ~200ms in baseline; exported XLIFF carries `state="final"` with the ORIGINAL text; the component's chain is `form.valueChanges.pipe(debounceTime(200)) → propagateChange(...)` and our rxjs-prototype-patch capability produced the `.pipe` translation; lanes at `.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app/dist/rebuild-1` and `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/dist-11`).

DELIVERABLE IS THE CAUSE, NOT A FIX. Attribute the break to exactly one of, with mechanical evidence:
(a) **our transform's output** — read the transformed module in the stage tree source AND its compiled form in the bundle; compare the era module's chain; if our pipe translation altered semantics (subscription timing, operator import identity, `this` binding, subscription lifecycle), prove it at the code level;
(b) **an ecosystem/runtime interaction** — e.g. rxjs 7 + zone.js + Angular 16 forms ControlValueAccessor timing, the debounceTime scheduler under NgZone, dual rxjs copies in the closure (CHECK: does the bundle carry two rxjs instances whose Observable identities differ? A valueChanges Observable from one copy piped with operators from another silently produces a dead chain — measure the closure and the bundle);
(c) **an app-latent bug exposed** — the era behavior depended on something version-specific the app never owned.

Method freedom, but these probes are cheap and decisive: instrument via the browser (evaluate on the live migrated page: subscribe directly to the inner control's valueChanges, check it fires; check the outer ControlValueAccessor's registered onChange identity; check `Observable.prototype` identity across the chain), grep the closure for duplicate rxjs installs (`node_modules/**/rxjs/package.json`), read the bundle bytes at the chain's compiled site. Write the cause record to `evidence/runs/angular-tiny-translator-v0-12-0/u19i-data-loss-cause.json` (sealed, mechanical evidence, the one attributed cause, and the repair-or-record recommendation that follows from it). Tests only if a capability defect is proven (the failing-shape regression test, no fix yet). Whole repo gate green.

## File contract

- `packages/cli/src/fixture/**`
- `packages/cli/src/witness/**`
- `packages/cli/test/**`
- `packages/frameworks/angular/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`

## Forbidden moves

- NO fixes this unit (packages/frameworks/angular/src is deliberately out of contract — attribution before repair); no packages/core changes; no packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No fabricated evidence; the cause must be mechanical, not plausible. No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0/u19i-data-loss-cause.json'
```

## Blocked permission

If the cause cannot be attributed mechanically within budget (bring every probe result — partial attribution evidence is still the deliverable), return status "blocked" with the probe ledger in open_questions instead of guessing.
