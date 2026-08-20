Fable-Opus-Unit: lrapr-t004/t004-d3-papercups-socket-stub
Fable-Opus-Timeout-Minutes: 35

## Goal

Build the remaining witness infrastructure for the papercups vertical in /Users/jacksm5pro/dev/open-source/versionless — NO journeys, NO receipts this unit; that is the next unit. Precisely three deliverables:

1. A minimal Phoenix v2 WebSocket stub wired through the `upgrade` seam that the previous unit added to `startStaticServer` (`packages/cli/src/witness/real-app-run.ts`): WebSocket handshake, Phoenix v2 JSON frame codec, `phx_reply` (status ok) to `phx_join` and `heartbeat`, and a `shout`-style echo so a reply message posted in the UI produces genuine visible state. Frames served must be recorded into the run's response ledger like HTTP responses; the stub must never open outbound connections.
2. A frozen synthetic papercups API projection (fixture-scoped, honestly labeled evidence data) served through the loopback `api` seam: `/api/session`, `/api/me`, `/api/conversations` disambiguated by query string (`status=open|closed`, `priority`, `assignee_id`), conversation messages, and the reply POST — enough for sign-in, inbox triage across categories with distinct visible state, and a reply round-trip.
3. Registration: extend `WITNESS_REAL_APP_NAMES` in `packages/core/src/receipts/witness-real-app.ts` with the papercups app name (this narrow core edit is explicitly authorized — nothing else in packages/core may change), and add the papercups entries to the `App`-keyed structures in `packages/cli/src/witness/real-app-run.ts` (journey definitions may be stubbed with a clearly-marked not-yet-implemented shape if the wiring needs them, but do not write fake journeys that pretend to pass).

Everything unit-tested: frame codec round-trip, join/heartbeat replies, echo behavior, API projection query disambiguation, ledger recording. Repo gate stays green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/test/**`

## Forbidden moves

- No other packages/core changes beyond the named-list extension in witness-real-app.ts; no packages/frameworks/**, packages/trust/**, evidence/**, fixtures/**, scripts/**, docs/** writes. Why: this is witness plumbing only; adapter surface is converging toward freeze and evidence is sealed.
- No network; the stub is loopback-only by construction and must record, never mask, its served data.
- No fake passing journeys or receipts; this unit ships infrastructure and tests only.
- Strict TypeScript, magic-regexp, pathe, ufo. Do not weaken or delete existing tests. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the Phoenix v2 protocol shape cannot be implemented cleanly against the app's actual client code (read the papercups source in .versionless/work to confirm frame format), if the upgrade seam proves insufficient, or if anything needs files outside the contract, return status "blocked" with specifics in open_questions instead of improvising.
