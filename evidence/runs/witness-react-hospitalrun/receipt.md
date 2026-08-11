# HospitalRun v2.0.0-alpha.7 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: 275e435c8518f8978782e6c555ad8c4dd0d6e5401e2ef1acef8856f596648aaa
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: bb87c861e83fe5cdce99ba3c2ea6ef0523a66f4c1a75d8d8be0f10411c7b6fed
- Journey: new-patient intake into the browser-local PouchDB store, success toast, patient row, patient record sub-tabs, labs / incidents / imaging department routes, appointment schedule with a real wheel scroll, and an online reload the created record survives
- Persistence: browser-local-pouchdb, stubbed: false, survives an online reload: true
- Service worker: the application's own `serviceWorker.register()` is refused by the browser context; zero registrations, controller, CacheStorage names and worker lifecycle events at three checkpoints in every pass. The worker-script requests the application makes are not zero and are not hidden — they are recorded below.
- Recorded migration difference: baseline emits-service-worker-js-and-calls-register; migrated emits-no-service-worker-and-register-probe-404s; masked: false
- Console-error inventory (exact, whole journey, per lane) — baseline: 4x `Error during service worker registration: TypeError: Cannot set properties of undefined (setting 'onupdatefound')`; migrated: 4x `Failed to load resource: the server responded with a status of 404 (Not Found)`
- Failed-request inventory (exact, whole journey, per lane) — baseline: 2x `GET /service-worker.js (net::ERR_ABORTED)`; migrated: 2x `GET /service-worker.js (net::ERR_ABORTED)`
- Worker-script trace: the application attempts registration 4x per journey in both lanes and every attempt is refused; the baseline's 4x `/service-worker.js` -> 200 against the migrated build's 4x `/service-worker.js` -> 404
- Retained but never-controlling worker output: service-worker.js
- Mutation proof: `Successfully created patient` in `assets/index-COyyRcgA.js` at offset 5486191 made the journey red, byte-identical restoration made it green again
- Scroll: measured-genuine-viewport-scroll on /appointments — scrollHeight 1028 against clientHeight 720 at 1280x720
- React lineage readiness: unchanged at 1/4; this vertical is not counted

- This is one React lineage under direct Witness and does not establish generic React or create-react-app support.
- The React lineage readiness score is unchanged; this vertical is not counted before Judge audit.
- The patient record is created inside the browser by the application itself against its own PouchDB store; no database was stubbed, seeded, or answered by the harness, and no real patient data is involved.
- Scroll is claimed only for the appointment schedule, the one visited route whose document overflows the 1280x720 viewport; the other visited routes report scrollHeight equal to clientHeight and are not claimed as scroll coverage.
- Drag is not tested because the visited routes have no genuine drag surface.
- Service-worker registration is refused at the browser context in both lanes. The refusal is not silenced: each lane emits exactly the console errors and failed requests pinned in this receipt, and anything outside those inventories fails the run.
- The baseline still emits and registers a create-react-app service-worker.js while the migrated build emits none; that difference is recorded as a real behavioral migration difference rather than normalized away.
- Neither lane has a silent console. The application itself calls serviceWorker.register() in both lanes, so both are noisy and noisy in different ways: the baseline serves its retained worker script and its own error handler reports the refused registration, while the migrated build has no worker script to serve and the registration probe 404s. A console-silent migrated lane would require changing the application source, which this migration deliberately does not do.
- Locality is process-scoped and does not establish operating-system-wide isolation.
- Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.
