Fable-Opus-Unit: lrapr-t1/t003-u2-recovery-snapshot-rebuild

## Goal

Rebuild a complete recovery snapshot of the current dirty working tree of /Users/jacksm5pro/dev/open-source/versionless. A previous snapshot exists at ref `refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810` (commit 81817169e1c2a928841e035bf3dbfd59062ae67a, 38 entries) but is stale: it misses ~22 currently-dirty paths including 8 tracked-modified evidence files. PM rulings, already decided — do not re-litigate them: (a) rebuild fresh; (b) the old ref stays untouched, the new snapshot goes to the NEW ref `refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810-2`; (c) capture every tracked modification and every untracked file EXCEPT anything under `.fable-opus/` (self-mutating harness state, excluded by policy) and except the manifest file itself; scripts/ and docs/goals/\*\*/notes/ files ARE captured, and the OLD manifest's current bytes at the contract path must be captured into the snapshot BEFORE you overwrite that path with the new manifest.

Preconditions to verify first: HEAD is 622375603a375abb20146dafb4558515b033ad31, and the NEW ref does not already exist.

Produce:

1. A stash-shaped commit (3 parents: base, index-state, untracked-files, standard `git stash` format) at the NEW ref, built entirely with plumbing (temporary GIT_INDEX_FILE, write-tree, commit-tree, update-ref). The real index and working tree must not change except for the single contracted manifest write. `git stash apply <new-ref>` in a fresh detached worktree at the base commit must restore every captured path byte-identically.
2. A new manifest at `docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json` in exactly the schema `scripts/verify-recovery-snapshot.ts` expects ({version, base, recoveryRef, recoveryCommit, entries} with entries as [status, mode, sha256, relativePath] tuples), where recoveryRef/recoveryCommit reference the NEW ref/commit. It must not list itself and must not list `.fable-opus/` paths.
3. A demonstrated restoration: detached temp worktree at the base commit (fresh path under /private/tmp/, not /private/tmp/vl-recovery-verify), `git stash apply` the new ref, run `pnpm exec tsx scripts/verify-recovery-snapshot.ts --root <worktree> --base 622375603a375abb20146dafb4558515b033ad31 --manifest docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json`, expect verified:true, then remove the worktree.

Note: the working tree may accrue further changes to `docs/goals/legacy-react-angular-production-readiness/state.yaml` after this unit (the PM keeps updating the board); that is expected and does not invalidate the snapshot. Capture state.yaml as it is when you build the tree.

## File contract

- `docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json`

## Forbidden moves

- Do not edit, format, move, stage, or delete any existing file other than overwriting the contracted manifest path. Why: preservation unit; every dirty byte must remain byte-identical.
- Do not touch the OLD ref `...-pre-goal-20260810`. Why: prior recovery points are append-only evidence.
- Do not use `git stash push`, `git add` against the real index, `git reset`, or `git checkout --`. Why: the real worktree and index must not move; use a temporary GIT_INDEX_FILE.
- Do not write under `.fable-opus/` or capture it in the snapshot. Why: it mutates during your own run and would make the snapshot self-invalidating under the verifier's strict unexpected-paths check.
- Do not touch the network.

## Verification

```verify
git rev-parse HEAD | grep -q 622375603a375abb20146dafb4558515b033ad31
git cat-file -e 'refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810^{commit}'
git cat-file -e 'refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810-2^{commit}'
test -s docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json
grep -q 'pre-goal-20260810-2' docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json
git worktree add --detach /private/tmp/vl-recovery-verify 622375603a375abb20146dafb4558515b033ad31 && git -C /private/tmp/vl-recovery-verify stash apply refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810-2 && pnpm exec tsx scripts/verify-recovery-snapshot.ts --root /private/tmp/vl-recovery-verify --base 622375603a375abb20146dafb4558515b033ad31 --manifest docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json; rc=$?; git worktree remove --force /private/tmp/vl-recovery-verify >/dev/null 2>&1; exit $rc
```

## Blocked permission

If HEAD is not the pinned commit, the NEW ref already exists, the verifier script's manifest schema differs from what is described above, the verifier cannot pass because state.yaml changed between tree-build and verification (report the exact mismatch), or you would need to write outside the contract, return status "blocked" with the exact question in open_questions instead of improvising.
