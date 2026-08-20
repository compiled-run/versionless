Fable-Opus-Unit: lrapr-t1/t003-u1-recovery-snapshot

## Goal

Create a durable, restoration-proven recovery snapshot of the current dirty working tree of /Users/jacksm5pro/dev/open-source/versionless, before any curation happens in later units.

Preconditions you must verify first: HEAD is 622375603a375abb20146dafb4558515b033ad31 and the ref refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810 does not already exist. If either fails, return blocked.

Produce:

1. A stash-shaped commit reachable from ref `refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810` capturing every tracked modification AND every untracked file (including all untracked paths under docs/goals/, evidence/, packages/, scripts/), such that `git stash apply <ref>` in a fresh detached worktree at the base commit restores all of them byte-identically. Build it with plumbing (temporary GIT_INDEX_FILE, write-tree, commit-tree, update-ref) — the real index and working tree must not change at all.
2. A manifest at `docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json` listing each captured path with relative path, file mode, git status, and SHA-256. Read `scripts/verify-recovery-snapshot.ts` FIRST and write the manifest in exactly the schema that script expects; if the script's expectations are ambiguous or it is broken, return blocked rather than guessing.
3. A demonstrated restoration: add a detached temporary worktree at the base commit (pick a fresh path under /private/tmp/, not /private/tmp/vl-recovery-verify which is reserved for verification), `git stash apply` the ref there, run `pnpm exec tsx scripts/verify-recovery-snapshot.ts --root <worktree> --base 622375603a375abb20146dafb4558515b033ad31 --manifest docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json`, then remove that worktree.

The manifest itself is created by this unit, so it must NOT be listed inside itself as a captured path unless the verify script requires otherwise — follow the script's semantics.

## File contract

- `docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json`

## Forbidden moves

- Do not edit, format, move, stage, or delete any existing file, tracked or untracked. Why: this unit's entire purpose is preservation; every dirty byte must remain byte-identical for later curation units to rely on.
- Do not use `git stash push`, `git add` against the real index, `git reset`, `git checkout --`, or any command that mutates the real working tree or real index. Use a temporary GIT_INDEX_FILE for all tree-building.
- Do not touch the network. Why: the charter's ingest boundary is closed; everything needed is local.
- Do not modify scripts/verify-recovery-snapshot.ts or any other script. Why: the verifier must stay independent of the thing it verifies.

## Verification

```verify
git rev-parse HEAD | grep -q 622375603a375abb20146dafb4558515b033ad31
git cat-file -e 'refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810^{commit}'
test -s docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json
git worktree add --detach /private/tmp/vl-recovery-verify 622375603a375abb20146dafb4558515b033ad31 && git -C /private/tmp/vl-recovery-verify stash apply refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810 && pnpm exec tsx scripts/verify-recovery-snapshot.ts --root /private/tmp/vl-recovery-verify --base 622375603a375abb20146dafb4558515b033ad31 --manifest docs/goals/legacy-react-angular-production-readiness/notes/pre-goal-recovery-manifest.json; rc=$?; git worktree remove --force /private/tmp/vl-recovery-verify >/dev/null 2>&1; exit $rc
```

## Blocked permission

If HEAD is not the pinned commit, the recovery ref already exists, /private/tmp/vl-recovery-verify is already registered or non-empty, scripts/verify-recovery-snapshot.ts is missing/broken/ambiguous about the manifest schema, or you would need to write any file outside the contract, return status "blocked" with the exact question or finding in open_questions instead of improvising.
