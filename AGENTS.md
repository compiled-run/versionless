# Versionless contributor instructions

## Architecture

- Write every Versionless-owned executable source, test, script, and configuration file in strict TypeScript (`.ts` or `.tsx`). Declarative JSON and YAML are allowed.
- Do not add hand-maintained `.js`, `.mjs`, or `.cjs` files. Immutable legacy fixture source and generated `dist/` output are the only exceptions.
- Keep the repository as a pnpm workspace driven by the root `vite.config.ts` and Vite+ commands (`vp pack`, `vp fmt`, `vp lint`, and `vp test`).
- Keep framework-specific transforms behind framework adapters. React and Angular are the primary adapters, but core orchestration, policy, evidence, and receipt code must remain framework-neutral.

## Required utilities

- Use `magic-regexp` builders for every Versionless-owned regular expression. Do not introduce regular-expression literals or `new RegExp`. Prefer named, readable patterns and enable the `magic-regexp` Vite transform. An unavoidable third-party API boundary requires a comment explaining the exception.
- Use `pathe` for filesystem path parsing, joining, resolving, normalization, relative paths, extensions, and basenames. Do not import `node:path` or `path` directly.
- Use `ufo` for URL parsing, joining, resolving, normalization, encoding, and pathname/hash/query access. Do not hand-roll URL concatenation or use regular expressions for URL handling.
- These rules apply to implementation and tests. Do not rewrite immutable third-party legacy fixtures merely to conform to them.

## Enterprise and evidence boundaries

- Default to local and offline operation. Network access requires an explicit purpose-bound consent ID and durable evidence of the exact sources accessed.
- Never include payment data, credentials, tokens, host-specific absolute paths, usernames, or other sensitive material in generated evidence. Preserve unknown, stale, blocked, ambiguous, and not-tested states rather than strengthening claims.
- Generated receipts and trust artifacts establish reproducibility and hash integrity, not certification, legal compliance, signer authenticity, OS-wide isolation, or an unearned SLSA level.
- Keep real legacy corpus inputs immutable. Apply migrations in separate worktrees, prove browser behavior with Playwright, include a mutation-red/restoration proof, and preserve canonical receipt digests.

## Verification

- Run `pnpm exec tsc --noEmit`, `pnpm exec vp fmt`, `pnpm exec vp lint`, `pnpm exec vp pack`, and `pnpm exec vp test --project node` after source changes.
- Run fixture and receipt verification offline after the one explicitly consented ingest step.
- Do not claim a migration, runtime, bundler, or compliance cell is supported until its build, browser journey, locality checks, artifacts, and receipt independently verify.

<!-- guessless-integration:begin -->

## Structural claims about JavaScript/TypeScript

Do not assert that you have found _all_ call sites, _every_ reference, or that a symbol is safe to
delete, unless you can show a guessless receipt for that exact claim. `grep` cannot see re-exports,
aliased imports, `export * from`, or property access through a namespace object, so "all" derived
from a text search is a guess.

To price a completeness claim:

    node /Users/jacksm5pro/dev/open-source/guessless/packages/cli/dist/cli.js query envelope.json

where `envelope.json` is `{"inputs": [{"path": "...", "source": "..."}], "request": {...}}`. The
answer is a receipt whose `state` is one of:

- `complete` — the result set is exhaustive. This is the only state that licenses the word "all".
- `partial` — plus a named `unresolved` site for every place the engine could not classify. Say the
  answer is partial and name the gaps.
- `refused` — the question was not answered. It supports no claim at all.

If you have no receipt, say which sites you checked instead of saying "all". A qualified answer is
always acceptable; an unpriced "all" is not.

<!-- guessless-integration:end -->
