# React Quiz App terminal exclusion

- Result: **excluded without retry**
- Classification: `request-implementation-defect`
- Candidate: terminal, non-retriable, and not counted
- Consent uses: **1**; consumed and non-reusable
- First request: immutable Git Trees JSON endpoint, HTTP 415
- Attempt marker: 88 bytes, SHA-256 `c67f747a0899b7b9106682a20a1bc677d03e2926ebe1bfc09ada26a3a9e851b7`
- Canonical evidence digest: `465412645dd147b586e8c8386899753be4d5a5fa904b9689e400b6cac48ba0e1`

The ingest applied an `application/octet-stream` Accept value to the JSON endpoint. This is a request-implementation defect; upstream fault is not established. No later request ran.

No response body, response headers, response byte count, response digest, or ledger row was recorded, so none is reconstructed or inferred. No closure, install, build, browser, linked-Witness, migration, mutation, restoration, corpus, aggregate, or trust proof exists.

Cache, work, stage, and run roots are absent. Aggregate, trust, counts, readiness, and pilots remain unchanged. The retained hashes establish reproducibility only—not certification, compliance, signer authenticity, or OS-wide isolation.
