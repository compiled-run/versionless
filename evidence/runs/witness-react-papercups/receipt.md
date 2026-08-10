# Papercups v1.0.0 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: abd33d566ecef3ce4b24470c3105320520a712db19351f74b6c887b63227f267
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: a2d4dbb6f844dfb8ee2d78cfc64e9981b6a91186030f345a7e6ffb9975eb9917
- Journey: sign-in, inbox triage across all/prioritized/closed, reply round-trip over the Phoenix shout broadcast, online reload
- Service worker: the application calls `serviceWorker.unregister()`; zero registrations, controller, CacheStorage names, lifecycle events, and worker requests at three checkpoints in every pass
- Retained but unregistered worker output: service-worker.js
- Mutation proof: `Welcome back` in `assets/index-Ckm7yL2X.js` at offset 865816 made the journey red, byte-identical restoration made it green again
- Scroll: omitted-not-meaningful — scrollHeight-equals-clientHeight-on-every-visited-route at 1280x720
- React lineage readiness: unchanged at 1/4; this vertical is not counted

- This is one React lineage under direct Witness and does not establish generic React or create-react-app support.
- The React lineage readiness score is unchanged at 1/4; this vertical is not counted before Judge audit.
- Scroll is not tested: every route the journey visits reports scrollHeight equal to clientHeight at 1280x720, so there is no meaningful scroll surface to exercise.
- Drag is not tested because the operator console has no genuine drag surface on the visited routes.
- The retained create-react-app baseline still emits an unregistered service-worker.js; the evidence records those bytes and proves the runtime never registers, controls, caches, or requests them.
- The Papercups API and Phoenix socket are answered by a frozen synthetic loopback projection authored for this fixture; no captured production payload and no real customer data are involved.
- Locality is process-scoped and does not establish operating-system-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
