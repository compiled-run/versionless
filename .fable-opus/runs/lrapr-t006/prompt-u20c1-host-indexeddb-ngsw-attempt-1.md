Fable-Opus-Unit: lrapr-t006/u20c1-host-indexeddb-ngsw
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the two witness host capabilities the super-productivity journey needs in /Users/jacksm5pro/dev/open-source/versionless — re-cut 1 of 4 (commit `67c78b5`; u20b's calibration facts are the spec). NO journeys.

1. **IndexedDB key reader** on the witness host (`packages/cli/src/witness/playwright-host.ts`): a generic capability reading database names + object-store keys from the live page (the localforage shape — db `SUP`/`SUP_STORE` per the schema — but the reader is generic: enumerate databases, per-db object stores, per-store keys; values are NOT read, keys only, per the redaction discipline). Per-AppSpec opt-in per the u19b construction (non-opted specs provably untouched — extend the exactly-one/none walk test accordingly).
2. **Real-service-worker checkpoint shape** in `executeRun` (`real-app-run.ts`): the schema requires `run.serviceWorker` with three phased checkpoints (the u20b calibration measured the real shape: ready state, script, scope, activation, controlling, cache names, worker events), outputFiles read before/after, workerEvents — a new JourneyEvidence member for lanes with a genuinely succeeding worker, alongside the existing zero/refused/blocked shapes. The tiny-translator/hospitalrun surfaces stay untouched (their shapes remain valid; this is additive).
3. Tests per idiom (reader positive on a synthetic IndexedDB fixture page; non-opted negatives; the ngsw shape round-trip vs the schema's parser); whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/cli/src/fixture/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/**; no drag membership (re-cut 3 owns it).
- Keys only, never values, from IndexedDB; additive-only to pinned surfaces; no app names in reusable code beyond closed lists. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the opt-in construction cannot keep existing verticals provably untouched, the ngsw shape cannot stay additive, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
