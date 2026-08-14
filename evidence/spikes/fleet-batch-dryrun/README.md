# SPIKE B — batch operator dry run

Unit `nts-t004/spike-b-batch-operator-dryrun`. Measured 2026-08-14.

This page prices two things a 300-application fleet schedule needs, neither of which had been measured before: the machine time the operator surface costs per application, and whether the per-application work tree can be set aside once its receipt is published.

## What was timed, and what was not

- timed: analyze — the operator detection flow, over an application root already on disk
- timed: plan — the operator composition flow, which re-runs detection and then composes the frozen adapter’s changeset
- timed: migrate — the operator apply flow, which re-runs detection and composition and then writes the changeset into an empty scratch lane
- not timed: dependency acquisition and install
- not timed: the migrated build
- not timed: witness journey authoring, calibration, and the browser passes
- not timed: receipt schema authoring and publication

The recorded per-vertical cost of roughly 9–10 units conflates authoring with execution. What is timed here is only the operator surface, which is the part a batch runner repeats unattended; the unmeasured stages above are where the recorded per-vertical cost mostly sits.

Method: Each stage is `runOperatorCommand` from packages/cli/src/operator/flows.ts, called exactly as a shell operator would call it, timed with process.hrtime.bigint() around the awaited call and nothing else. The read-only stages are timed over three repetitions and reported as a median and a best; the write stage runs once per application, because the apply flow refuses a lane that already carries files. No authoring, editing or waiting happens inside a timed region.

Host: node v24.15.0 on darwin-arm64, 18 logical CPUs, 48 GiB. one process, one application at a time; nothing below ran in parallel.

## Per-application machine time

| application | lineage | analyze | plan | migrate | one operator pass | outcome |
|---|---|---|---|---|---|---|
| `react-cypress-rwa` | react | 0.5 ms | 0.7 ms | 1.2 ms | 1.2 ms (migrate) | migrated-to-lane |
| `react-hospitalrun` | react | 0.5 ms | 0.6 ms | 0.9 ms | 0.9 ms (migrate) | migrated-to-lane |
| `react-linkfree-v0-72-0` | react | 0.4 ms | 0.7 ms | 0.8 ms | 0.8 ms (migrate) | migrated-to-lane |
| `react-papercups-v1-0-0` | react | 0.3 ms | 0.5 ms | 0.8 ms | 0.8 ms (migrate) | migrated-to-lane |
| `react-memos-v0-1-3` | react | 0.3 ms | 0.5 ms | 0.6 ms | 0.6 ms (migrate) | migrated-to-lane |
| `react-mycrypto` | react | 0.3 ms | refused | not-attempted | 0.3 ms (analyze) | refused-at-plan |
| `react-boilerplate-v4` | react | 0.3 ms | refused | not-attempted | 0.3 ms (analyze) | refused-at-plan |
| `angular-pigallery2` | angular | 0.4 ms | 141.3 ms | 111.3 ms | 111.3 ms (migrate) | migrated-to-lane |
| `angular-eshop-webspa` | angular | 0.5 ms | 39.6 ms | 37.8 ms | 37.8 ms (migrate) | migrated-to-lane |
| `angular-pigallery2-operator-lane` | angular | 0.4 ms | 7.6 ms | 6.5 ms | 6.5 ms (migrate) | migrated-to-lane |
| `angular-realworld-v15-to-v16` | angular | 0.4 ms | refused | not-attempted | 0.4 ms (analyze) | refused-at-plan |
| `angular-realworld-production-parity` | angular | 0.4 ms | refused | not-attempted | 0.4 ms (analyze) | refused-at-plan |

The three stages are not additive. `plan` re-runs detection, and `migrate` re-runs detection and composition, so one operator pass costs the deepest stage that completed rather than the sum of the row.

### Refusals, quoted

- react-mycrypto — plan: React plan: this tree declares neither react-scripts nor a Vite configuration, so no frozen React adapter claims it. This flow refuses rather than guessing an origin toolchain.
- react-boilerplate-v4 — plan: React plan: this tree declares neither react-scripts nor a Vite configuration, so no frozen React adapter claims it. This flow refuses rather than guessing an origin toolchain.
- angular-realworld-v15-to-v16 — plan: Angular tsconfig migration: the configuration appears to carry comments. This capability rewrites strict JSON only; a JSONC configuration would lose its comments silently, so it is refused instead.
- angular-realworld-production-parity — plan: Angular tsconfig migration: the configuration appears to carry comments. This capability rewrites strict JSON only; a JSONC configuration would lose its comments silently, so it is refused instead.

4 of 12 roots were refused by name rather than migrated. A refusal is an outcome a batch runner has to schedule for, and it is cheap: a refusing root costs the reading above it, not a migration.

## Extrapolation to 300 applications

| population | applications measured | per application (median) | per application (mean) | serial at 300 |
|---|---|---|---|---|
| measured fleet, every outcome | 12 | 0.8 ms | 13.4 ms | 4.0 s (0.07 min) |
| applications whose plan composed and migrated | 8 | 1.0 ms | 20.0 ms | 6.0 s (0.10 min) |
| applications the flows refused | 4 | 0.3 ms | 0.3 ms | 0.1 s (0.00 min) |
| React lineage | 7 | 0.8 ms | 0.7 ms | 0.2 s (0.00 min) |
| Angular lineage | 5 | 6.5 ms | 31.3 ms | 9.4 s (0.16 min) |

| stage | applications measured | per application (median) | serial at 300 |
|---|---|---|---|
| analyze | 12 | 0.4 ms | 0.1 s |
| plan | 8 | 0.7 ms | 7.2 s |
| migrate | 8 | 1.0 ms | 6.0 s |

These projections cover the operator surface alone. They are a floor on fleet machine time rather than an estimate of the whole per-application cost, because install, build and the witness passes are not in the timed region.

### Which stages can be run side by side

- **analyze** — parallelizable across processes. Detection reads declarations out of the application tree and writes nothing into it. Two detections of two applications share no mutable state.
- **plan** — parallelizable across processes. Composition reads the tree and returns a changeset; the flow writes nothing into the application it read.
- **migrate** — parallelizable across processes, one lane per application. The apply flow refuses a lane inside the application and refuses a lane that already carries files, so two concurrent migrations with distinct lanes cannot reach the same bytes.
- **witness browser passes** — witness-serialized on one host; not measured by this spike. The determinism-under-load finding carried over from the previous goal (T010/T011) is that the gates come back green when the passes run serially and fail when they run in parallel on one host. Multi-host is therefore the only witness throughput lever, and no projection here may assume this stage parallelizes.
- **install and migrated build** — not measured by this spike. Acquisition and build were outside the timed region. Their behaviour under concurrency is not established here.

## Prune safety: can the work tree be set aside after receipt?

Application under test: `react-boilerplate-v4-composed`.
Receipt: `evidence/runs/react-boilerplate-v4-composed/t060-run.json`.
Work directory: `.versionless/work/react-boilerplate-v4-composed`.

verifyReceipt(receipt, { requireAggregate: true }) — the same function `versionless receipt:verify` calls — is run three times: with the work directory in place, with it renamed to a sibling set-aside path inside the same unversioned scratch tree, and again after it is renamed back. The absence of the directory is checked inside the middle window rather than assumed, the restore runs in a finally block, and the restored listing is compared entry by entry against the listing taken before the move. Nothing is deleted.

**Verdict: yes.** The offline verification of evidence/runs/react-boilerplate-v4-composed/t060-run.json returned the same receipt digest with .versionless/work/react-boilerplate-v4-composed absent as it did with the directory present. For this receipt the work directory is not an input to verification.

- A work directory the receipt verification does not read can be pruned once the receipt is published without losing the offline check. That is what sets the disk floor at fleet scale.
- What the floor then holds is the evidence tree, not the work tree. Re-migrating a pruned application means re-acquiring its sources and its era closure first.
- This is proven on one receipt. A receipt schema that reads a lane out of .versionless/work would behave differently and has to be checked before the policy is applied to it.

## What this does not establish

- A composed changeset is a set of edits, not a build. Nothing here establishes that any lane this spike wrote installs, compiles or emits anything.
- The timings are one host, one process, a warm page cache and one repetition count. They are a reading of this machine rather than a specification.
- The read-only stages ran three times each and the write stage once, and the repetitions were not interleaved across applications. On the two largest Angular trees the single migrate run came in below the plan median for the same tree; across a spread of roughly thirty per cent that is warm-cache variance, not migrate costing less than the composition it re-runs.
- A refusal is an outcome rather than a failure of the run. The refusing roots are counted in the projections at the cost they actually took.
- The fleet here is drawn from applications this checkout had already ingested. It is not a random sample of the target fleet and it carries whatever selection the corpus carries.
- Nothing here measures authoring. The stages that dominate the recorded per-vertical cost — witness journey authoring, calibration and the browser passes — were not run.
- The parallelizability readings for the three operator stages are read off what the flows do to disk, not measured under load. Only the witness serialization is backed by a load measurement, and that one was made by an earlier unit rather than by this spike.
- A passing receipt verification is a hash-integrity check over published artifacts. It is not a re-run of the migration and it does not establish that the application still builds.
- This proof covers one application’s canonical receipt. It is not a statement about every receipt schema this repository carries.
- Moving the directory aside proves the verification does not read that path. It does not prove that no other tool in this repository reads it.
- The directory moved aside holds 7571741 bytes, while the largest work areas in this checkout hold three orders of magnitude more. What the move establishes is that the verification never resolves a path under the work tree, which does not depend on how much was moved — but it is still one directory rather than a survey.

## Standing bounded context

The block below is the derived support matrix, read out of the verified trust package and rendered by the same renderer the `supported-matrix` flow uses. Every outcome string, boundary, prevalence figure and counting note in it is quoted exactly as the record carries it. It is reproduced here so that no number above is read outside the bounds the evidence sets.

```
Versionless derived support matrix
source: evidence/trust/current/enterprise-report.json (trust package digest 572a0f061c731e57460c9c21644632fe43646d34a780dc47e739dc09e838768a)
certification: not-certified
  assurance: This package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation.
  integrity: hash-only; authenticity is not established
  slsaLevel: not-claimed

derivation: Every green cell below is filtered out of the Judge counting ledger the corpus derived and cross-checked against that corpus numerator and denominator. No cell is listed by hand, and a cell edited into this record fails re-derivation.

angular: 4 counted of 4 proven cells
  - angular-factoriolab — angular-factoriolab
    acceptance: Judge-accepted: Angular CLI 10.1 to 16.2 browser-builder across six majors with application source really rewritten, proven in the browser with byte-identical mutation restoration.
    witness receipt: evidence/runs/witness-angular-factoriolab/receipt.json
    vertical angular-factoriolab: runtime node-12.14.1-to-node-16.20.2, bundler angular-cli-10.1-browser-builder-to-angular-16.2-browser-builder, migration production-readiness-direct-witness-angular10-to-angular16-browser-builder, browser proof verified-direct-witness, behavior digest 77d9bf5fe4d72a7db2ca5dc760fd1ce3bd13a936b765b85bfa6cb0621022ae42
  - angular-jira-clone — angular-jira-clone
    acceptance: Judge-accepted: Angular CLI 13.2 custom-webpack to 16.2 browser-builder, absorbing a non-default builder and rewriting application source, proven in the browser on a second independent Angular application.
    witness receipt: evidence/runs/witness-angular-jira-clone/receipt.json
    vertical angular-jira-clone: runtime node-16.20.2, bundler angular-cli-13.2-custom-webpack-browser-builder-to-angular-16.2-browser-builder, migration production-readiness-direct-witness-angular13-to-angular16-browser-builder, browser proof verified-direct-witness, behavior digest 18e281d93e0f50a632ed0a4c9bc613e9b5601ca0a5ec68a36c578e6ed6620308
  - angular-tiny-translator-v0-12-0 — angular-tiny-translator
    acceptance: Judge-accepted (T016 re-freeze audit): an eleven-major Angular CLI 1.5.4 to 16.2 browser-builder lift with application source really rewritten, proven in the browser with byte-identical mutation restoration. Its era-defect service-worker registration stays recorded rather than masked and does not disqualify the migration from the Angular numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.
    witness receipt: evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json
    vertical angular-tiny-translator-v0-12-0: runtime node-8.9.3-to-node-16.20.2, bundler angular-cli-1.5.4-webpack-3.8.1-to-angular-16.2-browser-builder, migration production-readiness-direct-witness-angular5-to-angular16-browser-builder, browser proof verified-direct-witness, behavior digest 890ddd697619de1273c1bddf5cb504d7cad9eeb54c4503d8a458f3c72bd6405f
  - angular-super-productivity-v2-13-15 — angular-super-productivity
    acceptance: Judge-accepted (T016 re-freeze audit): an eight-major Angular CLI 8.3.4 to 16.2 browser-builder lift with application source really rewritten, proven in the browser. Its declared cross-lane appearance differences and unseeded Sass random() build instability across the supersede boundary stay recorded rather than masked and do not disqualify the migration from the Angular numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.
    witness receipt: evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json
    vertical angular-super-productivity-v2-13-15: runtime node-12.14.1-to-node-16.20.2, bundler angular-cli-8.3.4-webpack-4-to-angular-16.2-browser-builder, migration production-readiness-direct-witness-angular8-viewengine-to-angular16-browser-builder, browser proof verified-direct-witness, behavior digest d90ec2ca7e8ea609845518300d0b1e7d9f4908100bdabcc15b44879931dd380a

react: 6 counted of 6 proven cells
  - react-boilerplate — react-boilerplate
    acceptance: Judge-accepted: webpack 4.30.0 to Vite 8.0.16 across Node 16 to Node 24 with a direct-Witness browser proof, byte-identical mutation restoration, and a current zero-service-worker policy reconciliation on the same immutable source.
    witness receipt: evidence/runs/witness-react-boilerplate/receipt.json
    vertical react-boilerplate-v4: runtime Node 16.20.2 EOL compatibility sandbox, bundler webpack 4.30.0, migration not-recorded-in-the-corpus-record, browser proof not-recorded-in-the-corpus-record, behavior digest not-recorded-in-the-corpus-record
    vertical react-boilerplate-v4-node24: runtime Node 24.15.0 darwin-arm64, bundler webpack 4.47.0, migration not-recorded-in-the-corpus-record, browser proof not-recorded-in-the-corpus-record, behavior digest not-recorded-in-the-corpus-record
    vertical react-boilerplate-v4-vite8: runtime Node 24.15.0 darwin-arm64, bundler Vite 8.0.16, migration not-recorded-in-the-corpus-record, browser proof not-recorded-in-the-corpus-record, behavior digest not-recorded-in-the-corpus-record
    vertical react-boilerplate-v4-data-flow: runtime Node 24.15.0 darwin-arm64, bundler Vite 8.0.16, migration not-recorded-in-the-corpus-record, browser proof not-recorded-in-the-corpus-record, behavior digest not-recorded-in-the-corpus-record
    vertical react-boilerplate-v4-composed: runtime Node 16.20.2 legacy / Node 24.15.0 target, bundler webpack 4.30.0 / Vite 8.0.16, migration not-recorded-in-the-corpus-record, browser proof not-recorded-in-the-corpus-record, behavior digest not-recorded-in-the-corpus-record
  - react-papercups-v1-0-0 — papercups
    acceptance: Judge-accepted: a create-react-app 3.4.1 production application really moved to a Vite 8 build, with behavioral parity and mutation restoration proven in the browser rather than inferred from the build.
    witness receipt: evidence/runs/witness-react-papercups/receipt.json
    vertical react-papercups-v1-0-0: runtime node-16.20.2-to-node-24.15.0, bundler webpack-4.42.0-to-vite-8.0.16, migration create-react-app-3.4.1-to-vite8-build, browser proof verified-direct-witness, behavior digest a2d4dbb6f844dfb8ee2d78cfc64e9981b6a91186030f345a7e6ffb9975eb9917
  - react-hospitalrun — react-hospitalrun
    acceptance: Judge-accepted: a create-react-app 3.4.4 application on Node 12 reached a booting Vite 8 build on Node 24, and its baseline/migrated service-worker difference is recorded rather than masked, so the cell is counted with its difference visible.
    witness receipt: evidence/runs/witness-react-hospitalrun/receipt.json
    vertical react-hospitalrun: runtime node-12.14.1-to-node-24.15.0, bundler webpack-4.42.0-to-vite-8.0.16, migration create-react-app-3.4.4-to-vite8-build-and-boot, browser proof verified-direct-witness, behavior digest bb87c861e83fe5cdce99ba3c2ea6ef0523a66f4c1a75d8d8be0f10411c7b6fed
  - react-memos-v0-1-3 — react-memos
    acceptance: Judge-accepted (T016 re-freeze audit): a substantive old-Vite-origin React application (Vite 2.9.5 to Vite 8) really migrated with a direct-Witness browser proof and byte-identical mutation restoration. React-lineage is measured by the charter oracle regardless of origin bundler, so it counts toward the React numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.
    witness receipt: evidence/runs/witness-react-memos-v0-1-3/receipt.json
    vertical react-memos-v0-1-3: runtime node-16.20.2-to-node-24.15.0, bundler vite-2.9.5-to-vite-8.0.16, migration production-readiness-direct-witness-old-vite-origin-to-vite8, browser proof verified-direct-witness, behavior digest d5e08daffeb7765ba6722700587762a702fe74b5357f32fa4d069512014ad934
  - next-killedbygoogle-v3-0-0 — next-killedbygoogle-v3-0-0
    acceptance: Judge-accepted (T016 charter ruling): Next.js-on-React is React-lineage per the charter completion target ("six React-lineage applications ... at least one legacy Next.js app"), so this legacy-Next v3.0.0 vertical is the legacy-Next member of the six and counts toward the React numerator. It carries the informational legacy-next sub-tag; its baseline/migrated document-delivery difference stays recorded rather than masked, and the retired olderNext separate numerator folds into React here.
    witness receipt: evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.json
    vertical next-killedbygoogle-v3-0-0: runtime node-16.20.2, bundler next-12.0.10-vendored-webpack-5-to-vite-8.0.16-rolldown, migration production-readiness-direct-witness-next12-static-export-to-vite8-client-build, browser proof verified-direct-witness, behavior digest 240554452bac31af556f6888c0fdb3a5523ff6cc6e839a5a345d64d8204a480f
  - react-linkfree-v0-72-0 — react-linkfree
    acceptance: Judge-accepted (T016 re-freeze audit): a create-react-app 5 application really migrated to a Vite 8 build with a direct-Witness browser proof and byte-identical mutation restoration. Its synthetic profile corpus is the recorded boundary of the claim, published rather than hidden, and does not disqualify the migration from the React numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.
    witness receipt: evidence/runs/witness-react-linkfree-v0-72-0/receipt.json
    vertical react-linkfree-v0-72-0: runtime node-16.20.2-to-node-24.15.0, bundler webpack-5.73.0-to-vite-8.0.16, migration production-readiness-direct-witness-create-react-app-5-to-vite8, browser proof verified-direct-witness, behavior digest 09432cbf2578c35c1d04e74219e8411c075505943914fbe91b197c2da46929a1

demoted cells
  - angular-realworld-v15-to-v16 (angular): Judge-declined and demoted from the denominator: the migration changed applicationFilesChanged=0 application files, so it is an Angular 15-to-16 dependency version bump rebuilt under AOT rather than a proven application migration. Its browser-proof receipt stays verified and retained; it is excluded from the Angular denominator rather than counted, which is why the Angular total is four non-demoted cells and not five.

holdouts
  - holdout-react-cypress-rwa — cypress-realworld-app (react)
    outcome: passed
    counting: This holdout passed, and it is still counted in no lineage numerator: a passing holdout shows the frozen adapter carrying one further application, not a migrated-application product count. It is published rather than folded into any numerator.
    reason: This is a holdout, not a certification: it shows the frozen adapter carrying one further application end to end, not generic support.
    receipt: evidence/runs/holdout-react-cypress-rwa/green-2026-08-13/receipt.json (76f0b5bd0d8a3fa0596d3c5d190c764ee7402f4e5c27870d36bdb3fa5f04a73e)
  - holdout-angular-eshop-webspa — eShopOnContainers WebSPA (angular)
    outcome: witness-passed-on-bounded-anonymous-catalog-surface
    counting: Never counted in any lineage numerator by this record. The migrated production build is green and repeatable, and the Witness is green on the anonymous catalog surface — twice per lane, one parity digest, with a mutation-red and byte-restore proof under it. What that leaves unproven is stated beside it: every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent. Whether a holdout proven on a bounded surface should ever reach a numerator is the Judge's decision, taken on the Judge's ledger and not here. The install RED under the frozen f1a63359 composite is retained beside all of it as the record of what the frozen adapter did.
    reason: every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent
    proven surface: anonymous-catalog
    not covered: identity — out-of-surface
    not covered: basket — out-of-surface
    not covered: orders — out-of-surface
    not covered: campaigns — out-of-surface
    not covered: signalr — not-reached
    not covered: text-entry — not-tested
    not covered: drag — not-tested
    receipt: evidence/runs/holdout-angular-eshop-webspa/receipt.json (fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9)

permanent falsification history
  - holdout-angular-pigallery2 — pigallery2, lane migrated, state red, frozen adapter 4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7, receipt evidence/runs/holdout-angular-pigallery2/receipt.json (39a133ff97c37622a4a1821f20e7c442c9bc22ed7597a3e73cbd31323ab2bb10)
  - holdout-angular-eshop-webspa — eShopOnContainers WebSPA, lane migrated-at-install-under-frozen-composite, state red, frozen adapter f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012, receipt evidence/runs/holdout-angular-eshop-webspa/receipt.json (fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9)
  - holdout-react-cypress-rwa — cypress-realworld-app, lane migrated, state red, frozen adapter d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77, receipt evidence/runs/holdout-react-cypress-rwa/receipt.json (7ec6f18b27d2967cd533ba89505e8a76590c1866aec8bd7a8d8543cd87743aae)

declared boundaries
  amendment.amends: angular-16-pre-ivy-only-dependency
  amendment.appendOnly: true
  amendment.declaredBy: lrapr-t022 boundary ruling, follow-up ruling (Judge, 2026-08-14) after the gate-zero screen
  amendment.immutabilityNote: Appended beside the declaration, never merged into it. The pigallery2 receipt that established the boundary is unchanged, its digest is unchanged, and the boundary condition, mechanism, certification language and non-claims are unchanged. This record only adds reading rules, prevalence and the population statement.
  amendment.populationStatement: Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.
  amendment.prevalence.applicationsExamined: 6
  amendment.prevalence.applicationsObservedWithTheCondition: 5
  amendment.prevalence.distinctCondition.application: eShopOnContainers
  amendment.prevalence.distinctCondition.condition: first-party-successor removal
  amendment.prevalence.distinctCondition.count: 1
  amendment.prevalence.distinctCondition.countedInPrevalence: false
  amendment.prevalence.distinctCondition.why: The failing dependency, @angular/http, was removed from the framework with a first-party successor named in its registry deprecation metadata, whose bytes are Ivy at the target cell. That is not a dead third-party library with no successor to align to, so it is a different — and narrower — condition than the boundary describes.
  amendment.prevalence.distinctionRationale: A tested failure and a screened failure are different strengths of evidence and are never merged into one number: the tested one measured a build, the screened ones read published metadata. Collapsing them, or counting the distinct sixth condition, would overstate what was measured.
  amendment.prevalence.published: 5-of-6
  amendment.prevalence.screened.applications[0]: cyclos4-ui
  amendment.prevalence.screened.applications[1]: ngx-starter-kit
  amendment.prevalence.screened.applications[2]: tabby
  amendment.prevalence.screened.applications[3]: coreui-free-angular-admin-template
  amendment.prevalence.screened.count: 4
  amendment.prevalence.screened.evidence: docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md
  amendment.prevalence.screened.method: boundary-only gate-zero screen from pinned manifests, npm registry documents and published bytes, with the import site found in the pinned source; never installed, built, migrated or trialled
  amendment.prevalence.screened.strength: screened-and-failed
  amendment.prevalence.sourceRecord: docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md
  amendment.prevalence.statement: The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.
  amendment.prevalence.tested.applications[0]: pigallery2
  amendment.prevalence.tested.count: 1
  amendment.prevalence.tested.evidence: evidence/runs/holdout-angular-pigallery2/receipt.json
  amendment.prevalence.tested.method: ingested at a pin, baseline lane run green in the era toolchain, migrated lane run to a RED with no artifact ever produced
  amendment.prevalence.tested.strength: tested-and-failed
  amendment.publishedBy: lrapr-t023/u3-boundary-amend-candidate3-acquire
  amendment.readingRules[0].evidenceRequired[0]: registry deprecation metadata on the dependency that names the successor package
  amendment.readingRules[0].evidenceRequired[1]: the named successor's published Ivy bytes at the target cell
  amendment.readingRules[0].id: successor-across-names
  amendment.readingRules[0].instance.capturedBy: lrapr-t023/u3-boundary-amend-candidate3-acquire
  amendment.readingRules[0].instance.consentId: VL-LEGACY-CORPUS-2026-08-10
  amendment.readingRules[0].instance.deprecationMessage: Package no longer supported. Use @angular/common instead, see https://angular.io/guide/deprecations#angularhttp
  amendment.readingRules[0].instance.distTags.latest: 7.2.16
  amendment.readingRules[0].instance.distTags.next: 8.0.0-beta.10
  amendment.readingRules[0].instance.distTags.v4-lts: 4.4.7
  amendment.readingRules[0].instance.distTags.v5-lts: 5.2.11
  amendment.readingRules[0].instance.distinctDeprecationMessages: 1
  amendment.readingRules[0].instance.nameDifference: The registry string names the package `@angular/common`; the successor API surface inside it is the `@angular/common/http` entry point. The ruling paraphrased the entry point, the registry names the package, and both point at the same first-party successor.
  amendment.readingRules[0].instance.newestPublishedVersion: 7.2.16
  amendment.readingRules[0].instance.package: @angular/http
  amendment.readingRules[0].instance.packumentModified: 2022-06-12T14:41:58.643Z
  amendment.readingRules[0].instance.sources[0].accept: application/json
  amendment.readingRules[0].instance.sources[0].bytes: 3086
  amendment.readingRules[0].instance.sources[0].sha256: f3eeae03e225e29b6a877313eaedac08ac8eb37d964118ce88697039061faadf
  amendment.readingRules[0].instance.sources[0].status: 200
  amendment.readingRules[0].instance.sources[0].url: https://registry.npmjs.org/@angular/http/7.2.16
  amendment.readingRules[0].instance.sources[1].accept: application/vnd.npm.install-v1+json
  amendment.readingRules[0].instance.sources[1].bytes: 253997
  amendment.readingRules[0].instance.sources[1].sha256: fd36610eb553adacaa5110f5ebcb269533d3a1cc3e02eda9fbd4e29834d3a76c
  amendment.readingRules[0].instance.sources[1].status: 200
  amendment.readingRules[0].instance.sources[1].url: https://registry.npmjs.org/@angular/http
  amendment.readingRules[0].instance.successorEntryPoint: @angular/common/http
  amendment.readingRules[0].instance.successorPackageNamed: @angular/common
  amendment.readingRules[0].instance.versionsCarryingThisDeprecation: 122
  amendment.readingRules[0].instance.versionsPublished: 252
  amendment.readingRules[0].kind: ecosystem-availability-fact
  amendment.readingRules[0].neverAnAdapterCapabilityFact: The rule reads published registry metadata and published bytes only. It says nothing about whether the frozen adapter carries the corresponding migration; that is what a holdout run measures, and a RED there is valid falsification rather than a boundary.
  amendment.readingRules[0].precedent: Successor readings across package names are the boundary mechanism the record already used: the G3 ngx-toastr successor-line table read a successor line rather than a same-name version bump.
  amendment.readingRules[0].rule: A successor reading counts across package names: a dependency has a published Ivy successor when registry deprecation metadata names the successor and that named successor ships published Ivy bytes, even where the successor carries a different package name than the dependency it replaces.
  amendment.readingRules[1].evidenceRequired[0]: the pinned compilation graph, rooted at the application entry point
  amendment.readingRules[1].evidenceRequired[1]: the absence of any import site for the dependency in that graph
  amendment.readingRules[1].id: declared-but-never-imported-is-not-active-use
  amendment.readingRules[1].instance.application: eShopOnContainers
  amendment.readingRules[1].instance.declaredVersion: 6.0.0-beta.5
  amendment.readingRules[1].instance.evidence: The WebSPA compilation graph is 60 TypeScript files rooted at Client/main.ts; main.ts, app.module.ts and shared.module.ts carry no preboot import, and the tree has no server-side-rendering entry (main.server.ts / app.server.module.ts are absent), which is the only thing preboot exists for.
  amendment.readingRules[1].instance.package: preboot
  amendment.readingRules[1].instance.verdict: declared but never imported — not active use, so it does not fail the boundary
  amendment.readingRules[1].kind: ecosystem-availability-fact
  amendment.readingRules[1].neverAnAdapterCapabilityFact: The rule is settled by reading the pinned source for import sites, never by asking what a migration would have to do with the dependency.
  amendment.readingRules[1].rule: A dependency that a manifest declares but the application never imports is not in active application use, and therefore cannot fail the boundary. Active use means an import site in the pinned application source on the build path.
  amendment.schemaVersion: versionless.angular-pre-ivy-boundary-amendment.v1
  cell: angular-16-browser-builder
  certification: not-certified: this cell is declared unsupported, not tested-and-failed-once
  condition: pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell
  declaredBy: lrapr-t022 boundary ruling (Judge, 2026-08-14)
  id: angular-16-pre-ivy-only-dependency
  instanceEvidence.application: pigallery2
  instanceEvidence.digest: 39a133ff97c37622a4a1821f20e7c442c9bc22ed7597a3e73cbd31323ab2bb10
  instanceEvidence.importSites: 6
  instanceEvidence.libraries: 3
  instanceEvidence.receipt: evidence/runs/holdout-angular-pigallery2/receipt.json
  instanceEvidence.wall[0].importSites[0]: frontend/app/app.module.ts:14
  instanceEvidence.wall[0].importSites[1]: frontend/app/ui/gallery/map/map.gallery.component.ts:7
  instanceEvidence.wall[0].importSites[2]: frontend/app/ui/gallery/map/lightbox/lightbox.map.gallery.component.ts:16
  instanceEvidence.wall[0].lastPublishedVersion: 1.1.0
  instanceEvidence.wall[0].library: @yaga/leaflet-ng2
  instanceEvidence.wall[1].importSites[0]: frontend/app/app.module.ts:31
  instanceEvidence.wall[1].importSites[1]: frontend/app/model/network/network.service.ts:4
  instanceEvidence.wall[1].lastPublishedVersion: 4.0.0
  instanceEvidence.wall[1].library: ng2-slim-loading-bar
  instanceEvidence.wall[2].importSites[0]: frontend/app/app.module.ts:41
  instanceEvidence.wall[2].lastPublishedVersion: 2.0.5
  instanceEvidence.wall[2].library: jw-bootstrap-switch-ng2
  lineage: angular
  mechanism: Angular 16 removed ngcc, so ViewEngine bytes cannot be consumed at this cell, and a library whose last published version is pre-Ivy has no successor to align to. Carrying such an application would require editing its source at the import sites, which is an application change rather than a migration the engine can perform.
  nonclaims[0]: No claim that every application carrying a pre-Ivy-only dependency is unmigratable in general: the boundary is declared at the Angular 16 target cell, which is the only Angular cell this engine has.
  nonclaims[1]: No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.
  nonclaims[2]: No claim that the boundary excuses the pigallery2 RED. The RED is permanent falsification evidence and is published unchanged alongside this declaration.
  publishedBy: lrapr-t023/u1-boundary-publish-refreeze
  state: unsupported

boundary prevalence
  published: 5-of-6
  The no-successor pre-Ivy condition was observed in 5 of 6 independently selected webpack-era Angular applications: 1 tested-and-failed and 4 screened-and-failed. The sixth, eShopOnContainers, carries a first-party-successor removal, which is a distinct condition and is not counted in the 5.
  Any application clearing this gate is, by construction, drawn from a narrower and younger-dependency population than the webpack-era enterprise fleet this goal targets: its entire third-party Angular surface must still be maintained or have a published successor. A GREEN holdout therefore speaks for the supported cell only, and is not evidence about the fleet shape the 5-of-6 prevalence describes.

out of matrix: 50 experimental and 8 cross-proven of 58 capabilities
  A capability is claimed general, and therefore in the matrix, only once at least 2 independent applications prove it. The capabilities below are proven on fewer than that and are out of the matrix; they are named rather than silently claimed.

tranche two: No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.
```

