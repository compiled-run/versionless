Fable-Opus-Unit: lrapr-t005/mw1e-amend-and-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Amend the jira-clone witness schema per two PM rulings and publish the canonical receipts in /Users/jacksm5pro/dev/open-source/versionless — the final unit of the jira-clone witness vertical. Commit `117b4a5` landed the journey/runner; all four lanes ran green in mw1d's verification with the two amendments applied locally.

PM-ruled schema amendments (`packages/core/src/receipts/witness-angular-jira-clone.ts`):

1. **Routes**: the harness records only post-load navigations (published factoriolab/HospitalRun receipts confirm the idiom). Replace the `routes[0] === '/'` assertion with: every recorded navigation is the board route, the distinct set is exactly `['/project/board']`, and the root is documented in the schema comment as a redirect that is never a recorded navigation. Measured sequence every run: `['/project/board' ×3]` (router redirect, reload, post-reload redirect).
2. **Seams**: the pinned mocked-seam list grows 8→10 with the two measured GitHub raw GIF endpoints embedded in Story-2021's seeded description (`github.com/trungk18/angular-spotify/raw/main/...-demo-short.gif` and `...-visualization.gif`, query-free paths per the policy) — fetched the moment the modal renders the description, which the journey asserts.

Then publish:

1. Baseline 2/2 + migrated 2/2 through the dedicated runner; zero console errors, zero failed requests (the reload-aborted Sentry envelope through the cancelled-duplicate category), zero successful non-loopback.
2. Mutation proof: `Selected for Development` seam (verified unique per lane) → journey red → byte-identical restore → green rerun.
3. Canonical receipts `evidence/runs/witness-angular-jira-clone/receipt.{json,md}` + artifacts under `evidence/runs/angular-jira-clone/`; redacted (no DSN/GA/measurement values — the query-free policy guarantees this structurally), unknowns preserved, `counted: false` pending Judge; readiness tallies from current repo state.
4. Tests updated for the amended schema facts; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-jira-clone.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-jira-clone/**`
- `evidence/runs/witness-angular-jira-clone/**`
- `fixtures/angular-jira-clone/**`

## Forbidden moves

- No other packages/core changes (witness-real-app.ts is NOT in contract this time — the generic surfaces are landed; if one cannot express something, that is blocked); no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Amendments are exactly the two ruled — nothing else in the schema loosens; no fabricated evidence; truthful reds; inventories exact.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-jira-clone/receipt.json evidence/runs/witness-angular-jira-clone/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If publishing is nondeterministic (bring the measured runs), a third schema contradiction surfaces, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
