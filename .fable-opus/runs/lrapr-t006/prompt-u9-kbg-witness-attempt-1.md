Fable-Opus-Unit: lrapr-t006/u9-kbg-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the killedbygoogle vertical in /Users/jacksm5pro/dev/open-source/versionless — the first legacy-Next witness cell, and the one that settles u7's two open questions (does the migrated mount-element document render the same application the era export pre-rendered; does Emotion styling survive). Both lanes are committed and deterministic (commit `a6de411`; regenerate offline via `packages/cli/src/fixture/next-killedbygoogle-v3-0-0-static-run.ts`; caches under `.versionless/`).

Templates: the established per-app witness idiom (factoriolab/jira-clone/hospitalrun runners; the h3d/m3b generic mechanisms: exact inventories, corroborated-cancelled-duplicate category, measured scroll/absence, rendered-style probes, mocked-seam inventory with query-free non-loopback pinning).

App facts from the ingest + u7 (re-verify against the pinned tree, not trust): single authored route; 263 graveyard records rendered as a list; search input narrows by name/description (upstream spec asserts count INCLUDING a non-data ad <li> — "Google+" matches 1 record but 2 list items); react-select type filter (the +1 arithmetic again: app.length + 1 = 51); compound search×filter; hover surfaces if meaningful. Third-party destinations that MUST be blocked fail-fast without console-error leakage (the ad <li> renders regardless, so counts hold offline): analytics.bale.media/umami.js (unconditional), card.codyogden.com (prod-only), carbonads. The era document pre-renders the full app (291KB) while the migrated one mounts client-side — the parity oracle is the RENDERED DOM and behavior, not document bytes; rendered-style probes settle the Emotion question.

Deliver:

1. kbg in `WITNESS_REAL_APP_NAMES` (closed-list idiom, framework `'next'` if the enum has it — follow what killedbygoogle's existing enum entry uses; note the corpus already carries a killedbygoogle name from the retired-goal receipt surface — follow the repo's existing naming discipline for this NEW vertical, e.g. a versioned name per the receipt idiom, without touching the retired receipt kinds) and its journey in `real-app-run.ts` plus a dedicated runner.
2. Journeys on BOTH lanes: (a) search narrowing with the exact +1-aware count assertions and typed input; (b) type filter via the react-select control (keyboard and click) with the +1-aware count; (c) compound search×filter then full-clear restoring counts; plus hover where meaningful, measured scroll or absence, and the reload checkpoint. The single-route limitation is a published non-claim — no navigation journey is claimed.
3. Rendered-style probes across lanes (the Emotion arbitration — pick stable probes: list item, header, ad slot, body) and rendered-DOM equivalence assertions on the list content itself (era pre-rendered vs migrated client-mounted must converge to the same settled DOM).
4. Exact inventories per idiom (console errors, failed requests incl. the blocked third-party destinations pinned query-free, cancelled-duplicate category if it fires); zero successful non-loopback.
5. Baseline 2/2 + migrated 2/2; semantic byte-mutation on the migrated bundle (visible string → journey red → byte-identical restore → green rerun).
6. Core schema `packages/core/src/receipts/witness-next-killedbygoogle-v3.ts` (or the repo-idiomatic name distinct from the retired kind), barrel-exported; canonical receipts at `evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.{json,md}` + artifacts under `evidence/runs/next-killedbygoogle-v3-0-0/`; redacted, unknowns preserved, `counted: false` pending Judge.
7. Tests per idiom; whole repo gate green. DO NOT touch aggregate.json, conformance, or trust — the transition unit follows.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-next-killedbygoogle-v3.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/next-killedbygoogle-v3-0-0/**`
- `evidence/runs/witness-next-killedbygoogle-v3-0-0/**`
- `fixtures/next-killedbygoogle-v3-0-0/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*; the retired-goal killedbygoogle receipt kinds stay untouched.
- No fabricated evidence; truthful reds; inventories exact; no app names in reusable surfaces beyond closed lists.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.json evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the rendered-DOM equivalence genuinely fails (that is a REAL migration failure — record it red first, it is evidence), a journey cannot pass truthfully, a closed enumeration outside the contract blocks receipts, or the work exceeds this unit (clear cut line), return status "blocked" with specifics in open_questions instead of improvising.
