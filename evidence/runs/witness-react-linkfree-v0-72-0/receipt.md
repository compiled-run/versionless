# LinkFree v0.72.0 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: 2277ad1947280d898f577f418f8b4a34ca775b91156bc1e1de488bde28eae4ba
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: 09432cbf2578c35c1d04e74219e8411c075505943914fbe91b197c2da46929a1
- Dataset: SYNTHETIC. The archive ships 561 profile documents naming real contributors. The MIT grant covers the code; whether a contributor intended their personal profile to be redistributed inside a migration-evidence corpus is recorded upstream as unresolved, and an unresolved question is not a licence.
- How: the application's own corpus-agnostic generate.js, run unmodified over the synthetic profiles; 0 application source edits; the same corpus in both lanes; 18 bundler-authored emitted paths proved byte identical to the committed build output
- Journey: the homepage, the searchable directory of 12 synthetic profiles, a typed search that narrows to 1 and a full clear that restores 12, a real router navigation into a profile route, its 14 declared links, a hover that restyles a link, a measured wheel scroll and the application's own scroll-to-top control, and the not-found state behind the application's own example link
- Router: react-router-dom-5 with a /:username segment; the exact route sequence `/search` -> `/synthetic-nimbus` -> `/search` -> `/` -> `/{application-authored-example-profile}`
- Avatar cascade: the declared endpoint is answered 404 in context, the application's own onerror handler cascades to a second host, and that one is answered 200. Both are answered locally; neither leaves the machine.
- Mocked non-loopback seams (exact, per lane) — baseline: `GET https://avatars.dicebear.com/api/initials/Nimbus.svg`, `GET https://avatars.githubusercontent.com/synthetic/synthetic-nimbus.png`; migrated: `GET https://avatars.dicebear.com/api/initials/Nimbus.svg`, `GET https://avatars.githubusercontent.com/synthetic/synthetic-nimbus.png`
- Console-error inventory (exact, whole journey, per lane) — baseline: 2x `Failed to load resource: the server responded with a status of 404 (Not Found)`; migrated: 2x `Failed to load resource: the server responded with a status of 404 (Not Found)`
- Failed requests: none in either lane
- Rendered appearance: 5 probes measured off the live page in both lanes; the baseline ships the stylesheet its own postbuild purge cut by 91.8% and the migrated lane ships that stylesheet unpurged, and the two still resolve to identical appearance at every probe
- Scroll: measured-genuine-viewport-scroll on /synthetic-nimbus — scrollHeight 1326 against clientHeight 720 at 1280x720
- Mutation proof: `Profile not found.` in `assets/index-CPwafykQ.js` at offset 288075 made the journey red, byte-identical restoration made it green again
- React lineage readiness: unchanged at 1/4; this vertical is not counted

- This is one React lineage under direct Witness and does not establish generic React or create-react-app 5 support.
- The React lineage readiness score is unchanged; this vertical is not counted before Judge audit.
- The dataset is SYNTHETIC. These journeys prove the behaviour of the application, not the correctness, completeness or rendering of the 561 real contributor profiles its archive ships. Nothing here is evidence about that dataset, and none of it was rendered, quoted or published.
- The profile route the not-found journey reaches is the example the application itself hard-codes on its homepage. It names a real person, so it is recorded through a closed-list redaction; the route shape is evidence, the identity is not.
- Scroll is claimed only for the profile route, the one stage the journey exercised with a real wheel gesture. Three of the five measured stages overflow the 1280x720 viewport; the other two that overflow were measured and left unscrolled, and no scroll coverage is claimed for them.
- Drag is not tested because the visited routes have no genuine drag surface.
- Both avatar hosts are answered inside the browser context and neither is contacted. The fallback image is a deterministic placeholder, not what the third-party generator would have returned, and no claim is made about that service.
- The declared outbound links on every synthetic profile are unresolvable by construction and are never fetched; no claim is made about link behaviour beyond the list the application renders.
- The upstream cypress suite was not run. Its four features documented which journeys matter and this proof drives all four, but it is not that suite and does not stand in for it.
- Locality is process-scoped and does not establish operating-system-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
