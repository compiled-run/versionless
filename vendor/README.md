# vendor

Dependencies this repository carries itself, because they are not published to a registry and a
fresh clone has to install from what it has. Before this directory existed, `@async/witness` was
declared `link:../witness` — an unpublished sibling checkout — and a clone of this repository alone
could not load the CLI at all.

- `async-witness-0.8.0.tgz` — `@async/witness` 0.8.0, produced by `pnpm pack` in
  `/Users/jacksm5pro/dev/open-source/witness` at commit `83b86de`, on 2026-08-18.
  sha256 `c15d44fac722e7f0eb1366301d093ce43910e914606fa25d83ea1c08a47f2201`.
  The manifest installs it as `file:vendor/async-witness-0.8.0.tgz`, so
  `pnpm install --frozen-lockfile` needs no registry entry and no sibling checkout.
  `packages/cli/src/witness/provenance.ts` re-hashes the tarball and the two dist files the package
  exports on every provenance check; the upstream commit above is recorded, not verified, because
  that repository is not in this tree.
  Swap for a published version when available.
