Fable-Opus-Unit: lrapr-t006/u19c-tiny-translator-journey-runner
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the tiny-translator AppSpec/journey, dedicated runner, and tests in /Users/jacksm5pro/dev/open-source/versionless — re-cut (2 of 3); publish is next. Commit `23b2f54` landed the opt-in mechanisms (file-input load, download capture) and the core schema (`witness-angular-tiny-translator.ts`). The synthetic XLIFF fixture exists at `fixtures/angular-tiny-translator-v0-12-0/witness/synthetic-messages.xlf`.

Lanes: baseline from `.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app/dist/rebuild-1`; the migrated lane's stage tree is gone — regenerate it offline via the committed u17-series fixture flows (the runner should encapsulate regeneration per the established regenerate-if-missing idiom; the u17d record pins what dist-7 contained — verify the regenerated tree matches its inventory digest before trusting it).

Journeys per the u19 rulings (both lanes; the app declares BOTH opt-ins in its AppSpec):
(a) create project via the app's own form + load the synthetic XLIFF through the real hidden file input (the FileReader seam — a capability-edited service, so this journey IS the parity arbitration, assert it explicitly as such);
(b) edit a translation unit with typed content, mark translated/reviewed state changes, filter narrowing + full-clear restore;
(c) export via the app's own download path, capture through the download mechanism, assert the emitted bytes carry the typed translation (parse the captured XLIFF for the exact synthetic unit);
(d) hover where meaningful; measured scroll or absence per surface; localStorage persistence across reload asserted; per-lane font-seam blocking with the two distinct mat-icon degradations asserted per the schema; rendered-style probes with the eleven-major declared differences recorded both directions.
Mutation seam chosen and documented (unique visible string in the migrated bundle, uniqueness verified against the regenerated dist).

Deliver: AppSpec + journey in `real-app-run.ts`; dedicated `packages/cli/src/witness/angular-tiny-translator-run.ts`; tests per idiom (journey wiring, mechanism opt-in declarations, schema agreement); you may run the browser to verify wiring but publish nothing to evidence/. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`

## Forbidden moves

- No packages/core/src changes (schema landed — cannot-express = blocked); no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- No published receipts; no fabricated evidence; key.pem nowhere; no app names in reusable surfaces beyond closed lists.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the regenerated migrated tree does not match the u17d inventory digest (bring both digests), the schema cannot express a journey fact, a real behavioral break surfaces (record it red first — it is evidence), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
