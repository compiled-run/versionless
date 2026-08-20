Fable-Opus-Unit: bank-demo-fleet-pipeline-p2g/interim-audit-2026-08-20
Fable-Opus-Timeout-Minutes: 30

## Goal

READ-ONLY interim audit of goal bank-demo-fleet-pipeline against its ORACLE, at HEAD (6f1acac), in the T042/T999 house style (read `docs/goals/bank-demo-fleet-pipeline/goal.md` — the oracle definition, the T042 verdict section, and today's decision boxes — plus `notes/T042-reaudit.md` for the audit discipline). Produce ONE file: `docs/goals/bank-demo-fleet-pipeline/notes/interim-audit-2026-08-20.md`. Every claim carries its evidence path; every number is read from disk during this audit, never quoted from notes.

The oracle has two halves, both required. Audit each:

**Half 1 — the command.** One command, clean-checkout-runnable, on an unseen app, interventionCount 0. Verify at HEAD: read the current flame record (9/9? count 0? bounded?), the three NEW proven records from today (coverview, cra-redux, your-spotify — each 9/9, count 0, through which policies), and state what "unseen app" evidence exists (which of the proven four were first-invocation runs on apps the pipeline had never proven). Note what is NOT re-verified here (you run nothing — this audit reads; the clean-checkout re-run is T042's sealed result plus today's fresh-lane runs).

**Half 2 — coverage + capability above baseline.** Read `evidence/trust/current/coverage-report.json`: totals vs the sealed baseline (proven 10 sealed / 8-of-58 capability at goal start). State the movement: proven 14 (which 4 by run-record derivation), applications 29, every non-proven row's code (list the distinct codes with counts). Read `capability-coverage.json` + the coverage report's capabilities block: 8/51/59, plus the ONE derived proof (react-cra-vite-adapter, flame). Verdict per conjunct: STRICTLY ABOVE baseline or not, with the honest note that cross-proven 8 has not moved (denominator grew, one capability's proofs grew).

**The gap map.** What stands between HEAD and the goal's full outcome, each item with its owner: (a) T044's five frozen items (quote the brief's enumeration, note items 1-2 proven sufficient by u1c, item 4 blocking the first Angular build crossing at any cell); (b) consent ruling (four apps + the ionic precedent); (c) foreign-lockfile proven-reachability; (d) the still-unanswered lane-wide question (fuxa stopped short); (e) witness for Angular (never reached). Then the demo-readiness statement against the ORIGINAL ask (a top-10 US bank, production-ready migration of older React and Angular apps): what a bank's auditor would see today (the honest inventory: react line proven end-to-end 4 apps with named-policy admission; angular line proven to 7/9 with every wall named and priced), and what they would NOT yet see.

**Audit integrity checks** (run, read-only): `npm run trust:verify -- --offline`; `node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only`; the census verify-only; the freeze composite. Record their outputs verbatim in the note. If ANY disagrees with what the notes claim, that discrepancy IS the audit's headline.

Do NOT declare full_outcome_complete — it is not, and the note must say which conjuncts hold and which wait.

## File contract

- `docs/goals/bank-demo-fleet-pipeline/notes/interim-audit-2026-08-20.md`

## Forbidden moves

- Read-only apart from the single note; no pipeline runs, no regeneration, no git state commands. Why: an audit that changes what it audits is not an audit.

## Verification

```verify
test -f docs/goals/bank-demo-fleet-pipeline/notes/interim-audit-2026-08-20.md && wc -l < docs/goals/bank-demo-fleet-pipeline/notes/interim-audit-2026-08-20.md
git diff --quiet HEAD -- packages evidence && echo NOTHING-TOUCHED
npm run trust:verify -- --offline
```

## Blocked permission

If any integrity check contradicts the published record in a way that needs adjudication before the audit can state a verdict, return status "blocked" with the discrepancy in open_questions instead of writing around it.