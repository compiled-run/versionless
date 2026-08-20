Fable-Opus-Unit: lrapr-t005/mw1c-schema-and-wiring
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the jira-clone witness core schema and the generic wiring it needs in /Users/jacksm5pro/dev/open-source/versionless — re-cut (1 of 3) from mw1b's verified facts; NO AppSpec/journey (next unit), NO published receipts (after that). Latest commit `927b4f3`.

PM rulings baked in:

1. **Corroborated-cancelled-duplicate category extends generically to mocked non-loopback seams**: a browser-cancelled fetch (net::ERR_ABORTED) of a method+path whose same-page run carries ≥1 successful (2xx, incl. mocked) sibling is admissible through the category; the pinned path is QUERY-FREE by construction for non-loopback entries (never record a query string). Add a test asserting no recorded path in the inventory carries a `?`. The same-origin asset behavior (factoriolab's transparent.gif) is unchanged. Verified case this serves: reload aborts an in-flight Sentry envelope POST whose two siblings got the mocked 200 — count is load-timing dependent, so category-not-count is the honest record.
2. Mocked non-loopback seams are recorded per the established locality idiom (GA tag, six distinct cloudinary paths, Sentry envelope; measurement-id/DSN VALUES never in evidence — pin by query-free path).
3. Journey facts for the schema shape (from mw1b's browser verification): drag evidence per the closed drag-surface list; modal title-edit round-trip with description-renders non-claim (Quill limitation); create-issue (navbar item 3) adding a Backlog row 3→4; filter narrowing 1/0/0/0 on "Witness" and widening via full clear gesture (select-all+Backspace) restoring counts; hover tooltip `Assignee: Trung Vo`; seven rendered-style probes (values in the mw1b receipt) as cross-lane style evidence; scrollAbsence at 1280×720; no SW; no localStorage; reload restores seed board; routes `/` → `/project/board`, modal never changes route.

Deliver:

1. `packages/core/src/receipts/witness-angular-jira-clone.ts` per the factoriolab schema idiom: pinned source identity, bound build receipts, drag evidence, mocked-seam inventory (query-free paths), the extended cancelled-duplicate inventory, style-probe evidence, scrollAbsence, route sequence, tracked events, digests, parser + renderer + verifier + aggregate member. Barrel-exported.
2. The generic category extension + query-free pinning in `packages/core/src/receipts/witness-real-app.ts` and the witness host/runner machinery (`packages/cli/src/witness/**`) — additive; factoriolab/hospitalrun/papercups pinned evidence and verifiers stay green untouched.
3. Tests per idiom: schema parse/render/verify round-trip; category extension positives (corroborated non-loopback cancelled duplicate admitted, query-free path) and negatives (uncorroborated fails, query in recorded path fails the new assertion, same-origin behavior unchanged).
4. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-jira-clone.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/cli/src/fixture/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/**.
- Additive only to pinned evidence surfaces; no fabricated evidence; no app names in reusable surfaces beyond closed lists; DSN/GA/measurement values never anywhere.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the category extension cannot stay additive, the query-free construction conflicts with an existing pinned record, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
