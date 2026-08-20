Fable-Opus-Unit: bank-demo-fleet-pipeline-p2f/T045-b2-candidate-rescreen
Fable-Opus-Timeout-Minutes: 25

## Goal

READ-ONLY re-screen of the coverage-grind candidate backlog, so no further acquire spend or consent request is made on a mis-enumerated app — T045-b1 proved the need: verdaccio survived FIVE task numbers as a "react candidate" while declaring no react dependency at its pin. Produce ONE file: `docs/goals/bank-demo-fleet-pipeline/notes/T045-candidate-screen.md`.

Method — the evidence is already on disk; no sockets:
1. Enumerate every candidate the goal's notes and the old goal's evidence name (the T045 card, `notes/T012-angular-batch.md` enumerations and §14, `evidence/ingests/**`, `evidence/runs/**` not-attempted rows, and the old goal dir `docs/goals/legacy-react-angular-production-readiness/` where referenced).
2. For each: read the manifest AT ITS PIN from what is already on disk (journals, staged trees, cached corpora, recorded keyFileDigests/package.json readings). Record: framework actually declared (react/angular/neither, with the dependency line quoted), license (SPDX from the journal/manifest, quoted), consent status (corpus-MIT-covered / needs-per-app-grant / excluded), and the next honest wall you predict from this session's named taxonomy (e.g. lockfile-foreign, git-dependencies, registry-unreachable, the Angular frozen build defect, witness).
3. Classify: RUNNABLE-NOW (MIT + framework declared + no known wall short of witness), RUNNABLE-AFTER-CONSENT (needs owner ruling 3), RUNNABLE-AFTER-T044 (Angular candidates), STRUCK (no framework at pin, like verdaccio — say what it actually is), UNKNOWN (evidence on disk insufficient — name exactly what reading is missing; do not guess).
4. Rank RUNNABLE-NOW by expected cost (tree size/install weight from the journals), smallest first — that is the next batch unit's dispatch order.
5. If the screen finds ANY candidate mis-classified in a published surface (a coverage row claiming a framework its manifest contradicts), that is a finding to report — do not fix surfaces in this unit.

## File contract

- `docs/goals/bank-demo-fleet-pipeline/notes/T045-candidate-screen.md`

## Forbidden moves

- Read-only apart from the single note; NO network, NO acquire, NO VERSIONLESS_NETWORK_MODE. Why: the screen exists to make spend honest; spending during it would invert that.
- No consent interpretation beyond the recorded facts — the owner ruling is pending; your job is to label which candidates WAIT on it, not to decide it.
- No git state commands.

## Verification

```verify
test -f docs/goals/bank-demo-fleet-pipeline/notes/T045-candidate-screen.md && wc -l < docs/goals/bank-demo-fleet-pipeline/notes/T045-candidate-screen.md
git diff --quiet HEAD -- packages evidence && echo NOTHING-TOUCHED
npm run trust:verify -- --offline
```

## Blocked permission

If the candidate universe cannot be enumerated from on-disk evidence (the old goal's notes are missing or contradictory), return status "blocked" with the question in open_questions instead of improvising.