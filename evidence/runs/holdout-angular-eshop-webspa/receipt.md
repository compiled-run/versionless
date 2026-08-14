# eShopOnContainers WebSPA — Angular holdout ledger entry

- Outcome: **witness-passed-on-bounded-anonymous-catalog-surface** — the migrated production build completes and repeats, and its browser behaviour is indistinguishable from the era baseline **on the anonymous catalog surface**; this is a pass on that surface and not a pass on the application
- Still unproven: **every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent**
- Canonical SHA-256: fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9
- Supersedes: the `migrated-build-green-witness-pending` entry `a1c43326cb9b0f756e269d0e8339abe64df85a4ce9b709d7c612d37f8e7f0712` — This publication supersedes the witness-pending entry by reference. The three states that entry recorded are unchanged here, field for field; what is added is the Witness that entry said had not run, and the Witness itself was measured while that entry was the published one.
- Ingested by `lrapr-t023/u3-boundary-amend-candidate3-acquire`, measured green by `lrapr-t024/u4-exports-map-wiring-green-attempt`, witnessed by `lrapr-t024/u6-eshop-witness-journeys`, published by `lrapr-t024/u7-canonical-holdout-publish`
- Source: https://github.com/dotnet-architecture/eShopOnContainers at release `netcore2.2` (`a387f21029f0b2d49614d165d5384717d2398f8e`, subpath `src/Web/WebSPA`, MIT, license text sha256 `baebca0309090f4eca1b7a82c836cc91e48b2b92139c2280fb0ff69af922c2ae`), Angular 6.1.4 under Angular CLI ^6.1.5, TypeScript 2.9.2
- Target cell: `angular-16-browser-builder` — Angular 16.2, `@angular-devkit/build-angular:browser`, Node 16.20.2
- Adapter at ingestion: frozen composite `f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012`, 0 bytes changed; 0 application files hand-edited
- Authorized reopen: T023 u5 ran this application against the frozen f1a63359 composition with zero adapter bytes changed, and it was refused at install. T024 then reopened the Angular subtree under board authorization and extracted nine generic capabilities and composition repairs across four units; the build below ran against Angular subtree oid 4b6e2f44, which is the tree the 27741d9c re-freeze publishes, and the Witness ran after that re-freeze against the bytes that build emitted. The React subtree is byte-identical at 972ca801 throughout. No capability branches on this application, and no application source file was hand-edited in any unit.
- Derived from committed run evidence: `evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json` (`f9ce14109d20634ce7ac679c8dda6be2d2bf3a5f1a13087b47528840045ace86`), `evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u5-lane-install-red.log` (`6666630237c89b3c89f9df0615fdc443c687482e98728cbaca82ad6aca1b1456`), `evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-lane-install.log` (`5254287d3fda581b45ef864c53eb6a8fd83cbb7c71cbb823e56760b484e3f920`), `evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-target-build.log` (`e1d04fe579de4639e1565bac20e3c55f416fd8cfde68665dcfa10b3327bb7bf1`), `evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-target-build-run2.log` (`78eb802f319b32f4a85c8c7269f07a59141b7a8ba9a83b795120993101a79b8b`), `evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-build-inventory-run1-vs-run2.json` (`1a0cb82feff57b567739542bd674d472fdbd1cffdf4414dc5d7772e78f5bc7c9`)
- Derived from sealed Witness evidence: `evidence/runs/angular-eshop-webspa/receipt.json` (`e6835d8af995c197d24ebd2ea7fd22ae4ca3e5b04cbab0430b5c6bc3a3bf2d7b`), `evidence/runs/angular-eshop-webspa/receipt.md` (`cf16a78c4867033792fe4a6fe5a048f7f791bea6dad97cf2af189110ec14d354`), `evidence/runs/angular-eshop-webspa/witness-journeys.json` (`2e4700e1a05b3f6884162c8999c2a0969957469b34e6c5b4d20908975f8718c0`), `evidence/runs/angular-eshop-webspa/witness-mutation.json` (`a7a63482e4ff72e895b3ea775464d2c0e8a1f29f699e8e2aeec7bab445c519b1`), `evidence/runs/angular-eshop-webspa/witness-projection-ledger.json` (`581508622ee998afeac570652329528d65d207225a8df64ab294a238b66731eb`)

## Gate zero

**passed** — screen verdict `fail (@angular/http)`, ruled verdict `pass — overturned by the T022 follow-up ruling under the successor-across-names rule`, overturn recorded at docs/goals/legacy-react-angular-production-readiness/notes/t023-candidate-selection.md § Appendix A. This candidate did not clear the pre-Ivy screen on its own reading. The T022 follow-up ruling overturned that verdict under the successor-across-names rule — @angular/http has a published first-party Ivy successor — and the original screen text was left exactly as written. The pass is a ruling, and it is published as one.

## Four measured states

- Baseline (node v8.11.4 (official darwin-x64 build), bundled npm 5.6.0): **green** — WebSPA production baseline GREEN in the application's own era toolchain, byte-reproducible across two runs, with the era registry closure fully resolvable and one npm-side lockfile-rewrite finding recorded
- Migrated under the frozen `f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012` composite (`lrapr-t023/u5-frozen-adapter-migration`): **red** at install — 2 install attempts, 0 packages installed, 5 gaps itemised, no build attempted and no artifact produced. RED. The frozen engine composed a changeset for an application it had never seen and wrote it into a migrated lane; the migrated closure is refused at dependency resolution by an era-pinned community package the cell has never read, and the measured @angular/http question is answered No with the exact gate that refused it. No compiler ran, no bundle was emitted, and nothing was chased.
- Migrated after the authorized reopen (`lrapr-t024/u4-exports-map-wiring-green-attempt`): **green** — install exit 0 with no forced flag and no narrowing, 2 production build runs, byte-identical output, 25 files and 1524958 bytes emitted, 0 diagnostics remaining. G7 is closed and the migrated lane builds. `npm run build:prod` exits 0, emits twenty-five files into `wwwroot`, and a second run of the same command into a separate output is byte-identical to the first — same file names, same digests, no exceptions. The emitted stylesheet carries the toastr rules the blocked import was for, so the repair is a repair and not a silently dropped import. This is the first production build of the eShopOnContainers WebSPA on Angular 16.2 in this repository, and it was reached without one hand edit to application source, one application-name branch, or one weakened check.
- Witness after the re-freeze (`lrapr-t024/u6-eshop-witness-journeys`): **passed-on-bounded-surface** — see below.

The RED is not retracted by the green, and neither is retracted by the Witness. Each is what one adapter state did, and each is published unchanged.

## Witness — passed-on-bounded-surface

- Ran against adapter composite `27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234` **after** the re-freeze, serving migrated bytes that are byte-identical-to-the-published-green-build: lane inventory `3b859e5b508c1e3fada6dea2addc0d42120861a2364cb0cd13fa79187fc5ecad` over 25 files, recomputed here from the sealed build inventory
- 2 lanes × 2 passes = 4 runs, all normalizing to behaviour parity digest `585ae9ecdf637ace7031624b00750a3c03c7f8f900e60017c55b8ee4f973a363`; per-lane semantic digests `6dc103f894d5675893cc3b7d21f8c9fd573c10c35e1313d00cda8979c98cfc0c` (baseline) and `ed7ee72271f55ea09cebf4b1ed0240faa40312a0e4488d404553980db4a9cec7` (migrated), each stable across its two passes
- 7 recorded legs over 7 interactions, 0 console errors, 0 failed requests
- Declared same-origin projection `synthetic-fixture-evidence-data` (same-origin-bounded-loopback-api), identical across both lanes, behaviour digest `747dc5258b30703c9b29f3c0087e1728e93fc160f1cbf3c53f9589ee09aad849`; ledger: 8 served, 0 refused-unknown, 0 refused-unprojected, 18 declined-non-api
- Mutation: seam ` products - Page ` in `main.f02d2dbc7ec47246.js` at byte offset 391975 — `d8338270edad07a2f37828def4369e9325f761c787b992c68dd03177a7f710bf` → `65f40188b0b7641632ecbdde6e29147c468a23c029695213bd6733459bbf4588` (red) → `d8338270edad07a2f37828def4369e9325f761c787b992c68dd03177a7f710bf` (restored byte-identically, run pass, behaviour `585ae9ecdf637ace7031624b00750a3c03c7f8f900e60017c55b8ee4f973a363`)
- Locality: offline, 0 successful non-loopback requests, OS-wide isolation false
- Browser proof: **verified-on-bounded-anonymous-catalog-surface**

Legs recorded:

- catalog renders the configured first page
- anonymous identity offers only Login and no basket
- genuine viewport scroll on an overflowing catalog
- server-paged navigation forward and back
- type filter narrows by keyboard selection
- brand filter narrows on top of the type filter
- clean page

The migrated build the re-frozen 27741d9c adapter produced and the era baseline build were served as production static bytes on a bounded loopback origin, behind one declared same-origin projection that is identical for both lanes, and each was driven twice through the same anonymous catalog journey. All four runs normalize to one behaviour digest; each lane’s two passes agree exactly; overwriting one equal-length seam in the migrated bundle turns the run red, and restoring those bytes reproduces the parity digest. No non-loopback request succeeded, and no console error or failed request was observed. This is a proof about the surface the journey drove and about nothing else: the surfaces listed below were never exercised, and they are unproven rather than proven absent.

### The surface this proof covers, and the surfaces it does not

Proven: **anonymous-catalog** — the surface an unauthenticated visitor is offered: the rendered catalog page, a genuine wheel scroll on a document that really overflows the measured viewport, server-paged navigation forward and back, and the type and brand filters selected by keyboard and applied by the application’s own control.

Not covered (4 out-of-surface, 1 not-reached, 2 not-tested):

- **identity** (out-of-surface) — SecurityService.Authorize() navigates the document to an IdentityServer '/connect/authorize' endpoint; no identity provider is projected, so Login is never exercised and nothing behind it is claimed.
- **basket** (out-of-surface) — the add-to-cart control renders disabled for an anonymous visitor and esh-basket-status is not rendered at all, so no basket behavior is exercised or claimed.
- **orders** (out-of-surface) — the orders routes are reachable only from the authenticated identity menu.
- **campaigns** (out-of-surface) — campaigns are gated behind both identity and the configuration switch, which the declared payload leaves off.
- **signalr** (not-reached) — SignalrService.init() returns before building a hub connection unless the visitor is authorized, so the anonymous run opens no socket.
- **text-entry** (not-tested) — the anonymous catalog surface has no text input; the journey drives clicks, keyboard selection and a genuine wheel scroll, and claims no typing coverage.
- **drag** (not-tested) — the anonymous catalog surface has no drag affordance.

## What the reopen bought

9 capabilities and composition repairs, **all of them experimental and out of the supported matrix**, extracted against Angular subtree `4b6e2f4494d98582e4fe9b420c2b412059dc0720` and published under composite `27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234` with the React subtree unchanged at `972ca80155bbc2a6eb3779943cd481b71d35e803`:

- `unread-declaration-silence-reporting` (lrapr-t024/u1-silence-defect-and-declarations) — the manifest alignment reports every era-pinned declaration the cell has read no line for, instead of carrying it silently at its era pin
- `angular-16-community-layer-readings` (lrapr-t024/u1-silence-defect-and-declarations) — community-layer readings of published bytes for the two packages that stopped the lane, taken by the same rule every other entry there was chosen by
- `superseded-era-lockfile` (lrapr-t024/u1-silence-defect-and-declarations) — era-lockfile supersession as a changeset declaration rather than a lane convention, taken only where the lockfile bytes contradict the migrated manifest bytes
- `workspace-script-flags` (lrapr-t024/u1-silence-defect-and-declarations) — npm-script flag retargeting driven by the builder options this workspace migration actually removed
- `use-position-symbol-successor` (lrapr-t024/u2-value-position-successor-and-compile-wall) — cross-package removed-symbol carriage read one use position at a time, with a measured refusal where a rename would compile and lie
- `removed-static-module-method` (lrapr-t024/u2-value-position-successor-and-compile-wall) — removal of a static module configuration method the aligned line no longer declares, gated on the installed declarations
- `rxjs-prototype-patch-and-tilde-sass-composition` (lrapr-t024/u2-value-position-successor-and-compile-wall) — two already-exported capabilities composed into the driver behind supply gates: the RxJS prototype-patch seam on compiler-stated positions, and the webpack tilde style specifier after the exports-map rewrite whose output it resolves
- `http-client-call-surface` (lrapr-t024/u3-httpclient-call-surface) — the call surface of a removed HTTP client carried as one whole flow at a time, supply-gated on the successor classes as the lane installed them
- `package-exports-republished-subpath` (lrapr-t024/u4-exports-map-wiring-green-attempt) — a blocked stylesheet import whose file the package exports map still publishes under another key is rewritten onto that key, which changes no payload and therefore declares nothing

## What the build run said was not established

Recorded by `lrapr-t024/u4-exports-map-wiring-green-attempt`, unedited. Only the first of these — that no test, journey or witness had run — has been answered, and only on the anonymous catalog surface the Witness above drove. The remaining four still stand exactly as the build run wrote them, and the sealed build record itself is unedited.

- A build that completes and repeats is not a build that behaves. No test, no journey and no witness has run against this application in either lane, so nothing here establishes parity, rendering or any browser behaviour.
- Determinism is established for two runs in one cell on one machine. It is not a claim about another machine, another Node build, or a cold npm cache.
- The output inventory compares the migrated lane against the era baseline by path with content hashes elided. Two files bearing the same elided name are not thereby claimed to have the same content — the four emitted artefacts are named as differing precisely because they do.
- The capability is proven on one application. The republished-subpath rule fired on one import of one package, and nothing here claims it general.
- Every declared difference u3 recorded still stands. Closing the build did not retire the loss of checking the `Response` annotations were carried with.

## Finding

**the reopened and re-frozen Angular adapter carries this application to a repeatable production build and to a browser journey whose behaviour is indistinguishable from the era baseline on the anonymous catalog surface; everything behind identity is out of surface and stays unproven.**

Four states are recorded rather than reconciled. Gate zero passed on an overturn ruling. The frozen adapter was refused at install and that RED stands as history. The reopened adapter composed a changeset for an application it had never seen, installed the closure unforced and unnarrowed, and produced a production build twice with byte-identical output and no diagnostics. The re-frozen adapter’s output was then served to a browser beside the era baseline and behaved identically on the anonymous catalog surface, twice per lane, with a mutation-red and byte-restore proof under it. What a holdout exists to prove — that the migrated application is still the application — is proven here for that surface and is not proven for identity, basket, orders, campaigns or the SignalR hub, which the journey never entered.

20 application files changed by the changeset; 0 hand edits.

## Counting

Counted in a lineage numerator: **false**; decided by: **judge**. Counting is a separate layer from measuring, and this receipt is a measurement. The entry is counted in no lineage numerator; whether a holdout proven on a bounded surface should ever reach one is the Judge’s decision, made against the Judge’s ledger, and it is deliberately not taken here.

## Non-claims

- This is one Angular holdout under direct Witness. It does not establish generic Angular support, a designated pilot, or readiness beyond this exact lineage cell, and it is not counted in any lineage numerator.
- The API this journey talks to is a frozen synthetic same-origin loopback projection authored for this fixture, NOT the eShopOnContainers .NET microservices. No captured production payload, no real catalogue, no real account and no real user data are involved, and nothing here is evidence about those services.
- The synthetic catalogue deliberately does not reproduce the upstream seed data, so nothing here should be read as evidence about the real catalog service or its contents.
- Identity is out of surface. No IdentityServer is projected, Login is never exercised, and every surface behind it — basket, orders, campaigns, the SignalR hub — is unproven rather than proven absent.
- Text entry and drag are not tested, because the anonymous catalog surface offers neither.
- The application's own test suites were not run; this is a browser proof of the journeys named above, not a substitute for the upstream suite.
- Locality is process-scoped and does not establish operating-system-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
- This holdout passed on a bounded surface, and the boundary is part of the claim. The anonymous catalog surface is what the journey drove and what parity was measured over; identity, basket, orders and campaigns are out of surface, the SignalR hub was never reached, and text entry and drag were not tested. Nothing here may be restated as a generic pass.
- The install RED under the frozen f1a63359 composite is not retracted by anything that followed it. It is what the frozen adapter did, it is published unchanged, and both the green build and the Witness ran against a reopened and re-frozen adapter and say so.
- No claim that the nine capabilities the reopen extracted are proven. Every one of them was written against this single application, and all nine stay experimental and out of the supported matrix until a second, independent Angular application carries them.
- This entry is counted in no lineage numerator, and this receipt does not decide whether it ever should be. Counting is the Judge's layer: `countedInLineageNumerator` stays false here, and any flip is made there, with its own reasoning, on evidence this receipt only supplies.
- A behaviour digest that matches across the two lanes is a statement that the migrated build did what the era baseline did on the legs recorded here. It is not a statement that either build is correct, and the application’s own test suites were not run.
