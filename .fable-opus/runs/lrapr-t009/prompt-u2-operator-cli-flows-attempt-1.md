Fable-Opus-Unit: lrapr-t009/u2-operator-cli-flows
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: The operator flows are the adoption pitch's product half — framework-neutral analyze/plan/migrate/verify/supported-matrix commands that must run real cells end-to-end without changing frozen migration semantics; the survey-first judgment (extend what exists, no parallel pipeline, no semantic drift) is the expensive part.

## Goal

T009 deliverable 1 in /Users/jacksm5pro/dev/open-source/versionless (T025 Judge worker_package; freeze 27741d9c — React `972ca80155bbc2a6eb3779943cd481b71d35e803` / Angular `4b6e2f4494d98582e4fe9b420c2b412059dc0720` byte-untouchable, verify before/after): framework-neutral OPERATOR CLI flows — `analyze`, `plan`, `migrate`, `verify`, `supported-matrix` — runnable on representative React and Angular cells without changing frozen migration semantics.

1. SURVEY FIRST: inventory what `packages/cli/src/cli.ts` already exposes (trust:_, receipt:_, corpus:\*, report:enterprise, fixture runners). The migration engines are driven today by fixture runner modules (e.g. angular-eshop-webspa-migration-run.ts, angular-pigallery2-migration-run.ts, the React runners). The operator flows must be the PUBLIC, framework-neutral entry points over the same frozen public APIs — composition only, no parallel pipeline, no semantic change (the same inputs must produce byte-identical changesets to the fixture-driven paths where they overlap; prove it on at least one app per lineage).
2. FLOWS (each with --help, machine-readable JSON output mode, and honest failure states):
    - `analyze <app-root>`: detected framework/version/builder/node-era/package-manager + the cell verdicts the engine can read (unknowns preserved as unknown, never strengthened).
    - `plan <app-root>`: the composed changeset preview (files changed/removed/unhandled/declared differences) WITHOUT applying — derived from the same frozen composition.
    - `migrate <app-root> --out <dir>`: apply into a separate output lane (never in place), reporting exactly what the changeset applied.
    - `verify`: the existing offline verifies unified for an operator (receipt/corpus/trust + freeze recompute) with one summary.
    - `supported-matrix`: render the derived matrix (the u1 enterprise derivation) to stdout — quoting bounded outcome strings exactly.
3. PROVE on representative cells: run analyze+plan on TWO real corpus apps (one React, one Angular — use existing work lanes/corpus copies; no new acquisition) and record outputs in evidence; migrate proof may reuse an existing lane's expected changeset for byte-identity comparison rather than a full re-migration if the full run exceeds budget (say which you did).
4. Tests for each flow (arg validation, JSON shape, unknown-preservation, refusal states); suite green; docs/README operator section updated honestly (bounded claims only).

## File contract

- `packages/cli/src/**`
- `packages/cli/test/**`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `docs/**`
- `README.md`
- `evidence/runs/operator-flows/**`

## Forbidden moves

- NO packages/frameworks/**, packages/core/src/{migrations,bundlers,analysis,receipts,corpus}/** changes EXCEPT packages/core/src/index.ts re-exports (the flows compose public frozen APIs; if a needed API is not public, that is a blocked question, not an edit). No semantic drift (byte-identity proof required where paths overlap). No new acquisition/network. No claim beyond the derived matrix. No test weakening. Offline. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "4b6e2f4494d98582e4fe9b420c2b412059dc0720" && echo FREEZE-INTACT'
VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts trust:verify --offline
sh -c 'ls evidence/runs/operator-flows'
```

## Blocked permission

If a flow needs a non-public frozen API (name it), byte-identity between operator and fixture paths fails (bring the diff — that is semantic drift, a real defect), or the work exceeds this unit (say which flows landed), return status "blocked" with specifics in open_questions instead of improvising.
