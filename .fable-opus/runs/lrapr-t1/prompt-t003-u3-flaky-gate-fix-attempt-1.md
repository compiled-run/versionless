Fable-Opus-Unit: lrapr-t1/t003-u3-flaky-gate-fix
Fable-Opus-Timeout-Minutes: 35

## Goal

Make the repository test gate `pnpm exec vp test --project node` reliable in /Users/jacksm5pro/dev/open-source/versionless. The suite is currently 878/878 green when run alone but fails under parallel/contended load; the historical Codex run also recorded an 822/824 red. Known failure modes from a PM reproduction on 2026-08-10: (a) 5-second default test timeouts tripping on heavyweight integration tests — `packages/cli/test/next-killedbygoogle-integrate.test.ts` observed timing out, and `packages/cli/test/vite8-shared-adapter-cohort-run.test.ts` alone takes ~148s; (b) a hardcoded port collision — `Error: listen EADDRINUSE: address already in use 127.0.0.1:44210` from vite8-shared-adapter-cohort-run. Three further files failed in that contended run but were not identified.

Do this systematically, not just for the two named files:

1. Find every test that binds a fixed TCP port (grep the test and src trees for hardcoded port numbers / listen calls) and convert them to ephemeral allocation (bind port 0 and read the assigned port, or an equivalent existing project pattern) so concurrent runs cannot collide.
2. Find every test whose runtime can plausibly exceed the 5s default (long integration/witness/build tests) and give those tests or files explicit generous timeouts. Prefer per-test/per-file timeout configuration over raising the global default; if a global `testTimeout` bump in the vite/vp config is clearly the project's idiom, that is acceptable — say which you chose and why.
3. Prove stability: the full suite must pass twice consecutively.

This is a test-reliability change only: no product behavior changes, no assertion weakening, no test deletion or skipping.

## File contract

- `packages/cli/test/**`
- `packages/cli/src/**`
- `packages/core/test/**`
- `packages/frameworks/**/test/**`
- `vite.config.ts`

## Forbidden moves

- Do not weaken, delete, or skip any test or assertion. Why: the gate's meaning must not change; only its reliability.
- Do not change product runtime behavior except port-selection plumbing needed so tests can inject/observe an ephemeral port. Why: this unit must be a no-op for migration semantics.
- Do not touch evidence/**, fixtures/**, docs/goals/\*\* or any file outside the contract. Why: curation is a later unit; the recovery snapshot floor is already sealed.
- Obey repo policy: strict TypeScript only, magic-regexp for regexes, pathe for paths, ufo for URLs.
- Do not touch the network.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
pnpm exec vp test --project node
```

## Blocked permission

If a fix genuinely requires files outside the contract, if a test's flakiness traces to a real product defect rather than timeouts/ports (report it — that changes the plan), or if the suite cannot pass twice consecutively after your changes, return status "blocked" with the exact failing output and question in open_questions instead of improvising.
