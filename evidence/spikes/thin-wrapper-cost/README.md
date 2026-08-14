# SPIKE C — the real per-application cost, measured on a never-completed application

Unit `nts-t004/spike-c-thin-wrapper-cost`. Measured 2026-08-14 on one host
(darwin-arm64, Node v24.15.0, npm 12.0.1). Machine record:
`evidence/spikes/thin-wrapper-cost/verdict.json`.

The spike was sent to price the post-industrialization per-application cost by
taking a never-completed application through the frozen React adapter and
witnessing it through the thin-wrapper path. It did not get there. What follows
is what it did measure, and where it stopped.

## Gate zero — license text at the pin

Both candidates pass, read out of the consented archive already on disk after
that archive was re-verified against the digest its ingest recorded.

| application | pinned commit | license file | sha256 | gate |
|---|---|---|---|---|
| react-shlink-web-client | `44aca4ae` | `LICENSE` (MIT License) | `249a81967c48177d9fa4672adbfdecd356aba715101780e05d54fcbd744d699c` | pass |
| react-sqlpad-v5-5-0 | `5c259dd7` | `LICENSE.md` (#The MIT License) | `93dec0b7b1f9775cdcb15603a6c1d8829164ac72fa01a4679845c85ee76421da` | pass |

The primary passed, so no license fallback was taken. `react-sqlpad-v5-5-0` was
read only as a comparator.

## Where it stopped

Two walls, both before the stage the ~3u estimate describes.

**The frozen React adapter refuses the application.** `analyze` reads it as React
with builder `unknown`; `plan` and `migrate` both refuse:

> React plan: this tree declares neither react-scripts nor a Vite configuration, so no frozen React adapter claims it. This flow refuses rather than guessing an origin toolchain.

shlink-web-client v2.3.0 is an ejected create-react-app: it carries its own
webpack 4 configuration under `config/` and does not declare `react-scripts`.
This is a named gap. No frozen subtree was edited.

**The era cell refuses the baseline.** With one Node era cell installed on this
host, webpack 4 fails first on hashing —
`error:0308010C:digital envelope routines::unsupported` — which
`NODE_OPTIONS=--openssl-legacy-provider` answers, and then the build stops for
good on the native dependency:

> ./src/common/react-tagsinput.scss — Error: Node Sass does not yet support your current environment: OS X Unsupported architecture (arm64) with Unsupported runtime (137)

The corpus source is immutable, so swapping node-sass for dart-sass is not
available, and no second era cell is installed.

## The ledger

| stage | machine | operator | outcome |
|---|---|---|---|
| license pre-screen (both) | 3 s | ~10 min | pass |
| ingest completion (both) | 2 s | ~2 min | source complete both; no dependency closure for the primary |
| baseline install | 20 s over 2 attempts | ~3 min | installed after one refusal (`EALLOWREMOTE`) and one operator decision (`--allow-remote all`) |
| baseline production build | 10 s over 2 attempts | ~4 min | not built |
| migrate under the frozen adapter | 1.04 s | ~2 min | refused |
| migrate, admitted comparator (sqlpad client) | 0.95 s | ~1 min | materialised: 1 file written, 167 copied |
| witness, thin-wrapper path | 0 | 0 | not executed |
| **total** | **37 s** | **~22 min** | **0 builds, 0 witness passes, 0 new TypeScript lines** |

Machine seconds are wall clock around the awaited command and nothing else.
Operator seconds are the acts between commands — reading a refusal, choosing a
remedy — and are never folded into machine time.

## What this says about ~3u per application

`threeUnitsCredible: false`, and the reason matters more than the flag: the
claim was not reached rather than refuted. An application drawn from the
never-completed set spent its whole budget on the stages *before* the one the
estimate covers. Any per-application average that quotes only the applications
that made it through is quoting a filtered population.

Four costs remain manual, and this run priced the first three:

1. **Era-cell provisioning** — two failed builds, ~4 minutes, no remedy on this host.
2. **Install policy** (remote tarballs, install scripts) — one failed install, ~3 minutes; both mechanisable as policy, both judgment today.
3. **Adapter admission** for trees outside the react-scripts/Vite declaration — ~2 minutes, then the application leaves the pipeline.
4. **The migrated tree is not yet installable from the CLI.** On the admitted comparator, `migrate --materialize` wrote one file (the entry document) and copied 167; the lane's `package.json` still declares `react-scripts ^3.4.1` and carries no Vite configuration. The Vite-era rewrite for the applications already completed lives in per-application fixture code (18 to 318 lines each).

Witness journey authoring and calibration were not touched here, so T002's
reading of that stage stands unrevised.

## The thin-wrapper floor, as inventory

The pattern this spike was sent to price is real on disk — `react-dejavu-run.ts`
is 61 lines and `angular-fuxa-run.ts` 67, over the 7,453-line generic harness,
against 235 to 436 lines for the earlier per-application wrappers. That is
inventory of work already done. It is not evidence that a new application
reaches that floor, because no new application here reached the stage where the
wrapper is written.

## Not established

- No build ran to completion, so nothing here establishes that either application builds on any era cell.
- No witness pass ran, so nothing here establishes browser behaviour, parity, locality, or a bounded witness outcome.
- The thin-wrapper line counts are inventory of previously completed applications, not a measurement of a new one.
- Operator timings are single-run wall clock on one host, not a distribution.
- The refusals are readings of this host and this pin; a different architecture, era cell, or npm would refuse differently, and none was tested.
- Nothing here revises the frozen adapters, the supported matrix, or any capability status; no coverage or matrix artifact was regenerated.
