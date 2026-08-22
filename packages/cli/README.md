<p align="center">
  <img src="https://raw.githubusercontent.com/compiled-run/versionless/main/docs/assets/versionless-mascot.png" alt="The versionless mascot: a happy little file folder on a green scribble" width="240">
</p>

# versionless

Migrate old React and Angular apps to modern stacks, and *prove* the migrated app still behaves like the original.

## What is this?

You know the app: it works fine, but it's pinned to React 16, or Angular 8, or a webpack from another era. Nobody wants to touch it. Every "just upgrade it" attempt turns into a month of whack-a-mole.

versionless is a command-line tool for exactly that app. Point it at the code, and it does three things:

1. **Reads** the app: framework, version, builder, what era of Node it expects.
2. **Rewrites** it into a separate folder (a *lane*). It never writes into your original app. Not one byte.
3. **Proves** the result: installs, builds, then drives both the old app and the new one through the same journeys in a real browser, checking they behave the same.

Lots of tools can rewrite code. versionless won't call a migration done until a browser has watched the migrated app act like the original.

## Install

```sh
npm install -g versionless
```

Requires Node 22 or newer.

## Try it

```sh
# What is this app? (read-only, can't hurt anything)
versionless analyze <app-root>

# What would change? (composes the plan, writes nothing)
versionless plan <app-root>

# Do it: into a separate lane, never into the app itself
versionless migrate <app-root> --out <lane>

# Run every offline self-check in one summary
versionless verify

# What is actually supported? (generated from real runs, never hand-edited)
versionless supported-matrix
```

Every command takes `--help` and `--json`. Start with `analyze`.

## The one honest rule

**versionless refuses instead of guessing.** If it hits something it doesn't understand (a framework it has no adapter for, a lockfile from a different package manager), it stops and tells you by name:

```
refused: install.lockfile-foreign
```

That's not a crash. Every refusal has a name, every name is counted, and some can be lifted with an explicit flag (like `--allow-foreign-lockfile`). You make that call, out loud, and it's recorded in the run's receipt. Nothing is silently assumed on your behalf.

## What "supported" means

The support table is generated from receipts of real migrations: a real app, really migrated, really witnessed in a browser. If it's not in the matrix, it's not supported, and unknown is reported as *unknown*, never "probably fine." Run `versionless supported-matrix` to see where things stand.

## Going deeper

The full evidence program (every proof, every refusal, every receipt) lives in the repository: [github.com/compiled-run/versionless](https://github.com/compiled-run/versionless).

> **Status:** active evidence program. This is evidence, not certification; the generated reports state every boundary precisely.
